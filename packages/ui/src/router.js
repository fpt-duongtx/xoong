// @ts-check
/**
 * <xo-router>: a History-API router declared in markup (see docs/decisions/0008-spa-router.md and docs/admin.md).
 *
 *   <xo-router base="/admin">
 *     <template xo-layout="shell"><nav>...<a href="/users">Users</a></nav><main xo-outlet></main></template>
 *     <template xo-route="/users/:id" layout="shell" title="User" description="The user page"><xo-view get="getUser" p-id=":id">...</xo-view></template>
 *     <template xo-route="*">Not found</template>
 *   </xo-router>
 *
 *   The `router` object (exported by @xoong/ui):
 *   router.navigate('/users/3');
 *   router.guard(async (to, from) => (loggedIn() ? true : '/login'));          // true | false | '/redirect'
 *   router.beforeNavigate((to, from) => !form.dirty || confirm('Leave without saving?'));   // veto leaving
 */
import { XoElement, define, text } from '@xoong/core';
import { setParamSource, setUrlSync, ask } from '@xoong/data/view';

/** @typedef {{ path: string, params: Record<string,string>, query: URLSearchParams, url: string, route: Route | null }} Location */
/** @typedef {{ pattern: string, regex: RegExp, names: string[], layout: string | null, title: string, description: string | undefined, template: HTMLTemplateElement, score: number }} Route */

const trim = (s) => (s.length > 1 ? s.replace(/\/+$/, '') : s) || '/';
/** Decode a URL part; a malformed escape ("%zz") is kept as it is instead of throwing, like Vue Router. */
const dec = (s, fn = decodeURIComponent) => { try { return fn(s); } catch { return s; } };

/** Compile "/users/:id" or "*" into a matcher; static segments rank above parameters, parameters above the catch-all. */
function compile(pattern) {
  if (pattern === '*') return { regex: /^.*$/, names: [], score: 0 };
  const names = [];
  let score = 1000;
  const source = trim(pattern).split('/').map((seg) => {
    if (seg.startsWith(':')) { names.push(seg.slice(1)); score -= 10; return '([^/]+)'; }
    score += 1;
    return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('/');
  return { regex: new RegExp(`^${source || '/'}/?$`), names, score };
}

/** The router that is currently running (there is one per page). */
/** @type {XoRouter | null} */
let active = null;

class XoRouter extends XoElement {
  static props = { base: String };

  /** @type {Route[]} */ #routes = [];
  /** @type {Map<string, { template: HTMLTemplateElement, layout: string | null }>} */ #layouts = new Map();
  /** @type {{ name: string, el: Element, outlet: Element }[]} */ #mounted = [];
  /** @type {Location | null} */ #current = null;
  /** @type {((to: Location, from: Location | null) => any)[]} */ #guards = [];
  /** @type {((to: Location, from: Location | null, type: string) => any)[]} */ #vetoes = [];
  #root = /** @type {HTMLElement | null} */ (null);
  #token = 0;
  #started = false;
  /** Index of the current history entry (kept in history.state, like Vue Router): lets Back/Forward be cancelled with history.go. */
  #pos = 0;
  #reverting = false;
  /** @type {Map<number, { x: number, y: number }>} scroll position per history entry, restored on Back/Forward */
  #scrolls = new Map();
  /** Forms with unsaved changes (they announce it with `xo-dirty`); leaving the page asks first, unless the form says `xo-guard="off"`. */
  #dirtyForms = new Set();
  #onDirty = (/** @type {Event} */ e) => {
    const form = /** @type {Element} */ (e.target);
    if (/** @type {any} */ (e).detail?.dirty && form.getAttribute('xo-guard') !== 'off') this.#dirtyForms.add(form); else this.#dirtyForms.delete(form);
  };
  #unsaved = () => { for (const f of this.#dirtyForms) if (!f.isConnected) this.#dirtyForms.delete(f); return [...this.#dirtyForms]; };
  #onUnload = (/** @type {BeforeUnloadEvent} */ e) => { if (this.#unsaved().length) { e.preventDefault(); e.returnValue = ''; } };
  #onClick = (/** @type {MouseEvent} */ e) => this.#click(e);
  #onPop = () => {
    if (this.#reverting) { this.#reverting = false; return; } // our own history.go(-delta) after a vetoed Back/Forward
    const target = window.history.state?.xoPos;
    const delta = typeof target === 'number' ? target - this.#pos : 0;
    this.#go(this.#read(), 'replace', 'popstate', 0, delta, target).catch((e) => this.#report(e));
  };

  connected() {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => this.#start(), { once: true });
    else queueMicrotask(() => this.#start());
  }

  disconnected() {
    document.removeEventListener('click', this.#onClick);
    document.removeEventListener('xo-dirty', this.#onDirty);
    window.removeEventListener('popstate', this.#onPop);
    window.removeEventListener('beforeunload', this.#onUnload);
    setUrlSync(null);
    this.#started = false;
    if (active === this) active = null;
  }

  // ---- public API (also available as the `router` object) --------------------------------------------------------------

  /** The current location, or null before the first navigation finished. */
  get current() { return this.#current; }

  /** Go to a path (relative to `base`). Resolves with true when the navigation happened. */
  navigate(path, { replace = false } = {}) {
    return this.#go(this.#parse(path), replace ? 'replace' : 'push', 'api');
  }

  /** Run before every navigation. Return true to continue, false to cancel, or a path to redirect. */
  guard(fn) { this.#guards.push(fn); return () => { this.#guards = this.#guards.filter((g) => g !== fn); }; }

  /** Run before leaving the current location (links, back/forward, `navigate`). Return false to stay. */
  beforeNavigate(fn) { this.#vetoes.push(fn); return () => { this.#vetoes = this.#vetoes.filter((g) => g !== fn); }; }

  // ---- internals -----------------------------------------------------------------------------------------------------------

  #start() {
    if (this.#started || !this.isConnected) return;
    this.#started = true;
    active = this;
    for (const t of /** @type {HTMLTemplateElement[]} */ ([...this.querySelectorAll(':scope > template')])) {
      if (t.hasAttribute('xo-layout')) this.#layouts.set(t.getAttribute('xo-layout') ?? '', { template: t, layout: t.getAttribute('layout') });
      else if (t.hasAttribute('xo-route')) {
        const pattern = t.getAttribute('xo-route') ?? '';
        this.#routes.push({ pattern, ...compile(pattern), layout: t.getAttribute('layout'), title: t.getAttribute('title') ?? '', description: t.getAttribute('description') ?? undefined, template: t });
      }
    }
    this.#routes.sort((a, b) => b.score - a.score);
    for (const old of this.querySelectorAll(':scope > .xo-router-root')) old.remove(); // content prerendered by @xoong/ssr: the router renders it again
    this.#root = document.createElement('div');
    this.#root.className = 'xo-router-root';
    this.append(this.#root);
    setParamSource((name) => this.#current?.params[name]); // p-id=":id" on a view
    try { window.history.scrollRestoration = 'manual'; } catch { /* a DOM without it */ } // we restore scroll ourselves, per entry
    this.#pos = window.history.state?.xoPos ?? 0;
    document.addEventListener('click', this.#onClick);
    document.addEventListener('xo-dirty', this.#onDirty);
    window.addEventListener('popstate', this.#onPop);
    window.addEventListener('beforeunload', this.#onUnload);
    this.#vetoes.push(async () => { // a dirty form asks before the page is left (links, Back, navigate)
      const dirty = this.#unsaved();
      if (!dirty.length) return true;
      const own = dirty.map((f) => f.getAttribute('xo-guard')).find((m) => m && m !== 'off');
      return ask(own ?? text('xoong.guard.leave', 'You have unsaved changes. Leave this page?'));
    });
    // url-params of a view: write the query string through the router, without rendering the route again
    setUrlSync({ read: () => new URLSearchParams(window.location.search), write: (params, mode) => this.#writeQuery(params, mode), subscribe: () => () => {} });
    this.#go(this.#read(), 'replace', 'start').catch((e) => this.#report(e));
  }

  /** Navigation started by the page itself (first load, back/forward, a link click) cannot reject to a caller: report it. */
  #report(e) {
    console.error(e);
    this.emit('xo-error', e);
  }

  get #base() { return trim(this.base || '/'); }

  /** The browser location as a router location (path without the base). */
  #read() {
    return this.#parse(window.location.pathname + window.location.search + window.location.hash, true);
  }

  /** @param {string} target a path (with optional query) relative to the base, or a full path when `absolute` */
  #parse(target, absolute = false) {
    const url = new URL(target, `${window.location.origin}${absolute ? '' : this.#base === '/' ? '/' : this.#base + '/'}`);
    let path = trim(dec(url.pathname, decodeURI));
    const base = this.#base;
    if (base !== '/' && (path === base || path.startsWith(base + '/'))) path = trim(path.slice(base.length) || '/');
    return this.#locate(path, url);
  }

  /** @returns {Location} */
  #locate(path, url) {
    const base = this.#base === '/' ? '' : this.#base;
    const full = (base + (path === '/' ? '' : path)) || '/'; // as in the address bar: base + path, no trailing slash
    const out = { path, params: {}, query: url.searchParams, url: full + url.search + url.hash, route: null };
    for (const route of this.#routes) {
      const m = route.regex.exec(path);
      if (!m) continue;
      out.params = Object.fromEntries(route.names.map((n, i) => [n, dec(m[i + 1])]));
      out.route = route;
      break;
    }
    return out;
  }

  #click(/** @type {MouseEvent} */ e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = /** @type {Element} */ (e.target)?.closest?.('a[href]');
    if (!a || (a.getAttribute('target') && a.getAttribute('target') !== '_self') || a.hasAttribute('download') || a.getAttribute('rel')?.includes('external')) return;
    const url = new URL(/** @type {string} */ (a.getAttribute('href')), window.location.href);
    if (url.origin !== window.location.origin) return;
    const base = this.#base;
    if (base !== '/' && !(url.pathname === base || url.pathname.startsWith(base + '/'))) return; // not ours: let the browser navigate
    if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return; // in-page anchor
    e.preventDefault();
    this.#go(this.#parse(url.pathname + url.search + url.hash, true), 'push', 'link').catch((err) => this.#report(err));
  }

  /**
   * Run the hooks, then show the location. `type`: 'start' | 'link' | 'api' | 'popstate'.
   * @param {Location} to @param {'push'|'replace'} mode @param {string} type
   */
  async #go(to, mode, type, depth = 0, delta = 0, popPos = undefined) {
    const token = ++this.#token;
    const from = this.#current;
    // Same place as now: nothing to do (Vue Router calls this a duplicated navigation). Only the hash differs: no re-render, just
    // scroll to the anchor (React Router / Vue Router behave the same way for in-page anchors).
    if (from && type !== 'start' && type !== 'redirect' && to.path === from.path && to.query.toString() === from.query.toString()) {
      if (type !== 'popstate' && to.url === from.url) return false;
      if (type !== 'popstate') this.#writeUrl(to, mode);
      else if (typeof popPos === 'number') this.#pos = popPos;
      this.#current = { ...to, route: from.route };
      this.#scrollTo(to, type, this.#pos);
      this.emit('xo-navigate', { to, from });
      return true;
    }
    if (type !== 'start') {
      for (const veto of [...this.#vetoes]) {
        if ((await veto(to, from, type)) === false) { if (token === this.#token) this.#restore(type, delta); return false; }
        if (token !== this.#token) return false; // a newer navigation took over
      }
    }
    for (const guard of [...this.#guards]) {
      const result = await guard(to, from);
      if (token !== this.#token) return false;
      if (result === false) { this.#restore(type, delta); return false; }
      if (typeof result === 'string') {
        if (depth >= 10) throw new Error('xoong router: too many redirects (a guard keeps redirecting)');
        return this.#go(this.#parse(result), 'replace', 'redirect', depth + 1);
      }
    }
    if (from && type !== 'start') this.#scrolls.set(this.#pos, { x: window.scrollX, y: window.scrollY }); // where we were, for Back
    if (type === 'popstate') { if (typeof popPos === 'number') this.#pos = popPos; }
    else if (type === 'start') this.#writeUrl(to, 'replace');
    else this.#writeUrl(to, mode);
    this.#current = to;
    this.#render(to);
    this.#afterNavigate(to, from, type);
    return true;
  }

  /**
   * A vetoed or cancelled Back/Forward already moved the address bar. Put it back with history.go(-delta), as Vue Router does:
   * the history stays as it was, forward entries included. Where the position is unknown (or the DOM has no history.go), push the
   * previous URL again as a fallback, which drops forward entries.
   */
  #restore(type, delta) {
    if (type !== 'popstate' || !this.#current) return;
    if (delta && typeof window.history.go === 'function') { this.#reverting = true; window.history.go(-delta); return; }
    window.history.pushState({ xoPos: this.#pos }, '', this.#current.url);
  }

  /** A view changed its url-params: update the query string of the current location (a new entry for a click, replace for typing). */
  #writeQuery(params, mode) {
    const query = params.toString();
    const url = window.location.pathname + (query ? `?${query}` : '') + window.location.hash;
    if (url === window.location.pathname + window.location.search + window.location.hash) return;
    if (mode === 'push') { this.#scrolls.set(this.#pos, { x: window.scrollX, y: window.scrollY }); this.#pos += 1; window.history.pushState({ xoPos: this.#pos }, '', url); }
    else window.history.replaceState({ xoPos: this.#pos }, '', url);
    if (this.#current) this.#current = { ...this.#current, query: new URLSearchParams(query), url: url.slice(0) };
  }

  #writeUrl(to, mode) {
    if (mode === 'replace') window.history.replaceState({ xoPos: this.#pos }, '', to.url);
    else if (to.url !== window.location.pathname + window.location.search + window.location.hash) {
      this.#pos += 1;
      window.history.pushState({ xoPos: this.#pos }, '', to.url);
    }
  }

  /** After a navigation: Back/Forward restores the scroll position of that entry, an anchor scrolls to its element, otherwise to the top. */
  #scrollTo(to, type, pos) {
    const hash = to.url.includes('#') ? to.url.slice(to.url.indexOf('#') + 1) : '';
    const target = hash ? document.getElementById(dec(hash)) : null;
    if (type === 'popstate' && !hash) { const s = this.#scrolls.get(pos); window.scrollTo?.(s?.x ?? 0, s?.y ?? 0); }
    else if (target) target.scrollIntoView?.();
    else window.scrollTo?.(0, 0);
  }

  /** The layout chain of a route, outermost first, e.g. ['root', 'shell']. */
  #chain(route) {
    const names = [];
    for (let name = route?.layout; name; ) {
      if (names.includes(name)) throw new Error(`xoong router: layout "${name}" includes itself`);
      const layout = this.#layouts.get(name);
      if (!layout) throw new Error(`xoong router: layout "${name}" is not declared (<template xo-layout="${name}">)`);
      names.unshift(name);
      name = layout.layout ?? null;
    }
    return names;
  }

  /** Show the matched route: keep the layouts it shares with the previous route, replace the rest. */
  #render(to) {
    const root = /** @type {HTMLElement} */ (this.#root);
    const route = to.route;
    const chain = this.#chain(route);
    let keep = 0;
    while (keep < chain.length && keep < this.#mounted.length && this.#mounted[keep].name === chain[keep]) keep++;
    for (const gone of this.#mounted.splice(keep)) gone.el.remove();
    let parent = keep ? this.#mounted[keep - 1].outlet : root;
    for (const name of chain.slice(keep)) {
      const fragment = /** @type {HTMLTemplateElement} */ (this.#layouts.get(name)?.template).content.cloneNode(true);
      const holder = document.createElement('div');
      holder.className = 'xo-layout';
      holder.append(fragment);
      const outlet = holder.querySelector('[xo-outlet]');
      if (!outlet) throw new Error(`xoong router: layout "${name}" has no element with xo-outlet`);
      parent.replaceChildren(holder);
      this.#mounted.push({ name, el: holder, outlet });
      parent = outlet;
    }
    if (!route) { parent.replaceChildren(); return; }
    parent.replaceChildren(route.template.content.cloneNode(true)); // views inside start (and fetch) now
  }

  #afterNavigate(to, from, type) {
    if (to.route?.title) document.title = to.route.title;
    if (to.route?.description !== undefined) { // per-route description for search engines (kept by prerendering)
      let meta = document.head.querySelector('meta[name="description"]');
      if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'description'); document.head.append(meta); }
      meta.setAttribute('content', to.route.description);
    }
    for (const a of document.querySelectorAll('a[href]')) {
      let path;
      try { path = trim(new URL(a.getAttribute('href') ?? '', window.location.href).pathname); } catch { continue; }
      const base = this.#base;
      if (base !== '/' && path.startsWith(base)) path = trim(path.slice(base.length) || '/');
      if (path === to.path) a.setAttribute('aria-current', 'page');
      else if (path !== '/' && to.path.startsWith(path + '/')) a.setAttribute('aria-current', 'true'); // a parent section
      else if (a.hasAttribute('aria-current')) a.toggleAttribute('aria-current', false);
    }
    const outlet = this.#mounted.at(-1)?.outlet ?? this.#root;
    if (from) { // not on the first render: move focus to the new content, and scroll like a page load (or restore, on Back/Forward)
      outlet?.setAttribute('tabindex', '-1');
      /** @type {HTMLElement} */ (outlet)?.focus?.({ preventScroll: true });
      this.#scrollTo(to, type, this.#pos);
    }
    this.emit('xo-navigate', { to, from });
  }
}
define('xo-router', XoRouter);

/** The running router, as an object: `router.navigate('/users')`. Throws when there is no <xo-router> on the page. */
export const router = {
  navigate: (path, options) => need().navigate(path, options),
  guard: (fn) => need().guard(fn),
  beforeNavigate: (fn) => need().beforeNavigate(fn),
  get current() { return need().current; },
};

function need() {
  if (!active) throw new Error('xoong router: there is no <xo-router> on this page yet (it starts after the page is parsed)');
  return active;
}
