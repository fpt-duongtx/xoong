// @ts-check
/**
 * <xo-view> — declare a screen in HTML (Draft syntax, see docs/data-layer.md).
 *
 *   <xo-view get="/users/{id}" p-id="42" live>
 *     <p xo-if="$loading">Loading…</p>
 *     <p xo-if="$error">{$error.detail}</p>
 *     <h2>{name}</h2>
 *     <ul><li xo-each="tags">{.}</li></ul>
 *     <button xo-click="POST /users/{id}/disable">Disable</button>
 *   </xo-view>
 *
 * Syntax (the whole language):
 *   {path}            text or attribute interpolation. `.` = current item,
 *                     `$loading`, `$error`, `$index` are view variables.
 *   xo-each="path"    repeat the element per item (keyed by entity id).
 *   xo-if="path"      render only when truthy ("!path" negates).
 *   xo-click="OP"     call an operation on click. OP is "METHOD /path/{param}"
 *                     or an operationId. Params come from the current scope.
 *   xo-submit="OP"    same, on form submit; body = the form fields.
 *   xo-body="path"    (xo-click) take the request body from the scope.
 *   xo-optimistic="f=v,g=w"  (on xo-click) set these fields on the current item right away; undone if the call fails.
 *   xo-keep           (xo-submit) keep the field values after a successful send (default: the form is reset).
 *   xo-param="name"    on an <input>/<select>: set the view param `name` to its value as it changes (empty removes it).
 *   xo-param="k=v"     on click, set a view param and refetch: `k=v`, `k+=n`, `k-=n` (never below 0),
 *                     `k~=v` (toggle between `v` and `-v`, for sorting). `{path}` in v is resolved.
 * Events (bubbling): `xo-done` {detail: result}, `xo-error` {detail: XoongError}.
 */
import { effect, signal, batch } from '@xoong/core/signals';
import { XoElement, define } from '@xoong/core';
import { isRef } from './store.js';
import { getClient, acquireStream } from './default.js';
import { XoongError } from './client.js';

/** Components that expand into plain markup before binding (used by @xoong/ui). tag -> (el, { host, client }) => Node */
const templates = new Map();
/** @param {string} tag @param {(el: Element, env: { host: any, client: any }) => Node} expand */
export function defineTemplate(tag, expand) { templates.set(tag, expand); }

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** @typedef {{ value: () => any, parent?: Scope, vars?: Record<string, () => any> }} Scope */

function makeResolver(store) {
  const lookup = (scope, path) => {
    if (path === '.' || path === '') return store.deref(scope.value());
    const [head, ...rest] = path.split('.');
    if (head.startsWith('$')) {
      for (let s = scope; s; s = s.parent) if (s.vars?.[head]) return walk(s.vars[head](), rest);
      return undefined;
    }
    for (let s = scope; s; s = s.parent) {
      const base = store.deref(s.value());
      if (base && typeof base === 'object' && head in base) return walk(base[head], rest);
    }
    return undefined;
  };
  const walk = (v, rest) => {
    for (const k of rest) {
      v = store.deref(v);
      if (v == null) return undefined;
      v = v[k];
    }
    return store.deref(v);
  };
  return lookup;
}

class XoView extends XoElement {
  static props = { get: String };

  /** @type {Node[] | null} */ #tpl = null;
  /** @type {(() => void)[]} */ #bound = [];
  #params = signal(/** @type {Record<string, any>} */ ({}));
  #release = null;
  /** @type {AbortController | null} */ #streamCtl = null;
  #stream = signal(/** @type {any[]} */ ([]));
  #streaming = signal(false);
  /** Keys ("User#1") of the rows ticked by xo-select checkboxes. */
  #selected = signal(/** @type {Set<string>} */ (new Set()));

  /** Refs of the selected rows that still exist. */
  selectedRefs() {
    const store = getClient().store;
    return [...this.#selected.value].map((k) => ({ $ref: k })).filter((r) => store.has(r));
  }
  isSelected(key) { return this.#selected.value.has(key); }
  /** Select or deselect row keys. */
  select(keys, on) {
    const next = new Set(this.#selected.peek());
    for (const k of keys) { if (on) next.add(k); else next.delete(k); }
    this.#selected.value = next;
  }
  clearSelection() { if (this.#selected.peek().size) this.#selected.value = new Set(); }

  /** Start a streamed call: cancels the previous one, and everything is cancelled when the view goes away. */
  beginStream() {
    this.#streamCtl?.abort();
    this.#streamCtl = new AbortController();
    return this.#streamCtl.signal;
  }

  /** Collect the events of a streamed call into `$stream` (each: the JSON payload plus `event`, or `{ event, data }`). */
  async consume(events) {
    batch(() => { this.#stream.value = []; this.#streaming.value = true; });
    try {
      for await (const ev of events) {
        const item = ev.json && typeof ev.json === 'object' && !Array.isArray(ev.json) ? { event: ev.event, ...ev.json } : { event: ev.event, data: ev.data };
        this.#stream.value = [...this.#stream.peek(), item];
      }
    } finally { this.#streaming.value = false; }
  }

  /** Runtime params for the operation (overrides `p-*` attributes). */
  get params() { return this.#params.value; }
  set params(v) { this.#params.value = { ...v }; }

  connected() {
    // Children may not exist yet when the element is connected (HTML parser,
    // some DOM implementations). Start once the tree is complete.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.isConnected && this.#start(), { once: true });
    } else {
      queueMicrotask(() => this.isConnected && this.#start());
    }
  }

  disconnected() {
    this.#stop();
  }

  #stop() {
    this.#streamCtl?.abort();
    this.#streamCtl = null;
    this.#bound.splice(0).forEach((d) => d());
    this.#release?.();
    this.#release = null;
  }

  #start() {
    this.#stop();
    const client = getClient();
    const store = client.store;
    const lookup = makeResolver(store);
    if (!this.#tpl) {
      // Prerendered pages (@xoong/ssr) keep the original markup in a <template data-xo-template>; the rendered rows around
      // it are only there for the first paint and are replaced when the view starts.
      const saved = this.firstElementChild?.localName === 'template' && this.firstElementChild.hasAttribute('data-xo-template') ? /** @type {HTMLTemplateElement} */ (this.firstElementChild) : null;
      this.#tpl = [...(saved ? saved.content.childNodes : this.childNodes)].map((n) => n.cloneNode(true));
      const initial = {};
      for (const a of this.attributes) {
        if (!a.name.startsWith('p-')) continue;
        // p-id="?id" reads ?id=... from the page URL (public pages that show one item); an absent or empty query parameter is left out
        if (a.value.startsWith('?')) { const v = new URLSearchParams(globalThis.location?.search).get(a.value.slice(1)); if (v) initial[camel(a.name.slice(2))] = v; } else initial[camel(a.name.slice(2))] = a.value;
      }
      this.#params.value = { ...initial, ...this.#params.peek() };
    }
    const q = signal(/** @type {any} */ (null));
    const root = () => q.value?.root.value;
    // The view's own params (p-*) are visible to everything inside it: {sid} works in xo-click/xo-submit.
    /** @type {Scope} */
    const paramsScope = { value: () => this.#params.value };
    /** @type {Scope} */
    const scope = {
      value: root,
      parent: paramsScope,
      vars: {
        $loading: () => q.value?.status.value === 'loading',
        // Events of the latest streamed call (an operation that answers with server-sent events), and whether it still runs.
        $stream: () => this.#stream.value,
        $streaming: () => this.#streaming.value,
        $selectedCount: () => this.selectedRefs().length,
        $error: () => q.value?.error.value,
        // Paging state for lists that take `limit` and `offset` and return `total`.
        $hasPrev: () => Number(this.#params.value.offset) > 0,
        $hasNext: () => {
          const { limit, offset = 0 } = this.#params.value;
          const total = root() && store.deref(root())?.total;
          return limit != null && typeof total === 'number' && Number(offset) + Number(limit) < total;
        },
      },
    };
    this.replaceChildren(...this.#tpl.map((n) => n.cloneNode(true)));
    const ctx = { client, lookup, host: this };
    for (const child of [...this.childNodes]) bindNode(child, scope, ctx, this.#bound);

    // Select the query and keep it observed while connected.
    let current = null;
    this.#bound.push(effect(() => {
      const ref = this.get;
      const params = this.#params.value;
      current?.release();
      current = null;
      q.value = null;
      this.clearSelection(); // other rows are on screen now
      if (!ref) return;
      try {
        current = client.query(ref.startsWith('/') ? `GET ${ref}` : ref, params); // "/users" or an operationId
      } catch (e) {
        console.error(e); // misconfigured view: report, but do not break the flush loop
        this.emit('xo-error', e);
        return;
      }
      q.value = current;
      current.retain();
    }));
    this.#bound.push(() => current?.release());
    if (this.hasAttribute('live')) this.#release = acquireStream();
  }
}
define('xo-view', XoView);
export { XoView };

/** Interpolate `{path}` in a string. Returns null if there is nothing to interpolate. */
function parseInterpolation(text) {
  if (!text.includes('{')) return null;
  const parts = text.split(/(\{[^{}]+\})/).filter((p) => p !== '');
  if (!parts.some((p) => /^\{[^{}]+\}$/.test(p))) return null;
  return parts.map((p) => (/^\{[^{}]+\}$/.test(p) ? { path: p.slice(1, -1).trim() } : p));
}
const evalParts = (parts, scope, lookup) =>
  parts.map((p) => (typeof p === 'string' ? p : (v => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)))(lookup(scope, p.path)))).join('');

function bindNode(node, scope, ctx, disposers) {
  const { lookup } = ctx;
  if (node.nodeType === 3) {
    const parts = parseInterpolation(node.data);
    if (parts) disposers.push(effect(() => { node.data = evalParts(parts, scope, lookup); }));
    return;
  }
  if (node.nodeType !== 1) return;
  const el = /** @type {Element} */ (node);
  if (el.localName === 'script' || el.localName === 'style') return;

  const expand = templates.get(el.localName);
  if (expand) {
    let out;
    try {
      out = expand(el, { host: ctx.host, client: ctx.client });
    } catch (e) {
      console.error(e); // a typo in the screen: say so, leave a marker, keep the rest of the screen alive
      ctx.host.emit('xo-error', e);
      el.replaceWith(document.createComment(`<${el.localName}> failed: ${e.message}`));
      return;
    }
    el.replaceWith(out);
    for (const n of out.nodeType === 11 ? [...out.childNodes] : [out]) bindNode(n, scope, ctx, disposers);
    return;
  }
  if (el.hasAttribute('xo-each')) return bindEach(el, scope, ctx, disposers);
  if (el.hasAttribute('xo-if')) return bindIf(el, scope, ctx, disposers);

  for (const attr of [...el.attributes]) {
    if (attr.name === 'xo-click' || attr.name === 'xo-submit') {
      bindAction(el, attr.name === 'xo-click' ? 'click' : 'submit', attr.value, scope, ctx, disposers);
      continue;
    }
    if (attr.name === 'xo-select') {
      bindSelect(el, attr.value, scope, ctx, disposers);
      continue;
    }
    if (attr.name === 'xo-param') {
      bindParam(el, attr.value, scope, ctx, disposers);
      continue;
    }
    if (attr.name === 'xo-body' || attr.name === 'xo-keep' || attr.name === 'xo-optimistic' || attr.name === 'xo-selected') continue;
    const parts = parseInterpolation(attr.value);
    if (parts) {
      const name = attr.name;
      if (isScriptAttr(name)) {
        console.error(`xoong: refusing to interpolate data into the "${name}" attribute (it executes code)`);
        el.removeAttribute(name);
        continue;
      }
      disposers.push(effect(() => {
        let v = evalParts(parts, scope, lookup);
        if (URL_ATTRS.has(name) && !isSafeUrl(v)) v = 'about:blank';
        if (el.getAttribute(name) !== v) el.setAttribute(name, v);
      }));
    }
  }
  for (const child of [...el.childNodes]) bindNode(child, scope, ctx, disposers);
}

/** Attributes whose value is a URL: data must not smuggle in script schemes. */
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'poster', 'xlink:href', 'data', 'cite', 'srcset']);
const isScriptAttr = (name) => name.startsWith('on') || name === 'srcdoc';
/** Allow relative URLs and http(s)/mailto/tel; reject javascript:, data:, vbscript: (even if obfuscated with whitespace). */
function isSafeUrl(value) {
  const compact = value.replace(/[\u0000-\u0020\u007f-\u009f]/g, '').toLowerCase();
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(compact)?.[1];
  return !scheme || ['http', 'https', 'mailto', 'tel'].includes(scheme);
}

function bindIf(el, scope, ctx, disposers) {
  const expr = el.getAttribute('xo-if').trim();
  const negate = expr.startsWith('!');
  const path = negate ? expr.slice(1).trim() : expr;
  const tpl = el.cloneNode(true);
  tpl.removeAttribute('xo-if');
  const marker = document.createComment('xo-if');
  el.replaceWith(marker);
  /** @type {{ node: Element, stops: (() => void)[] } | null} */
  let shown = null;
  disposers.push(effect(() => {
    const v = ctx.lookup(scope, path);
    const truthy = Array.isArray(v) ? v.length > 0 : !!v;
    const want = negate ? !truthy : truthy;
    if (want && !shown) {
      const node = /** @type {Element} */ (tpl.cloneNode(true));
      const stops = [];
      marker.after(node);
      bindNode(node, scope, ctx, stops);
      shown = { node, stops };
    } else if (!want && shown) {
      shown.stops.forEach((s) => s());
      shown.node.remove();
      shown = null;
    }
  }));
  disposers.push(() => { shown?.stops.forEach((s) => s()); shown?.node.remove(); shown = null; });
}

function bindEach(el, scope, ctx, disposers) {
  const path = el.getAttribute('xo-each').trim();
  const tpl = /** @type {Element} */ (el.cloneNode(true));
  tpl.removeAttribute('xo-each');
  const start = document.createComment('xo-each');
  const end = document.createComment('/xo-each');
  el.replaceWith(start, end);
  /** @type {Map<string, { node: Element, stops: (() => void)[], index: ReturnType<typeof signal>, current: ReturnType<typeof signal> }>} */
  let rows = new Map();
  disposers.push(effect(() => {
    const list = ctx.lookup(scope, path);
    const items = (Array.isArray(list) ? list : []).filter((it) => !isRef(it) || ctx.client.store.has(it)); // drop deleted entities
    // Do not subscribe this effect to row internals: bind rows untracked by their own effects.
    const next = new Map();
    let cursor = start;
    items.forEach((item, i) => {
      const key = isRef(item) ? item.$ref : `#${i}`;
      let row = rows.get(key) ?? next.get(key);
      if (!row) {
        const node = /** @type {Element} */ (tpl.cloneNode(true));
        const index = signal(i);
        const current = signal(item);
        const itemScope = { value: () => current.value, parent: scope, vars: { $index: () => index.value } };
        const stops = [];
        batch(() => bindNode(node, itemScope, ctx, stops));
        row = { node, stops, index, current };
      } else batch(() => { row.index.value = i; row.current.value = item; }); // reused row follows its new item
      next.set(key, row);
      if (cursor.nextSibling !== row.node) cursor.after(row.node);
      cursor = row.node;
    });
    for (const [key, row] of rows) if (!next.has(key)) { row.stops.forEach((s) => s()); row.node.remove(); }
    rows = next;
  }));
  disposers.push(() => { for (const row of rows.values()) { row.stops.forEach((s) => s()); row.node.remove(); } rows.clear(); });
}

function bindAction(el, eventName, opRef, scope, ctx, disposers) {
  const { client, lookup, host } = ctx;
  let busy = false;
  const handler = async (event) => {
    if (eventName === 'submit') event.preventDefault();
    if (busy) return;
    busy = true;
    el.setAttribute('aria-busy', 'true');
    try {
      const ref = opRef;
      const op = client.op(ref);
      clearFieldErrors(el);
      /** One call, with the params and body taken from `sc` (the button's scope, or one selected row). */
      const callOnce = async (sc) => {
        const params = {};
        for (const m of op.path.matchAll(/\{([^}]+)\}/g)) params[m[1]] = lookup(sc, m[1]);
        for (const q of op.query ?? []) { const v = lookup(sc, q); if (v !== undefined) params[q] = v; }
        let body;
        if (eventName === 'submit' && op.body === true) body = formBody(/** @type {HTMLFormElement} */ (el), op);
        else if (el.hasAttribute('xo-body')) body = client.store.denormalize(lookup(sc, el.getAttribute('xo-body')));
        if (op.stream) {
          const signal = host.beginStream();
          try { await host.consume(client.stream(ref, params, body, { signal })); } catch (e) { if (signal.aborted) return undefined; throw e; } // view gone: stop quietly
          finally { if (!signal.aborted) client.invalidateAll(); } // the stream may have changed data that is on screen, even if it failed halfway
          return undefined;
        }
        return client.mutate(ref, params, body, { optimistic: optimisticOf(el, sc, ctx) });
      };
      // xo-selected: the same operation once for every ticked row (sequentially; the first failure stops the rest).
      const bulk = el.hasAttribute('xo-selected');
      const targets = bulk ? host.selectedRefs().map((r) => ({ value: () => r, parent: scope })) : [scope];
      if (!targets.length) return;
      const results = [];
      for (const sc of targets) results.push(await callOnce(sc));
      if (bulk) host.clearSelection();
      const result = bulk ? results : results[0];
      if (eventName === 'submit' && !el.hasAttribute('xo-keep')) /** @type {HTMLFormElement} */ (el).reset?.(); // a sent form starts empty again
      host.emit('xo-done', result);
    } catch (e) {
      // API failures are expected flows (events + global onError). Anything else is a bug in the screen.
      if (!(e instanceof XoongError)) console.error(e);
      else showFieldErrors(el, e.fields, e.detail ?? e.message);
      host.emit('xo-error', e);
    } finally {
      busy = false;
      el.removeAttribute('aria-busy');
    }
  };
  el.addEventListener(eventName, handler);
  disposers.push(() => el.removeEventListener(eventName, handler));
}

/** The JSON body of a form. With `bodyFields` from the API document, values get their real types. */
function formBody(form, op) {
  const raw = new FormData(form);
  if (op.multipart) { // files stay files; the client sends it as multipart/form-data
    for (const [name, value] of [...raw]) if (typeof value !== 'string' && !value.name && !value.size) raw.delete(name); // no file chosen
    return raw;
  }
  const body = {};
  const types = new Map((op.bodyFields ?? []).map((f) => [f.name, f.type]));
  for (const [name, value] of raw) {
    if (typeof value !== 'string') continue;
    const type = types.get(name);
    if (type === 'integer' || type === 'number') { if (value !== '') body[name] = Number(value); }
    else if (type === 'boolean') body[name] = true; // an unchecked checkbox is not in FormData
    else if (type && value === '' && !op.bodyFields.find((f) => f.name === name)?.required) continue; // optional and empty: omit
    else body[name] = value;
  }
  for (const [name, type] of types) if (type === 'boolean' && !(name in body)) body[name] = false;
  return body;
}

function clearFieldErrors(form) {
  if (form.localName !== 'form') return;
  form.querySelectorAll('[data-xo-error]').forEach((n) => n.remove());
  form.querySelectorAll('[aria-invalid]').forEach((n) => { n.removeAttribute('aria-invalid'); n.removeAttribute('aria-describedby'); });
}

/** Mark each named field invalid and put the server's message next to it; with no field to blame, show it under the form. */
function showFieldErrors(form, fields = {}, summary = '') {
  if (form.localName !== 'form') return;
  const note = (message, role) => {
    const el = document.createElement('small');
    el.className = 'xo-error';
    el.dataset.xoError = '';
    el.textContent = message;
    if (role) el.setAttribute('role', role);
    return el;
  };
  let placed = 0;
  for (const [name, message] of Object.entries(fields)) {
    const input = [...form.elements].find((f) => f.name === name);
    if (!input) continue;
    const el = note(message);
    el.id = `xo-err-${name}-${Math.random().toString(36).slice(2, 7)}`;
    input.after(el);
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', el.id);
    placed++;
  }
  const unplaced = Object.entries(fields).filter(([name]) => ![...form.elements].some((f) => f.name === name));
  if (!placed && summary) form.append(note(summary, 'alert'));
  else if (unplaced.length) form.append(note(unplaced.map(([name, message]) => `${name}: ${message}`).join('; '), 'alert')); // no input for these
}

function bindParam(el, spec, scope, ctx, disposers) {
  if (/^[\w-]+$/.test(spec.trim()) && ['input', 'select', 'textarea'].includes(el.localName)) { // a filter control
    const name = camel(spec.trim());
    let timer;
    const apply = () => {
      const params = { ...ctx.host.params };
      if (el.value === '') delete params[name]; else params[name] = el.value;
      if ('offset' in params) params.offset = 0;
      ctx.host.params = params;
    };
    const onInput = () => { clearTimeout(timer); timer = setTimeout(apply, el.localName === 'select' ? 0 : 250); }; // wait for the typing to pause
    const type = el.localName === 'select' ? 'change' : 'input';
    el.addEventListener(type, onInput);
    disposers.push(() => { clearTimeout(timer); el.removeEventListener(type, onInput); });
    return;
  }
  const m = /^\s*([\w-]*\w)\s*(\+=|-=|~=|=)\s*(.*?)\s*$/.exec(spec);
  if (!m) { console.error(`xoong: xo-param="${spec}" is not "name=value", "name+=n", "name-=n" or "name~=value"`); return; }
  const [, rawName, op, rawValue] = m;
  const name = camel(rawName);
  const handler = () => {
    const value = evalParts(parseInterpolation(rawValue) ?? [rawValue], scope, ctx.lookup);
    const params = { ...ctx.host.params };
    const cur = params[name];
    if (op === '=') params[name] = value;
    else if (op === '~=') params[name] = cur === value ? `-${value}` : value; // asc, then desc, then asc ...
    else params[name] = Math.max(0, (Number(cur) || 0) + (op === '+=' ? 1 : -1) * Number(value));
    if (name !== 'offset' && 'offset' in params) params.offset = 0; // a new filter or sort starts at the first page
    ctx.host.params = params;
  };
  el.addEventListener('click', handler);
  disposers.push(() => el.removeEventListener('click', handler));
}

/** `xo-optimistic="status=disabled,note={text}"` -> [{ $ref, patch }] for the current item, or undefined. */
function optimisticOf(el, scope, ctx) {
  const spec = el.getAttribute('xo-optimistic');
  if (!spec) return undefined;
  const ref = scope.value();
  if (!isRef(ref)) { console.error('xoong: xo-optimistic needs a stored entity as the current item (put the button inside xo-each over entities)'); return undefined; }
  const patch = {};
  for (const pair of spec.split(',')) {
    const m = /^\s*([\w.-]+)\s*=\s*(.*?)\s*$/.exec(pair);
    if (m) patch[m[1]] = evalParts(parseInterpolation(m[2]) ?? [m[2]], scope, ctx.lookup);
  }
  return Object.keys(patch).length ? [{ $ref: ref.$ref, patch }] : undefined;
}

/** `xo-select` on a checkbox in a row ticks that row; `xo-select="all:items"` in the header ticks every row of the list. */
function bindSelect(el, spec, scope, ctx, disposers) {
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
