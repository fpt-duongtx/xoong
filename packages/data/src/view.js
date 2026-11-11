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
 * Variables: `$loading` (a request runs and there is nothing to show yet), `$refreshing` (a request runs and the previous result is still on screen,
 *   for example while a sort or a page loads: the view does not collapse), `$error`.
 *   xo-refresh        on click, fetch this view's data again ("Try again" after an error, a refresh button).
 * Events (bubbling, dispatched on the element that ran the action): `xo-done` {detail: result}, `xo-error` {detail: XoongError}.
 */
import { effect, signal, batch, untracked } from '@xoong/core/signals';
import { XoElement, define } from '@xoong/core';
import { isRef } from './store.js';
import { getClient, acquireStream, configured, whenConfigured } from './default.js';
import { XoongError } from './client.js';
import { idOf } from './store.js';
import { format } from './format.js';
import { urlSync } from './url-state.js';
import './options.js'; // options-op on a combobox or a tag input

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

/**
 * Components that expand into plain markup before binding (used by @xoong/ui).
 * tag -> (el, { host, client, take }) => Node.
 * `take(name)` reads an attribute the component handles and removes it. Every attribute still on the host after
 * expand is copied onto the first element root of the output (ADR-0014): `class` is appended, `style` is the
 * component's declarations then the author's, and any other attribute is the author's.
 */
const templates = new Map();
/** @param {string} tag @param {(el: Element, env: { host: any, client: any, take: (name: string) => string | null }) => Node} expand */
export function defineTemplate(tag, expand) { templates.set(tag, expand); }

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** @typedef {{ value: () => any, parent?: Scope, vars?: Record<string, () => any> }} Scope */

/** "a.b", "a[0].b" and "$form.errors['title.vi']" as steps. */
const steps = new Map(); // a path is split once, not on every read of every row
function splitPath(path) {
  let out = steps.get(path);
  if (!out) {
    steps.set(path, out = []);
    for (const m of path.matchAll(/\[(?:'([^']*)'|"([^"]*)"|(\d+))\]|([^.[\]]+)/g)) out.push(m[1] ?? m[2] ?? m[3] ?? m[4]);
  }
  return out;
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
  #warned = new Set();
  #release = null;
  /** Fetch the selected query again (xo-refresh). */ refresh = () => {};
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
  /** One signal per key asked about, so ticking a row re-runs the checkbox of that row, not of every row. */
  #tick = new Map();
  isSelected(key) { let t = this.#tick.get(key); if (!t) this.#tick.set(key, t = signal(this.#selected.peek().has(key))); return t.value; }
  /** Select or deselect row keys. */
  select(keys, on) {
    const next = new Set(this.#selected.peek());
    batch(() => { for (const k of keys) { on ? next.add(k) : next.delete(k); const t = this.#tick.get(k); if (t) t.value = on; } this.#selected.value = next; });
  }
  clearSelection() { const was = this.#selected.peek(); if (was.size) this.select([...was], false); }

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
    if (!configured()) { // the page's module awaits something before configure(): start when it is called
      whenConfigured(() => { if (this.isConnected) this.#start(); });
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
    // While the next query of this view loads (a sort, a page, a filter), the previous result stays on screen: the page does not collapse
    // and jump. `$refreshing` says it is the old data; `$loading` is only for "nothing to show yet". An error clears it.
    /** @type {any} */ let last;
    let lastRef = '';
    const root = () => {
      const r = q.value?.root.value;
      if (r !== undefined) return (last = r);
      return q.value?.status.value === 'loading' ? last : undefined;
    };
    // The view's own params (p-*) are visible to everything inside it: {sid} works in xo-click/xo-submit.
    /** @type {Scope} */
    const paramsScope = { value: () => this.#params.value };
    /** @type {Scope} */
    const scope = {
      value: root,
      parent: paramsScope,
      vars: {
        $loading: () => q.value?.status.value === 'loading' && root() === undefined,
        $refreshing: () => q.value?.status.value === 'loading' && root() !== undefined,
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
    this.#bound.push(effect(() => {
      this.toggleAttribute('data-refreshing', !!scope.vars?.$refreshing()); // for CSS: the old data is on screen while the new loads
      if (q.value?.status.value === 'loading') this.setAttribute('aria-busy', 'true'); else this.removeAttribute('aria-busy'); // for assistive technology: a request runs ($loading or $refreshing)
    }));

    // A read that fails is told out as xo-error (bubbling, cancelable) from this view, so the screen can handle it in its own code:
    //   view.addEventListener('xo-error', (e) => { e.preventDefault(); ...e.detail is the XoongError... })
    // <xo-toast> shows it unless it was prevented, or `event.handled` says this view shows `$error` itself (or a 401 is left to onUnauthorized).
    const handlesError = /\$error/.test(this.#tpl.map((n) => /** @type {any} */ (n).outerHTML ?? n.textContent).join(''));
    let told;
    this.#bound.push(effect(() => {
      const e = q.value?.status.value === 'error' ? q.value.error.value : undefined;
      if (!e || e === told) return;
      told = e;
      const event = Object.assign(new CustomEvent('xo-error', { detail: e, bubbles: true, composed: true, cancelable: true }), { handled: handlesError || e.status === 401 });
      untracked(() => this.dispatchEvent(event));
    }));
    Object.defineProperty(this, 'error', { get: () => q.value?.error.value ?? null, configurable: true }); // the XoongError of the latest read, or null

    // Select the query and keep it observed while connected.
    let current = null;
    this.#bound.push(effect(() => {
      const ref = this.get;
      const params = this.#params.value;
      current?.release();
      current = null;
      if (ref !== lastRef) { last = undefined; lastRef = ref ?? ''; } // another operation: the old result is not this view's
      q.value = null;
      this.clearSelection(); // other rows are on screen now
      if (!ref) return;
      try { // a path parameter without a value: say so once (the symptom is a request to /users/{id} and an empty screen)
        for (const m of client.op(ref.startsWith('/') ? `GET ${ref}` : ref).path.matchAll(/\{([^}]+)\}/g)) {
          const v = params[m[1]];
          if ((v == null || v === '') && !this.#warned.has(m[1])) { this.#warned.add(m[1]); console.warn(`xoong: <xo-view get="${ref}"> has no value for {${m[1]}}: add p-${m[1]}="..." (or p-${m[1]}=":${m[1]}" from a route)`); }
        }
      } catch { /* an unknown operation is reported by the query below */ }
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
    this.refresh = () => current?.invalidate();
    this.#bound.push(() => { current?.release(); this.refresh = () => {}; });
    // A page past the end (the last row of the last page was deleted, or an old link): go to the last page that exists
    this.#bound.push(effect(() => {
      const { limit, offset } = this.#params.value;
      const total = q.value?.status.value === 'success' ? store.deref(q.value.root.value)?.total : undefined;
      if (typeof total === 'number' && Number(limit) > 0 && Number(offset) > 0 && Number(offset) >= total) this.params = { ...this.#params.peek(), offset: Math.max(0, Math.ceil(total / limit) - 1) * limit };
    }));
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
        const query = sync.read();
        const next = { ...this.#params.peek() };
        let changed = false;
        for (const n of urlNames) {
          const v = query.get(n) ?? '';
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

/**
 * A `{...}` is a binding when its content is a path (`name`, `a.b[0]`, `$loading`, `.`), optionally with `| format`. Braces around anything else
 * (JSON, CSS, a regex `\d{3}`, ICU text) stay as written, and so do `{{name}}` and `\{name}` (a backslash escapes one binding).
 */
const PATH = /^\.?(?:[\p{L}_$@][\p{L}\p{N}_$@-]*)?(?:\.[\p{L}\p{N}_$@-]+|\[(?:\d+|'[^']*'|"[^"]*")\])*$/u;
/** Interpolate `{path}` in a string. Returns null if there is nothing to interpolate. */
const planned = new Map();
function parseInterpolation(text) {
  if (!text.includes('{')) return null;
  let plan = planned.get(text); // a row's text is the template's text: parsed once, not once per row
  if (plan === undefined) planned.set(text, plan = parsePlan(text));
  return plan;
}
function parsePlan(text) {
  const raw = text.split(/(\\?\{[^{}]+\})/); // the odd entries are the `{...}` candidates
  let bound = false;
  const parts = raw.map((p, i) => {
    if (i % 2 === 0) return p;
    if (p[0] === '\\') { bound = true; return p.slice(1); } // (the text changes, so it is not "nothing to interpolate")
    const [path, fmt] = p.slice(1, -1).split('|').map((s) => s.trim()); // {path} or {path | format}
    if (!path || !PATH.test(path) || (raw[i - 1].endsWith('{') && raw[i + 1].startsWith('}'))) return p;
    bound = true;
    return fmt ? { path, fmt } : { path };
  });
  return bound ? parts.filter((p) => p !== '') : null;
}
const evalParts = (parts, scope, lookup) => {
  let text = '';
  for (const p of parts) { // no intermediate array: a binding re-runs often
    if (typeof p === 'string') text += p;
    else { const v = lookup(scope, p.path); text += p.fmt ? format(p.fmt, v) : v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); }
  }
  return text;
};

function bindNode(node, scope, ctx, disposers) {
  const { lookup } = ctx;
  if (node.nodeType === 3) {
    const parts = parseInterpolation(node.data);
    if (parts) disposers.push(effect(() => { const text = evalParts(parts, scope, lookup); if (node.data !== text) node.data = text; })); // an identical write still wakes observers and costs layout
    return;
  }
  if (node.nodeType !== 1) return;
  const el = /** @type {Element} */ (node);
  if (el.localName === 'script' || el.localName === 'style') return;

  const expand = templates.get(el.localName);
  if (expand) {
    let out;
    try {
      out = expand(el, { host: ctx.host, client: ctx.client, take: (n, v = el.getAttribute(n)) => (el.removeAttribute(n), v) });
    } catch (e) {
      console.error(e); // a typo in the screen: say so, leave a marker, keep the rest of the screen alive
      ctx.host.emit('xo-error', e);
      el.replaceWith(document.createComment(`<${el.localName}> failed: ${e.message}`));
      return;
    }
    const nodes = out.nodeType === 11 ? [...out.childNodes] : [out], root = nodes.find((n) => n.nodeType === 1) || el; // replaceWith moves a fragment's children out, so remember them first. No element root: copy onto the host, which replaceWith then removes
    for (const n of el.getAttributeNames()) root.setAttribute(n, ((n === 'class' || n === 'style') && root.getAttribute(n) ? root.getAttribute(n) + (n === 'class' ? ' ' : ';') : '') + el.getAttribute(n));
    el.replaceWith(out);
    for (const n of nodes) bindNode(n, scope, ctx, disposers);
    return;
  }
  if (el.hasAttribute('xo-each')) return bindEach(el, scope, ctx, disposers);
  if (el.hasAttribute('xo-if')) return bindIf(el, scope, ctx, disposers);

  // xo-t: translate this element; its `{placeholders}` come from the scope. Without @xoong/i18n the text is bound as written.
  let translated = false;
  if (el.hasAttribute('xo-t') && translator) {
    const t = translator;
    translated = t.hasText(el.getAttribute('xo-t') ?? ''); // only a translated *text* replaces the children; attribute-only translations leave them bound
    disposers.push(effect(() => t.apply(el, (name) => ctx.lookup(scope, name))));
  }
  let childScope = scope;
  // getAttributeNames(), not `attributes`: iterating `attributes` makes the browser create an Attr node for every attribute of every row and keep it as long as the row lives
  for (const name of el.getAttributeNames()) {
    const value = el.getAttribute(name) ?? '';
    if (name === 'xo-click' || name === 'xo-submit') {
      const engine = bindAction(el, name === 'xo-click' ? 'click' : 'submit', value, scope, ctx, disposers);
      if (engine) childScope = { value: () => engine.model.value, parent: scope, vars: { $form: () => engine.model } }; // `$form.dirty`, `$form.errors['title.vi']` ... inside the form
      continue;
    }
    if (name === 'xo-add' || name === 'xo-remove' || name === 'xo-move') {
      bindArrayAction(el, name, value, scope, ctx, disposers);
      continue;
    }
    if (name === 'xo-drag') {
      bindDrag(el, value, scope, ctx);
      continue;
    }
    if (name === 'xo-select') {
      bindSelect(el, value, scope, ctx, disposers);
      continue;
    }
    if (name === 'xo-param') {
      bindParam(el, value, scope, ctx, disposers);
      continue;
    }
    if (name === 'xo-refresh') {
      const refresh = () => ctx.host.refresh();
      el.addEventListener('click', refresh);
      disposers.push(() => el.removeEventListener('click', refresh));
      continue;
    }
    if (name === 'xo-body' || name === 'xo-keep' || name === 'xo-optimistic' || name === 'xo-selected' || name === 'xo-with' || name === 'xo-confirm' || name === 'xo-notice' || name === 'xo-then' || name === 'xo-t') continue;
    const parts = parseInterpolation(value);
    if (parts) {
      if (isScriptAttr(name)) {
        console.error(`xoong: refusing to interpolate data into the "${name}" attribute (it executes code)`);
        el.removeAttribute(name);
        continue;
      }
      if (BOOLEAN_ATTRS.has(name) && parts.length === 1 && typeof parts[0] !== 'string') { // hidden="{closed}": present when true, absent when false
        const path = parts[0].path;
        disposers.push(effect(() => {
          const v = lookup(scope, path);
          const on = Array.isArray(v) ? v.length > 0 : !!v && v !== 'false';
          el.toggleAttribute(name, on);
          if ((name === 'checked' || name === 'selected') && name in el) /** @type {any} */ (el)[name] = on; // the attribute only sets the default state
        }));
        continue;
      }
      disposers.push(effect(() => {
        let v = evalParts(parts, scope, lookup);
        if (URL_ATTRS.has(name) && !isSafeUrl(v, name === 'src' && (el.localName === 'img' || el.localName === 'xo-image'))) v = 'about:blank';
        if (el.getAttribute(name) !== v) el.setAttribute(name, v);
      }));
    }
  }
  if (el.localName === 'xo-view') return; // a nested view binds its own children against its own data when it starts; the outer pass must not touch them (its `p-*` attributes above are bound to the outer scope)
  if (!translated) for (const child of [...el.childNodes]) bindNode(child, childScope, ctx, disposers); // a translated element's text is the message, not markup
}

/** Boolean attributes: `{flag}` as the whole value turns them on and off (an attribute with the value "false" would still count as set). */
const BOOLEAN_ATTRS = new Set(['hidden', 'disabled', 'checked', 'selected', 'readonly', 'required', 'open', 'multiple', 'inert', 'autofocus', 'controls', 'loop', 'muted', 'reversed']);

/** Attributes whose value is a URL: data must not smuggle in script schemes. */
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'poster', 'xlink:href', 'data', 'cite', 'srcset']);
const isScriptAttr = (name) => name.startsWith('on') || name === 'srcdoc';
/**
 * Allow relative URLs and http(s)/mailto/tel; reject javascript:, data:, vbscript: (even if obfuscated with whitespace).
 * A picture (`image`: `<img src>`, `<xo-image src>`) may also be a blob: URL (an upload preview) or a data:image/ raster (never svg).
 */
function isSafeUrl(value, image = false) {
  const compact = value.replace(/[\u0000-\u0020\u007f-\u009f]/g, '').toLowerCase();
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(compact)?.[1];
  return !scheme || ['http', 'https', 'mailto', 'tel'].includes(scheme) || (image && /^(blob:|data:image\/(png|jpeg|gif|webp|avif)[;,])/.test(compact));
}
/** `xo-then` goes to a page of this site: a relative path or a same-origin URL, and nothing `isSafeUrl` refuses. */
function ownPage(path) {
  if (!isSafeUrl(path)) return false;
  try { return new URL(path, location.href).origin === location.origin; } catch { return !/^\s*[/\\]{2}|^[a-z][a-z0-9+.-]*:/i.test(path); }
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
  // `<template xo-each="blocks">...</template>` repeats its children with no element of its own (a list of mixed blocks: h2, p, ul, figure)
  const fragmentRows = el.localName === 'template';
  const tpl = /** @type {Element} */ (el.cloneNode(true));
  tpl.removeAttribute('xo-each');
  const start = document.createComment('xo-each');
  const end = document.createComment('/xo-each');
  el.replaceWith(start, end);
  /** A row is the nodes from `first` to `last` (one element, or the children of a template between two comments). */
  /** @typedef {{ first: Node, last: Node, stops: (() => void)[], index: ReturnType<typeof signal>, current: ReturnType<typeof signal>, frag?: DocumentFragment }} Row */
  /** @type {Map<string, Row>} */
  let rows = new Map();
  const nodesOf = (/** @type {Row} */ row) => { const out = [row.first]; for (let n = row.first; n !== row.last && n.nextSibling; ) { n = /** @type {Node} */ (n.nextSibling); out.push(n); } return out; };
  const dropRow = (/** @type {Row} */ row) => { row.stops.forEach((s) => s()); for (const n of nodesOf(row)) n.remove(); };
  // Built outside the effect on purpose: a closure made inside it keeps that run's `next` map (and so every row of that run, deleted ones too) alive for as long as the row lives.
  const makeRow = (item, i) => {
    const index = signal(i);
    const current = signal(item);
    // `$index` is the nearest row; `$i0`, `$i1` ... are the rows of the enclosing `xo-each`s, outermost first (names of nested array fields)
    let depth = 0;
    for (let s = scope; s; s = s.parent) if (s.vars?.$index) depth++;
    const itemScope = { value: () => current.value, parent: scope, vars: { $index: () => index.value, $n: () => index.value + 1, [`$i${depth}`]: () => index.value } };
    const stops = [];
    if (fragmentRows) {
      const frag = document.createDocumentFragment(), first = document.createComment('xo-row'), last = document.createComment('/xo-row');
      frag.append(first, .../** @type {HTMLTemplateElement} */ (tpl).content.cloneNode(true).childNodes, last);
      batch(() => { for (const n of [...frag.childNodes]) if (n !== first && n !== last) bindNode(n, itemScope, ctx, stops); });
      return { first, last, stops, index, current, frag };
    }
    const node = /** @type {Element} */ (tpl.cloneNode(true));
    batch(() => bindNode(node, itemScope, ctx, stops));
    return { first: node, last: node, stops, index, current };
  };
  disposers.push(effect(() => {
    const list = ctx.lookup(scope, path);
    const items = (Array.isArray(list) ? list : []).filter((it) => !isRef(it) || ctx.client.store.has(it)); // drop deleted entities
    // Do not subscribe this effect to row internals: bind rows untracked by their own effects.
    const next = new Map();
    // Rows that are gone leave first: otherwise each row after a deleted one finds a stranger in its place and is moved, so deleting one row of a thousand moved a thousand.
    const keys = items.map((item, i) => (isRef(item) ? item.$ref : `#${i}`)), keep = new Set(keys);
    for (const [key, row] of rows) if (!keep.has(key)) dropRow(row);
    /** @type {Node} */ let cursor = start;
    // New rows are inserted together (one DOM change, one record for every observer on the page) just before the next row that was already there
    /** @type {DocumentFragment | null} */ let pending = null;
    /** @type {Node} */ let anchor = start;
    const flush = () => { if (pending) anchor.after(pending); pending = null; };
    items.forEach((item, i) => {
      const key = keys[i];
      let row = rows.get(key) ?? next.get(key);
      const fresh = !row;
      if (!row) row = makeRow(item, i);
      else { // a reused row follows its new position and item; an entity is the same item while its key is the same (its fields are read from the store)
        const cur = row.current.peek();
        batch(() => { row.index.value = i; if (isRef(item) ? cur?.$ref !== key : cur !== item) row.current.value = item; });
      }
      next.set(key, row);
      if (fresh) { if (!pending) { pending = document.createDocumentFragment(); anchor = cursor; } pending.append(row.frag ?? row.first); } // a fresh row is one element, or the fragment of a template row
      else { flush(); if (cursor.nextSibling !== row.first) cursor.after(...nodesOf(row)); }
      row.frag = undefined;
      cursor = row.last;
    });
    flush();
    rows = next;
  }));
  disposers.push(() => { for (const row of rows.values()) dropRow(row); rows.clear(); });
}

/** `@xoong/i18n` registers how `xo-t` elements are translated (the view supplies the scope for `{placeholders}`). */
let translator = /** @type {{ apply: (el: Element, get: (name: string) => any) => void, hasText: (spec: string) => boolean } | null} */ (null);
/** @param {{ apply: (el: Element, get: (name: string) => any) => void, hasText: (spec: string) => boolean }} t */
export function setTranslator(t) { translator = t; }

/** Ask before a destructive action (`xo-confirm="Delete {name}?"`). The default is the browser's confirm(); @xoong/ui replaces it with a native <dialog>. */
let confirmFn = /** @type {(message: string, context?: { kind: 'action' | 'leave', element?: Element, forms?: Element[] }) => boolean | Promise<boolean>} */ ((message) => (typeof globalThis.confirm === 'function' ? globalThis.confirm(message) : true));
/**
 * Replace the confirmation dialog (for `xo-confirm` and for leaving a page with unsaved changes) with your own: return, or resolve to, true to go on.
 * The second argument says what is being asked: `{ kind: 'action', element }` or `{ kind: 'leave', forms }`.
 * @param {(message: string, context?: { kind: 'action' | 'leave', element?: Element, forms?: Element[] }) => boolean | Promise<boolean>} fn
 */
export function setConfirm(fn) { confirmFn = fn; }
/** Ask the person a yes/no question with whatever confirm is installed. */
export const ask = (message, context) => Promise.resolve(confirmFn(message, context));

/** What a form's call returns when the form is invalid and nothing was sent. */
const INVALID = { invalid: true, errors: {} };

function bindAction(el, eventName, opRef, scope, ctx, disposers) {
  const { client, lookup, host } = ctx;
  let busy = false;
  // The events come from the element that ran the action, so they bubble through a dialog or panel around it up to the view (and the page).
  // An element the result just removed (a deleted row) cannot bubble: the view reports for it.
  const emit = (name, detail) => (el.isConnected ? el : host).dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true, cancelable: true })); // xo-error can be prevented: the screen handled it
  // A <form xo-submit> whose operation has a request schema gets the form model (ADR-0009): prefill, typed values, validation, dirty tracking.
  // It is attached now, not at the first click, so fields are filled and completed before anyone touches the form.
  let engine = null;
  if (eventName === 'submit' && formEngine) {
    let op0 = null;
    try { op0 = client.op(opRef); } catch { /* reported when the form is submitted */ }
    if (op0?.bodySchema) {
      const bodyPath = el.getAttribute('xo-body');
      // An edit form (the operation has path parameters, is a PUT or PATCH, or xo-body names a record) starts from that record; a create form starts empty.
      const edits = !!bodyPath || /\{[^}]+\}/.test(op0.path) || op0.method === 'PUT' || op0.method === 'PATCH';
      const record = edits ? () => { const plain = client.store.denormalize(lookup(scope, bodyPath ?? '.')); return plain && typeof plain === 'object' ? plain : undefined; } : undefined;
      engine = formEngine.attach(el, { schema: op0.bodySchema, record, hadRecord: edits });
      disposers.push(() => engine.detach());
    }
  }
  const handler = async (event) => {
    if (eventName === 'submit') event.preventDefault();
    if (busy) return;
    const confirmText = el.getAttribute('xo-confirm'); // ask first; {path} names the item ("Delete {title}?")
    if (confirmText !== null && !(await ask(evalParts(parseInterpolation(confirmText) ?? [confirmText], scope, lookup), { kind: 'action', element: el }))) return;
    busy = true;
    el.setAttribute('aria-busy', 'true');
    try {
      const ref = opRef;
      const op = client.op(ref);
      if (!engine) clearFieldErrors(el);
      else el.querySelectorAll?.('[data-xo-summary]').forEach((n) => n.remove()); // the last failure's summary: this is a new attempt
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
          const abort = host.beginStream();
          try { await host.consume(client.stream(ref, params, body, { signal: abort })); } catch (e) { if (abort.aborted) return undefined; throw e; } // view gone: stop quietly
          finally { if (!abort.aborted) client.invalidateAll(); } // the stream may have changed data that is on screen, even if it failed halfway
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
      if (results[0] === INVALID) { emit('xo-invalid', { errors: INVALID.errors }); return; } // nothing was sent; the form showed why
      const result = bulk ? results : results[0];
      if (!engine && eventName === 'submit' && !el.hasAttribute('xo-keep')) /** @type {HTMLFormElement} */ (el).reset?.(); // a sent form starts empty again
      emit('xo-done', result);
      const then = el.getAttribute('xo-then'); // go on to another page: `{field}` comes from the result (a created record), then from the item acted on
      if (then !== null) {
        const resultScope = { value: () => (Array.isArray(result) ? undefined : result), parent: scope };
        const path = evalParts(parseInterpolation(then) ?? [then], resultScope, lookup);
        if (!ownPage(path)) console.error(`xoong: xo-then goes to this site only, not to "${path}"`);
        else if (el.dispatchEvent(new CustomEvent('xo-go', { bubbles: true, cancelable: true, detail: { path } }))) location.assign(path); // <xo-router> handles it and cancels the default
      }
      if (noticeText) emit('xo-notice', { message: noticeText, kind: 'success' }); // shown by <xo-toast>
    } catch (e) {
      // API failures are expected flows (events + global onError). Anything else is a bug in the screen.
      if (!(e instanceof XoongError)) console.error(e);
      else if (engine) { if (!Object.keys(e.fields ?? {}).length) showFieldErrors(el, {}, e.detail ?? e.message); } // field messages are on the paths; others as a summary
      else showFieldErrors(el, e.fields, e.detail ?? e.message);
      emit('xo-error', e);
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
  const summarize = (message) => { const n = note(message, 'alert'); n.dataset.xoSummary = ''; form.append(n); };
  if (!placed && summary) summarize(summary);
  else if (unplaced.length) summarize(unplaced.map(([name, message]) => `${name}: ${message}`).join('; ')); // no input for these
}

function bindParam(el, spec, scope, ctx, disposers) {
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

/** The marker comment that opens the xo-each list a row belongs to (null when `node` is not a row). */
const listStart = (node) => {
  for (let n = node.previousSibling; n; n = n.previousSibling) if (n.nodeType === 8) return n.data === 'xo-each' ? n : null;
  return null;
};
/** The rows of the list `row` belongs to, in order. */
function rowsOf(row) {
  const rows = [];
  for (let n = listStart(row)?.nextSibling; n && !(n.nodeType === 8 && n.data === '/xo-each'); n = n.nextSibling) if (n.nodeType === 1) rows.push(n);
  return rows;
}
/** The innermost list row that holds `el`, the rows of its list and its position among them. */
function rowContext(el) {
  let row = el;
  while (row && !listStart(row)) row = row.parentElement;
  const rows = row ? rowsOf(row) : [];
  return { row, rows, at: row ? rows.indexOf(row) : -1 };
}
/** The button with the same action spec inside another row. */
const sameButton = (row, attr, spec) => [...row.querySelectorAll(`[${attr}]`)].find((b) => b.getAttribute(attr) === spec);

/**
 * `xo-drag="blocks[{$index}]"` on a handle inside an array row: drag the row onto another row of the same list to move it. The buttons (xo-move) remain
 * for keyboards and touch; this is the pointer shortcut. The handle describes itself on demand (the index changes as rows move).
 */
const DRAG = 'application/x-xoong-row';
function bindDrag(el, spec, scope, ctx) {
  el.draggable = true;
  el.xoDrag = () => ({ text: evalParts(parseInterpolation(spec) ?? [spec], scope, ctx.lookup), model: ctx.lookup(scope, '$form') });
  el.addEventListener('dragstart', (event) => {
    event.dataTransfer?.setData(DRAG, el.xoDrag().text);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    rowContext(el).row?.classList.add('xo-dragging');
  });
  el.addEventListener('dragend', () => document.querySelectorAll('.xo-dragging, .xo-drop').forEach((n) => n.classList.remove('xo-dragging', 'xo-drop')));
}
if (typeof document !== 'undefined') {
  const split = (text) => { const m = /^(.*)\[(\d+)\]$/.exec(text); return m ? { list: m[1], index: Number(m[2]) } : null; };
  const handleOf = (target) => rowContext(target).row?.querySelector('[xo-drag]');
  document.addEventListener('dragover', (event) => {
    if (!event.dataTransfer?.types.includes(DRAG)) return;
    const over = handleOf(event.target);
    if (!over) return;
    event.preventDefault(); // this row accepts the drop
    for (const n of document.querySelectorAll('.xo-drop')) if (n !== rowContext(over).row) n.classList.remove('xo-drop');
    rowContext(over).row?.classList.add('xo-drop');
  });
  document.addEventListener('drop', (event) => {
    const from = event.dataTransfer?.getData(DRAG);
    const target = handleOf(/** @type {Element} */ (event.target));
    if (!from || !target) return;
    event.preventDefault();
    const { text, model } = target.xoDrag();
    const a = split(from);
    const b = split(text);
    document.querySelectorAll('.xo-dragging, .xo-drop').forEach((n) => n.classList.remove('xo-dragging', 'xo-drop'));
    if (a && b && a.list === b.list && a.index !== b.index) model?.moveItem(from, b.index - a.index); // only within one list
  });
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
    } else if (kind === 'xo-remove') {
      const { row, rows, at } = rowContext(el);
      const area = row?.closest('fieldset, form');
      model.removeAt(text);
      // the focus must not fall to the page: it goes to the same button of the row now at that position, else the previous one, else the list's add button
      const survivor = rows.find((r) => r.isConnected);
      const left = survivor ? rowsOf(survivor) : [];
      const next = left[at] ?? left[at - 1];
      (next ? sameButton(next, kind, spec) : area?.querySelector('[xo-add]'))?.focus();
    } else {
      const m = /^(.*):(up|down|-?\d+)$/.exec(text);
      if (!m) { console.error(`xoong: xo-move="${text}" is not "path:up" or "path:down"`); return; }
      const delta = m[2] === 'up' ? -1 : m[2] === 'down' ? 1 : Number(m[2]);
      const { rows, at } = rowContext(el);
      model.moveItem(m[1], delta);
      // rows follow their index, so the moved item's row is the one at the new position: keep the focus on the same button there
      if (rows[at + delta]) sameButton(rows[at + delta], kind, spec)?.focus();
    }
  };
  el.addEventListener('click', handler);
  disposers.push(() => el.removeEventListener('click', handler));
}
