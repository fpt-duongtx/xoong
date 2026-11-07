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
 *   xo-keep           (xo-submit) keep the field values after a successful send (default: the form is reset).
 * Events (bubbling): `xo-done` {detail: result}, `xo-error` {detail: XoongError}.
 */
import { effect, signal, batch } from '@xoong/core/signals';
import { XoElement, define } from '@xoong/core';
import { isRef } from './store.js';
import { getClient, acquireStream } from './default.js';
import { XoongError } from './client.js';

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
      this.#tpl = [...this.childNodes].map((n) => n.cloneNode(true));
      const initial = {};
      for (const a of this.attributes) if (a.name.startsWith('p-')) initial[camel(a.name.slice(2))] = a.value;
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
        $error: () => q.value?.error.value,
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

  if (el.hasAttribute('xo-each')) return bindEach(el, scope, ctx, disposers);
  if (el.hasAttribute('xo-if')) return bindIf(el, scope, ctx, disposers);

  for (const attr of [...el.attributes]) {
    if (attr.name === 'xo-click' || attr.name === 'xo-submit') {
      bindAction(el, attr.name === 'xo-click' ? 'click' : 'submit', attr.value, scope, ctx, disposers);
      continue;
    }
    if (attr.name === 'xo-body' || attr.name === 'xo-keep') continue;
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
      const params = {};
      for (const m of op.path.matchAll(/\{([^}]+)\}/g)) params[m[1]] = lookup(scope, m[1]);
      for (const q of op.query ?? []) { const v = lookup(scope, q); if (v !== undefined) params[q] = v; }
      let body;
      if (eventName === 'submit' && op.body === true) body = Object.fromEntries(new FormData(/** @type {HTMLFormElement} */ (el)));
      else if (el.hasAttribute('xo-body')) body = client.store.denormalize(lookup(scope, el.getAttribute('xo-body')));
      const result = await client.mutate(ref, params, body);
      if (eventName === 'submit' && !el.hasAttribute('xo-keep')) /** @type {HTMLFormElement} */ (el).reset?.(); // a sent form starts empty again
      host.emit('xo-done', result);
    } catch (e) {
      // API failures are expected flows (events + global onError). Anything else is a bug in the screen.
      if (!(e instanceof XoongError)) console.error(e);
      host.emit('xo-error', e);
    } finally {
      busy = false;
      el.removeAttribute('aria-busy');
    }
  };
  el.addEventListener(eventName, handler);
  disposers.push(() => el.removeEventListener(eventName, handler));
}
