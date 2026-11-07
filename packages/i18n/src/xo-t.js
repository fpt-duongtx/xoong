// @ts-check
/**
 * `xo-t` (ADR-0010): translate an element. The text written in the HTML is the default and the source `xoong i18n extract` collects.
 *
 *   <h1 xo-t="articles.title">Articles</h1>
 *   <input xo-t="placeholder:search.placeholder; aria-label:search.label" placeholder="Search" aria-label="Search">
 *   <p xo-t="articles.summary">Showing {$from}–{$to} of {total}</p>        inside an <xo-view>: placeholders come from the view's scope
 *
 * Elements inside an `<xo-view>` are translated by the view (it has the scope); everything else (route templates, layouts, static pages)
 * by the enhancer in this file. Both call `apply`, and both re-run it when the language or the catalogs change.
 */
import { effect } from '@xoong/core/signals';
import { messageFor, locale } from './i18n.js';
import { formatMessage } from './message.js';

/** "key", or "attr:key; attr2:key2" -> [{ attr, key }]. A bare key is the element's text. */
export function parseSpec(spec) {
  return spec.split(';').map((p) => p.trim()).filter(Boolean).map((p) => {
    const i = p.indexOf(':');
    return i > 0 && /^[\w-]+$/.test(p.slice(0, i)) ? { attr: p.slice(0, i), key: p.slice(i + 1).trim() } : { attr: null, key: p };
  });
}

/** Does the spec translate the element's text (a bare key), not only attributes? */
export const hasText = (spec) => parseSpec(spec).some((e) => !e.attr);

const defaults = new WeakMap();

/**
 * Put the translation into the element. Reads the catalogs and the language, so call it inside an effect.
 * @param {Element} el @param {(name: string) => any} get where `{placeholder}` values come from
 */
export function apply(el, get) {
  const entries = parseSpec(el.getAttribute('xo-t') ?? '');
  let kept = defaults.get(el);
  if (!kept) { kept = {}; for (const { attr } of entries) kept[attr ?? '#text'] = attr ? el.getAttribute(attr) ?? '' : el.textContent ?? ''; defaults.set(el, kept); }
  for (const { attr, key } of entries) {
    const source = messageFor(key) ?? kept[attr ?? '#text'] ?? key;
    const out = formatMessage(source, get, locale.value);
    if (attr) { if (el.getAttribute(attr) !== out) el.setAttribute(attr, out); } else if (el.textContent !== out) el.textContent = out;
  }
}

// ---- the enhancer for everything outside <xo-view> -------------------------------------------------------------------------------

/** @type {WeakMap<Element, () => void>} */
const stops = new WeakMap();
const inView = (el) => !!el.closest?.('xo-view');

function track(el) {
  if (stops.has(el) || inView(el)) return;
  stops.set(el, effect(() => apply(el, () => undefined)));
}
function untrack(el) { stops.get(el)?.(); stops.delete(el); }

function scan(root) {
  if (root.matches?.('[xo-t]')) track(root);
  for (const el of root.querySelectorAll?.('[xo-t]') ?? []) track(el);
}

/** Start translating the document (done automatically when the package is imported in a browser). */
export function startEnhancer(root = globalThis.document) {
  if (!root) return () => {};
  const run = () => scan(root.body ?? root);
  if (root.readyState === 'loading') root.addEventListener('DOMContentLoaded', run, { once: true }); else run();
  const observer = typeof MutationObserver !== 'undefined' ? new MutationObserver((records) => {
    for (const r of records) {
      for (const n of r.removedNodes) if (n.nodeType === 1 && !n.isConnected) { /** @type {Element} */ (n).querySelectorAll?.('[xo-t]').forEach(untrack); untrack(/** @type {Element} */ (n)); }
      for (const n of r.addedNodes) if (n.nodeType === 1) scan(/** @type {Element} */ (n));
    }
  }) : null;
  observer?.observe(root.body ?? root.documentElement, { childList: true, subtree: true });
  return () => observer?.disconnect();
}
