// @ts-check
/** The state a view keeps: its params (`xo-param`, route parameters) and its selection (`xo-select`). */
import { effect } from '@xoong/core/signals';
import { isRef } from './store.js';
import { camel, parseInterpolation, evalParts } from './scope.js';

/** Where `p-id=":id"` finds route parameters (set by the router in @xoong/ui). */
let paramSource = /** @type {((name: string) => string | undefined) | null} */ (null);
/** Views that use `p-x=":param"` and started before the router did (element definition order): they start when it is ready. */
const waitingForRouter = /** @type {(() => void)[]} */ ([]);
/** @param {(name: string) => string | undefined} fn */
export function setParamSource(fn) {
  paramSource = fn;
  for (const start of waitingForRouter.splice(0)) start();
}
/** What the router gives `p-x=":param"` now, and whether there is a router yet. */
export const routeParam = (/** @type {string} */ name) => paramSource?.(name);
export const hasParamSource = () => !!paramSource;
/** Run `start` when the router is ready (a view that needed a route parameter before it was). */
export const whenRouterReady = (/** @type {() => void} */ start) => waitingForRouter.push(start);

export function bindParam(el, spec, scope, ctx, disposers) {
  if (/^[\w-]+(\[[\w-]*\])*$/.test(spec.trim()) && ['input', 'select', 'textarea'].includes(el.localName)) { // a filter control
    const name = camel(spec.trim());
    let timer;
    const apply = () => {
      const params = { ...ctx.host.params };
      if (el.value === '') delete params[name]; else params[name] = el.value;
      if ('offset' in params) params.offset = 0;
      ctx.host.urlMode = el.localName === 'select' ? 'push' : 'replace'; // typing replaces the history entry, a choice adds one
      ctx.host.params = params;
    };
    const onInput = () => { clearTimeout(timer); timer = setTimeout(apply, el.localName === 'select' ? 0 : 250); }; // wait for the typing to pause
    const type = el.localName === 'select' ? 'change' : 'input';
    el.addEventListener(type, onInput);
    // the control shows the current param (after a reload or Back with url-params), unless the person is typing in it
    disposers.push(effect(() => {
      const v = ctx.host.params[name];
      const text = v == null ? '' : String(v);
      if (el.value !== text && globalThis.document?.activeElement !== el) el.value = text;
    }));
    disposers.push(() => { clearTimeout(timer); el.removeEventListener(type, onInput); });
    return;
  }
  const m = /^\s*([\w-]*\w(?:\[[\w-]*\])*)\s*(\+=|-=|~=|=)\s*(.*?)\s*$/.exec(spec); // names may be bracketed: filter[status]=open
  if (!m) { console.error(`xoong: xo-param="${spec}" is not "name=value", "name+=n", "name-=n" or "name~=value"`); return; }
  const [, rawName, op, rawValue] = m;
  const name = camel(rawName);
  const handler = () => {
    const value = evalParts(parseInterpolation(rawValue) ?? [rawValue], scope, ctx.lookup);
    const params = { ...ctx.host.params };
    const cur = params[name];
    if (op === '=') { if (value === '') delete params[name]; else params[name] = value; } // "k=" clears the param
    else if (op === '~=') params[name] = cur === value ? `-${value}` : value; // asc, then desc, then asc ...
    else params[name] = Math.max(0, (Number(cur) || 0) + (op === '+=' ? 1 : -1) * Number(value));
    if (name !== 'offset' && 'offset' in params) params.offset = 0; // a new filter or sort starts at the first page
    ctx.host.urlMode = 'push';
    ctx.host.params = params;
  };
  el.addEventListener('click', handler);
  // Tabs and segmented filters: the button whose value is the current one is marked (aria-current), "k=" matches "param unset".
  disposers.push(effect(() => {
    const cur = ctx.host.params[name];
    const want = evalParts(parseInterpolation(rawValue) ?? [rawValue], scope, ctx.lookup);
    const active = op === '=' ? String(cur ?? '') === want : op === '~=' ? String(cur ?? '').replace(/^-/, '') === want : false;
    const desc = String(cur).startsWith('-');
    if (active) { el.setAttribute('aria-current', 'true'); if (op === '~=') el.setAttribute('data-direction', desc ? 'desc' : 'asc'); }
    else { el.toggleAttribute('aria-current', false); el.toggleAttribute('data-direction', false); }
    if (op === '~=') { // a sort button in a table header: the header says how the column is sorted (no attribute = not sorted, which the kit CSS relies on)
      const th = el.closest('th');
      if (active) th?.setAttribute('aria-sort', desc ? 'descending' : 'ascending'); else th?.removeAttribute('aria-sort');
    }
  }));
  disposers.push(() => el.removeEventListener('click', handler));
}

/** `xo-select` on a checkbox in a row ticks that row; `xo-select="all:items"` in the header ticks every row of the list. */
export function bindSelect(el, spec, scope, ctx, disposers) {
  const { host, lookup } = ctx;
  const all = /^all:(.+)$/.exec(spec.trim())?.[1];
  const keyOf = (item) => (isRef(item) ? item.$ref : undefined);
  const keys = () => (all ? (lookup(scope, all) ?? []).map(keyOf).filter(Boolean) : [keyOf(scope.value())].filter(Boolean));
  if (!all && !keys().length) console.error('xoong: xo-select needs a stored entity as the current row (put the checkbox inside xo-each over entities)');
  disposers.push(effect(() => {
    const list = keys();
    el.checked = list.length > 0 && list.every((k) => host.isSelected(k));
  }));
  const onChange = () => host.select(keys(), el.checked);
  el.addEventListener('change', onChange);
  disposers.push(() => el.removeEventListener('change', onChange));
}
