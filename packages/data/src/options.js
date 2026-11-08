// @ts-check
/**
 * Options from the API for a combobox or a tag input, declared in markup:
 *
 *   <xo-combobox name="categoryIds" multiple options-op="listCategories" option-value="id" option-label="name.en"></xo-combobox>
 *
 * `options-op` is a GET operation (an operationId or "/path"); `p-<name>` attributes are its parameters, as on <xo-view>. The list is the
 * response itself, or its `items` (or `data`) member. `option-value` and `option-label` are paths in each item ("id", "name.en"); they
 * default to `value` and `label`, then to `id` and `name`. The data comes from the shared cache, so a mutation that touches the list
 * (a category added elsewhere on the page) refreshes the options by itself. Importing `@xoong/data/view` turns this on.
 */
import { effect } from '@xoong/core/signals';
import { getClient } from './default.js';

const camel = (/** @type {string} */ s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const pick = (/** @type {any} */ item, /** @type {string[]} */ paths) => {
  for (const path of paths) {
    let v = item;
    for (const step of path.split('.')) v = v?.[step];
    if (v != null && typeof v !== 'object') return String(v);
  }
  return '';
};
const stops = new WeakMap();

/** @param {any} el */
function start(el) {
  if (stops.has(el)) return;
  const ref = el.getAttribute('options-op');
  if (!ref) return;
  /** @type {Record<string, string>} */ const params = {};
  for (const a of el.attributes) if (a.name.startsWith('p-')) params[camel(a.name.slice(2))] = a.value;
  const valueAt = el.getAttribute('option-value');
  const labelAt = el.getAttribute('option-label');
  let query;
  try { query = getClient().query(ref.startsWith('/') ? `GET ${ref}` : ref, params); } catch (e) { console.error(e); return; }
  query.retain();
  const stop = effect(() => {
    const data = query.data.value;
    const list = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
    el.options = (Array.isArray(list) ? list : []).map((item) => (typeof item === 'object' && item
      ? { value: pick(item, [valueAt ?? 'value', 'id']), label: pick(item, [labelAt ?? 'label', 'name', 'title', valueAt ?? 'id']) }
      : String(item)));
  });
  stops.set(el, () => { stop(); query.release(); });
}

const scan = (/** @type {ParentNode} */ root) => { for (const el of root.querySelectorAll?.('[options-op]') ?? []) start(el); };
const clean = (/** @type {Node} */ node) => { for (const el of [node, ...((/** @type {any} */ (node)).querySelectorAll?.('[options-op]') ?? [])]) { stops.get(el)?.(); stops.delete(el); } };

if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  const watch = () => {
    scan(document);
    new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.removedNodes) if (n.nodeType === 1 && !(/** @type {Element} */ (n)).isConnected) clean(n);
        for (const n of r.addedNodes) if (n.nodeType === 1) { if (/** @type {Element} */ (n).hasAttribute('options-op')) start(n); scan(/** @type {Element} */ (n)); }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch, { once: true }); else queueMicrotask(watch);
}
