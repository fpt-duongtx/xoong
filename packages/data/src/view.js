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
import { getClient, acquireStream, configured, whenConfigured } from './default.js';
import { urlSync } from './url-state.js';
import { makeResolver, camel } from './scope.js';
import { bindNode } from './bind.js';
import { hasParamSource, routeParam, whenRouterReady } from './state.js';
import './options.js'; // options-op on a combobox or a tag input

// The public hooks of the view live where they are used; they are exported from here, which is where other packages import them.
export { setParamSource } from './state.js';
export { setFormEngine, setConfirm, ask } from './actions.js';
export { defineTemplate, setTranslator } from './bind.js';

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

  /** True when the view cannot start yet (it is told to start again when it can): a route parameter before the router, or a page that has not called configure(). */
  #mustWait() {
    if (!hasParamSource() && [...this.attributes].some((a) => a.name.startsWith('p-') && a.value.startsWith(':'))) {
      whenRouterReady(() => { if (this.isConnected) this.#start(); }); // a route view whose router is not running yet: wait for it
      return true;
    }
    if (!configured()) { // the page's module awaits something before configure(): start when it is called
      whenConfigured(() => { if (this.isConnected) this.#start(); });
      return true;
    }
    return false;
  }

  /** The params the attributes give: `p-id="42"`, `p-id="?id"` (the page URL), `p-id=":id"` (a route parameter), and `url-params` (the page URL wins over fixed values). */
  #paramsOfAttributes() {
    const initial = {};
    for (const a of this.attributes) {
      if (!a.name.startsWith('p-')) continue;
      // p-id="?id" reads ?id=... from the page URL (public pages that show one item); an absent or empty query parameter is left out
      if (a.value.startsWith(':')) { const v = routeParam(a.value.slice(1)); if (v) initial[camel(a.name.slice(2))] = v; continue; } // p-id=":id": a route parameter
      if (a.value.startsWith('?')) { const v = new URLSearchParams(globalThis.location?.search).get(a.value.slice(1)); if (v) initial[camel(a.name.slice(2))] = v; } else initial[camel(a.name.slice(2))] = a.value;
    }
    const q = this.#urlNames().length ? urlSync().read() : null; // url-params: the page URL wins over fixed p-* values
    for (const n of this.#urlNames()) if (q?.get(n)) initial[n] = q.get(n);
    return initial;
  }

  /** The first start: keep the markup as the template of every later start, and read the params the attributes give. */
  #takeTemplate() {
    // Prerendered pages (@xoong/ssr) keep the original markup in a <template data-xo-template>; the rendered rows around
    // it are only there for the first paint and are replaced when the view starts.
    const saved = this.firstElementChild?.localName === 'template' && this.firstElementChild.hasAttribute('data-xo-template') ? /** @type {HTMLTemplateElement} */ (this.firstElementChild) : null;
    this.#tpl = [...(saved ? saved.content.childNodes : this.childNodes)].map((n) => n.cloneNode(true));
    this.#params.value = { ...this.#paramsOfAttributes(), ...this.#params.peek() };
  }

  /**
   * The scope of everything inside the view: the query's result as the current item, then the view's own params (visible to everything inside it: {sid} works in
   * xo-click/xo-submit), with the view variables (`$loading`, `$error`, `$hasNext`...).
   * @param {{ value: any }} q  the selected query, or null  @param {() => any} root  the result to show  @param {any} store
   * @returns {Scope}
   */
  #makeScope(q, root, store) {
    /** @type {Scope} */
    const paramsScope = { value: () => this.#params.value };
    return {
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
  }

  /** Draw the template and bind it; `data-refreshing` and `aria-busy` follow the query. */
  #render(scope, ctx, q) {
    this.replaceChildren(...this.#tpl.map((n) => n.cloneNode(true)));
    for (const child of [...this.childNodes]) bindNode(child, scope, ctx, this.#bound);
    this.#bound.push(effect(() => {
      this.toggleAttribute('data-refreshing', !!scope.vars?.$refreshing()); // for CSS: the old data is on screen while the new loads
      if (q.value?.status.value === 'loading') this.setAttribute('aria-busy', 'true'); else this.removeAttribute('aria-busy'); // for assistive technology: a request runs ($loading or $refreshing)
    }));
  }

  /**
   * A read that fails is told out as xo-error (bubbling, cancelable) from this view, so the screen can handle it in its own code:
   *   view.addEventListener('xo-error', (e) => { e.preventDefault(); ...e.detail is the XoongError... })
   * <xo-toast> shows it unless it was prevented, or `event.handled` says this view shows `$error` itself (or a 401 is left to onUnauthorized).
   */
  #tellErrors(q) {
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
  }

  /** Select the query (it follows `get` and the params) and keep it observed while connected. `shown` remembers the result on screen while the next one loads. */
  #watchQuery(q, client, shown) {
    let current = null;
    this.#bound.push(effect(() => {
      const ref = this.get;
      const params = this.#params.value;
      current?.release();
      current = null;
      if (ref !== shown.ref) { shown.last = undefined; shown.ref = ref ?? ''; } // another operation: the old result is not this view's
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
  }

  /** A page past the end (the last row of the last page was deleted, or an old link): go to the last page that exists. */
  #clampPage(q, store) {
    this.#bound.push(effect(() => {
      const { limit, offset } = this.#params.value;
      const total = q.value?.status.value === 'success' ? store.deref(q.value.root.value)?.total : undefined;
      if (typeof total === 'number' && Number(limit) > 0 && Number(offset) > 0 && Number(offset) >= total) this.params = { ...this.#params.peek(), offset: Math.max(0, Math.ceil(total / limit) - 1) * limit };
    }));
  }

  /** `url-params`: the named params are written to the page URL as they change, and read back when the URL changes (Back, Forward). */
  #syncUrl() {
    const urlNames = this.#urlNames();
    if (!urlNames.length) return;
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

  #start() {
    if (this.#mustWait()) return;
    this.#stop();
    const client = getClient();
    const store = client.store;
    if (!this.#tpl) this.#takeTemplate();
    const q = signal(/** @type {any} */ (null));
    // While the next query of this view loads (a sort, a page, a filter), the previous result stays on screen: the page does not collapse
    // and jump. `$refreshing` says it is the old data; `$loading` is only for "nothing to show yet". An error clears it.
    const shown = { last: /** @type {any} */ (undefined), ref: '' };
    const root = () => {
      const r = q.value?.root.value;
      if (r !== undefined) return (shown.last = r);
      return q.value?.status.value === 'loading' ? shown.last : undefined;
    };
    const scope = this.#makeScope(q, root, store);
    this.#render(scope, { client, lookup: makeResolver(store), host: this }, q);
    this.#tellErrors(q);
    this.#watchQuery(q, client, shown);
    this.#clampPage(q, store);
    this.#syncUrl();
    if (this.hasAttribute('live')) this.#release = acquireStream();
  }
}
define('xo-view', XoView);
export { XoView };
export { setFormat } from './format.js';
export { setUrlSync } from './url-state.js';
