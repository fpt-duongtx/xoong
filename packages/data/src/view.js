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
import { idOf } from './store.js';
import { format } from './format.js';
import { urlSync } from './url-state.js';

/** Where `p-id=":id"` finds route parameters (set by the router in @xoong/ui). */
let paramSource = /** @type {((name: string) => string | undefined) | null} */ (null);
/** Views that use `p-x=":param"` and started before the router did (element definition order): they start when it is ready. */
const waitingForRouter = /** @type {(() => void)[]} */ ([]);
/** @param {(name: string) => string | undefined} fn */
export function setParamSource(fn) {
  paramSource = fn;
  for (const start of waitingForRouter.splice(0)) start();
}

/** The forms package registers its binder here: any `xo-submit` form whose operation has a request schema then uses the form model. */
let formEngine = /** @type {{ attach: Function } | null} */ (null);
/** @param {{ attach: Function }} engine */
export function setFormEngine(engine) { formEngine = engine; }

/** Components that expand into plain markup before binding (used by @xoong/ui). tag -> (el, { host, client }) => Node */
const templates = new Map();
/** @param {string} tag @param {(el: Element, env: { host: any, client: any }) => Node} expand */
export function defineTemplate(tag, expand) { templates.set(tag, expand); }

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** @typedef {{ value: () => any, parent?: Scope, vars?: Record<string, () => any> }} Scope */

/** "a.b", "a[0].b" and "$form.errors['title.vi']" as steps. */
function splitPath(path) {
  const steps = [];
  for (const m of path.matchAll(/\[(?:'([^']*)'|"([^"]*)"|(\d+))\]|([^.[\]]+)/g)) steps.push(m[1] ?? m[2] ?? m[3] ?? m[4]);
  return steps;
}

function makeResolver(store) {
  const lookup = (scope, path) => {
    if (path === '.' || path === '') return store.deref(scope.value());
    const [head, ...rest] = splitPath(path);
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

  /** Names listed in `url-params`: those params live in the page's query string (shareable, survive reload and Back). */
  #urlNames() { return (this.getAttribute('url-params') ?? '').split(',').map((s) => s.trim()).filter(Boolean); }
  /** How the next change of a url-param is written: 'push' for a click, 'replace' for typing (set by the control, reset after use). */
  urlMode = 'replace';

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
    if (!paramSource && [...this.attributes].some((a) => a.name.startsWith('p-') && a.value.startsWith(':'))) {
      waitingForRouter.push(() => { if (this.isConnected) this.#start(); }); // a route view whose router is not running yet: wait for it
      return;
    }
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
        if (a.value.startsWith(':')) { const v = paramSource?.(a.value.slice(1)); if (v) initial[camel(a.name.slice(2))] = v; continue; } // p-id=":id": a route parameter
        if (a.value.startsWith('?')) { const v = new URLSearchParams(globalThis.location?.search).get(a.value.slice(1)); if (v) initial[camel(a.name.slice(2))] = v; } else initial[camel(a.name.slice(2))] = a.value;
      }
      const q = this.#urlNames().length ? urlSync().read() : null; // url-params: the page URL wins over fixed p-* values
      for (const n of this.#urlNames()) if (q?.get(n)) initial[n] = q.get(n);
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
        $selected: () => this.selectedRefs().map((r) => store.denormalize(r)), // the ticked rows, for xo-body="$selected"
        $error: () => q.value?.error.value,
        // Paging state for lists that take `limit` and `offset` and return `total`.
        $hasPrev: () => Number(this.#params.value.offset) > 0,
        $from: () => Number(this.#params.value.offset ?? 0) + 1,
        $to: () => {
          const { limit, offset = 0 } = this.#params.value;
          const total = root() && store.deref(root())?.total;
          return limit == null ? undefined : typeof total === 'number' ? Math.min(Number(offset) + Number(limit), total) : Number(offset) + Number(limit);
        },
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
    const urlNames = this.#urlNames();
    if (urlNames.length) {
      const sync = urlSync();
      let first = true;
      this.#bound.push(effect(() => {
        const params = this.#params.value;
        const next = new URLSearchParams(sync.read());
        for (const n of urlNames) { const v = params[n]; if (v == null || v === '') next.delete(n); else next.set(n, String(v)); }
        const mode = first ? 'replace' : this.urlMode;
        first = false;
        this.urlMode = 'replace';
        sync.write(next, mode);
      }));
      // Back/Forward (or anything else that changes the query): read it into the params
      this.#bound.push(sync.subscribe(() => {
        const q = sync.read();
        const next = { ...this.#params.peek() };
        let changed = false;
        for (const n of urlNames) {
          const v = q.get(n) ?? '';
          if (String(next[n] ?? '') !== v) { changed = true; if (v === '') delete next[n]; else next[n] = v; }
        }
        if (changed) this.#params.value = next;
      }));
    }
    if (this.hasAttribute('live')) this.#release = acquireStream();
  }
}
define('xo-view', XoView);
export { XoView };
export { setFormat } from './format.js';
export { setUrlSync } from './url-state.js';

/** Interpolate `{path}` in a string. Returns null if there is nothing to interpolate. */
function parseInterpolation(text) {
  if (!text.includes('{')) return null;
  const parts = text.split(/(\{[^{}]+\})/).filter((p) => p !== '');
  if (!parts.some((p) => /^\{[^{}]+\}$/.test(p))) return null;
  return parts.map((p) => {
    if (!/^\{[^{}]+\}$/.test(p)) return p;
    const [path, fmt] = p.slice(1, -1).split('|').map((s) => s.trim()); // {path} or {path | format}
    return fmt ? { path, fmt } : { path };
  });
}
const evalParts = (parts, scope, lookup) =>
  parts.map((p) => {
    if (typeof p === 'string') return p;
    const v = lookup(scope, p.path);
    return p.fmt ? format(p.fmt, v) : v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  }).join('');

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

  let childScope = scope;
  for (const attr of [...el.attributes]) {
    if (attr.name === 'xo-click' || attr.name === 'xo-submit') {
      const engine = bindAction(el, attr.name === 'xo-click' ? 'click' : 'submit', attr.value, scope, ctx, disposers);
      if (engine) childScope = { value: () => engine.model.value, parent: scope, vars: { $form: () => engine.model } }; // `$form.dirty`, `$form.errors['title.vi']` ... inside the form
      continue;
    }
    if (attr.name === 'xo-add' || attr.name === 'xo-remove' || attr.name === 'xo-move') {
      bindArrayAction(el, attr.name, attr.value, scope, ctx, disposers);
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
    if (attr.name === 'xo-body' || attr.name === 'xo-keep' || attr.name === 'xo-optimistic' || attr.name === 'xo-selected' || attr.name === 'xo-with' || attr.name === 'xo-confirm' || attr.name === 'xo-notice') continue;
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
  for (const child of [...el.childNodes]) bindNode(child, childScope, ctx, disposers);
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
  // `xo-if="type=image"` / `xo-if="status!=draft"`: compare a path with a literal (the text of the value; quotes optional)
  const cmp = /^(.+?)\s*(!?=)\s*(?:'([^']*)'|"([^"]*)"|(.*?))\s*$/.exec(expr);
  const negate = cmp ? cmp[2] === '!=' : expr.startsWith('!');
  const path = cmp ? cmp[1].trim() : negate ? expr.slice(1).trim() : expr;
  const literal = cmp ? (cmp[3] ?? cmp[4] ?? cmp[5]) : undefined;
  const tpl = el.cloneNode(true);
  tpl.removeAttribute('xo-if');
  const marker = document.createComment('xo-if');
  el.replaceWith(marker);
  /** @type {{ node: Element, stops: (() => void)[] } | null} */
  let shown = null;
  disposers.push(effect(() => {
    const v = ctx.lookup(scope, path);
    const truthy = literal !== undefined ? String(v ?? '') === literal : Array.isArray(v) ? v.length > 0 : !!v;
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
        // `$index` is the nearest row; `$i0`, `$i1` ... are the rows of the enclosing `xo-each`s, outermost first (names of nested array fields)
        let depth = 0;
        for (let s = scope; s; s = s.parent) if (s.vars?.$index) depth++;
        const itemScope = { value: () => current.value, parent: scope, vars: { $index: () => index.value, [`$i${depth}`]: () => index.value } };
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

/** Ask before a destructive action (`xo-confirm="Delete {name}?"`). The default is the browser's confirm(); @xoong/ui replaces it with a native <dialog>. */
let confirmFn = /** @type {(message: string) => boolean | Promise<boolean>} */ ((message) => (typeof globalThis.confirm === 'function' ? globalThis.confirm(message) : true));
/** @param {(message: string) => boolean | Promise<boolean>} fn */
export function setConfirm(fn) { confirmFn = fn; }
/** Ask the person a yes/no question with whatever confirm is installed. */
export const ask = (message) => Promise.resolve(confirmFn(message));

/** What a form's call returns when the form is invalid and nothing was sent. */
const INVALID = { invalid: true, errors: {} };

function bindAction(el, eventName, opRef, scope, ctx, disposers) {
  const { client, lookup, host } = ctx;
  let busy = false;
  // A <form xo-submit> whose operation has a request schema gets the form model (ADR-0009): prefill, typed values, validation, dirty tracking.
  // It is attached now, not at the first click, so fields are filled and completed before anyone touches the form.
  let engine = null;
  if (eventName === 'submit' && formEngine) {
    let op0 = null;
    try { op0 = client.op(opRef); } catch { /* reported when the form is submitted */ }
    if (op0?.bodySchema) {
      const bodyPath = el.getAttribute('xo-body');
      // An edit form (the operation has path parameters, or xo-body names a record) starts from that record; a create form starts empty.
      const edits = !!bodyPath || /\{[^}]+\}/.test(op0.path);
      const record = edits ? () => { const plain = client.store.denormalize(lookup(scope, bodyPath ?? '.')); return plain && typeof plain === 'object' ? plain : undefined; } : undefined;
      engine = formEngine.attach(el, { schema: op0.bodySchema, record, hadRecord: edits });
      disposers.push(() => engine.detach());
    }
  }
  const handler = async (event) => {
    if (eventName === 'submit') event.preventDefault();
    if (busy) return;
    const confirmText = el.getAttribute('xo-confirm'); // ask first; {path} names the item ("Delete {title}?")
    if (confirmText !== null && !(await ask(evalParts(parseInterpolation(confirmText) ?? [confirmText], scope, lookup)))) return;
    busy = true;
    el.setAttribute('aria-busy', 'true');
    try {
      const ref = opRef;
      const op = client.op(ref);
      if (!engine) clearFieldErrors(el);
      /** One call, with the params and body taken from `sc` (the button's scope, or one selected row). */
      const callOnce = async (sc) => {
        const params = {};
        for (const m of op.path.matchAll(/\{([^}]+)\}/g)) params[m[1]] = lookup(sc, m[1]);
        for (const q of op.query ?? []) { const v = lookup(sc, q); if (v !== undefined) params[q] = v; }
        let body;
        if (engine && op.body === true) { // the model validates, normalises and sends; an invalid form sends nothing
          const out = await engine.submit((b) => client.mutate(ref, params, b, { optimistic: optimisticOf(el, sc, ctx) }));
          if (!out.ok) { INVALID.errors = out.errors; return INVALID; }
          return out.result;
        }
        if (eventName === 'submit' && op.body === true) body = formBody(/** @type {HTMLFormElement} */ (el), op);
        else if (el.hasAttribute('xo-body')) body = client.store.denormalize(lookup(sc, el.getAttribute('xo-body')));
        const extra = withOf(el, sc, ctx, op);
        const idsField = el.getAttribute('xo-selected'); // "ids": one request carrying the ticked ids, instead of one request per row
        if (idsField) body = { ...(body ?? {}), ...extra, [idsField]: host.selectedRefs().map((r) => selectedId(client, r)) };
        else if (extra) body = { ...(body ?? {}), ...extra };
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
      const oneRequest = !!el.getAttribute('xo-selected');
      const targets = bulk && !oneRequest ? host.selectedRefs().map((r) => ({ value: () => r, parent: scope })) : [scope];
      if (!targets.length || (oneRequest && !host.selectedRefs().length)) return;
      const results = [];
      for (const sc of targets) results.push(await callOnce(sc));
      const notice = el.getAttribute('xo-notice'); // evaluated before the selection is cleared, so {$selectedCount} still counts
      const noticeText = notice === null ? null : evalParts(parseInterpolation(notice) ?? [notice], scope, lookup);
      if (bulk) host.clearSelection();
      if (results[0] === INVALID) { host.emit('xo-invalid', { errors: INVALID.errors }); return; } // nothing was sent; the form showed why
      const result = bulk ? results : results[0];
      if (!engine && eventName === 'submit' && !el.hasAttribute('xo-keep')) /** @type {HTMLFormElement} */ (el).reset?.(); // a sent form starts empty again
      host.emit('xo-done', result);
      if (noticeText) host.emit('xo-notice', { message: noticeText, kind: 'success' }); // shown by <xo-toast>
    } catch (e) {
      // API failures are expected flows (events + global onError). Anything else is a bug in the screen.
      if (!(e instanceof XoongError)) console.error(e);
      else if (engine) { if (!Object.keys(e.fields ?? {}).length) showFieldErrors(el, {}, e.detail ?? e.message); } // field messages are on the paths; others as a summary
      else showFieldErrors(el, e.fields, e.detail ?? e.message);
      host.emit('xo-error', e);
    } finally {
      busy = false;
      el.removeAttribute('aria-busy');
    }
  };
  el.addEventListener(eventName, handler);
  disposers.push(() => el.removeEventListener(eventName, handler));
  return engine;
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
  const m = /^\s*([\w-]*\w)\s*(\+=|-=|~=|=)\s*(.*?)\s*$/.exec(spec);
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
    if (active) { el.setAttribute('aria-current', 'true'); if (op === '~=') el.setAttribute('data-direction', String(cur).startsWith('-') ? 'desc' : 'asc'); }
    else { el.toggleAttribute('aria-current', false); el.toggleAttribute('data-direction', false); }
  }));
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

/** The id of a ticked row as the API knows it (a number stays a number; a composite id is joined), not the "User#5" store key. */
function selectedId(client, ref) {
  const key = ref.$ref;
  const def = client.store.defs[key.slice(0, key.indexOf('#'))];
  const record = client.store.read(key);
  return def && record ? idOf(def.id, record) ?? key.slice(key.indexOf('#') + 1) : key.slice(key.indexOf('#') + 1);
}

/** `xo-with="status=published,reason={why}"` -> { status: 'published', reason: ... }: fixed fields added to the request body. */
function withOf(el, scope, ctx, op) {
  const spec = el.getAttribute('xo-with');
  if (!spec) return undefined;
  const types = new Map((op.bodyFields ?? []).map((f) => [f.name, f.type]));
  const out = {};
  for (const pair of spec.split(',')) {
    const m = /^\s*([\w.-]+)\s*=\s*(.*?)\s*$/.exec(pair);
    if (!m) continue;
    const text = evalParts(parseInterpolation(m[2]) ?? [m[2]], scope, ctx.lookup);
    const type = types.get(m[1]);
    out[m[1]] = type === 'integer' || type === 'number' ? Number(text) : type === 'boolean' ? text === 'true' : text;
  }
  return out;
}

/**
 * Array editing inside a `<form xo-submit>` (the model owns the draft):
 *   <button type="button" xo-add="blocks" xo-with="type=image">Add image</button>      append (a union item needs its tag)
 *   <button type="button" xo-remove="blocks[{$index}]">Remove</button>                  remove this item
 *   <button type="button" xo-move="blocks[{$index}]:up">Up</button>   (or :down)        move this item
 * Plain buttons: keyboard accessible, no drag needed.
 */
function bindArrayAction(el, kind, spec, scope, ctx, disposers) {
  const handler = (event) => {
    event.preventDefault();
    const model = ctx.lookup(scope, '$form');
    if (!model) { console.error(`xoong: ${kind} only works inside a <form xo-submit> whose operation has a request schema`); return; }
    const text = evalParts(parseInterpolation(spec) ?? [spec], scope, ctx.lookup);
    if (kind === 'xo-add') {
      const fields = withOf(el, scope, ctx, { bodyFields: [] });
      model.append(text, fields && Object.keys(fields).length ? fields : undefined);
    } else if (kind === 'xo-remove') model.removeAt(text);
    else {
      const m = /^(.*):(up|down|-?\d+)$/.exec(text);
      if (!m) { console.error(`xoong: xo-move="${text}" is not "path:up" or "path:down"`); return; }
      model.moveItem(m[1], m[2] === 'up' ? -1 : m[2] === 'down' ? 1 : Number(m[2]));
    }
  };
  el.addEventListener('click', handler);
  disposers.push(() => el.removeEventListener('click', handler));
}
