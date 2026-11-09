// @ts-check
/**
 * `router` for the page, without loading router.js (21 KB) on a page that has no <xo-router>. The module loads when a <xo-router> is on the page (at start, or added
 * later) and on the first use of `router`. Until it has loaded: `navigate()` waits for it, `guard()` and `beforeNavigate()` return the remover at once and register
 * when it has loaded, and `current` is null.
 */
/** @type {typeof import('./router.js') | null} */
let mod = null;
const load = () => import('./router.js').then((m) => (mod = m));
const when = (/** @type {'guard' | 'beforeNavigate'} */ name) => (/** @type {any} */ fn) => {
  if (mod) return mod.router[name](fn);
  let off = () => {}, gone = false;
  load().then((m) => { if (!gone) off = m.router[name](fn); }, console.error);
  return () => { gone = true; off(); };
};
export const router = {
  navigate: async (/** @type {string} */ path, /** @type {{ replace?: boolean } | undefined} */ options) => (mod ?? (await load())).router.navigate(path, options),
  guard: when('guard'),
  beforeNavigate: when('beforeNavigate'),
  get current() { return mod ? mod.router.current : null; },
};
if (typeof document !== 'undefined') {
  const has = (/** @type {ParentNode} */ n) => n.querySelector('xo-router');
  if (has(document)) load();
  else if (typeof MutationObserver !== 'undefined') {
    const watch = new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1 && ((/** @type {Element} */ (n)).localName === 'xo-router' || has(/** @type {Element} */ (n)))) { watch.disconnect(); load(); return; }
    });
    watch.observe(document, { childList: true, subtree: true });
  }
}
