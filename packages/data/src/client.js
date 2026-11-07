// @ts-check
import { signal, computed, batch, disposeComputed } from '@xoong/core/signals';
import { nearest } from '@xoong/core/closest';
import { createStore, normalize } from './store.js';
import { fillPath, pathsOverlap } from './invalidate.js';

/** Normalized API error. Built from application/problem+json when available. */
export class XoongError extends Error {
  /** @param {{status?:number,title?:string,detail?:string,code?:string,retryAfterS?:number,problem?:any,operation?:string,cause?:any,fields?:Record<string,string>}} init */
  constructor({ status = 0, title, detail, code, retryAfterS, problem, operation, cause, fields }) {
    super(detail || title || (status ? `HTTP ${status}` : 'Network error'));
    this.name = 'XoongError';
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.code = code;
    this.retryAfterS = retryAfterS;
    this.problem = problem;
    this.operation = operation;
    /** Per-field messages ({ email: 'is not valid' }) when the server reports them; empty otherwise. */
    this.fields = fields ?? {};
    if (cause) this.cause = cause;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Build an error from a failed response. Understands RFC 9457 problem+json,
 * `{ error: { code, message, retry_after_s, fields } }` envelopes and FastAPI-style
 * `{ detail: [{ loc, msg }] }` validation errors. Field messages end up in `error.fields`.
 */
function fieldErrors(body, env) {
  const out = {};
  const add = (name, msg) => { if (name && msg && !(name in out)) out[String(name)] = String(msg); };
  if (env?.fields && typeof env.fields === 'object') for (const [k, v] of Object.entries(env.fields)) add(k, v);
  if (Array.isArray(body?.detail)) for (const d of body.detail) if (Array.isArray(d?.loc)) add(d.loc.filter((x) => x !== 'body').join('.'), d.msg);
  if (Array.isArray(body?.errors)) for (const e of body.errors) add(e?.field ?? String(e?.pointer ?? '').replace(/^#?\//, '').replace(/\//g, '.'), e?.detail ?? e?.message);
  return out;
}

function errorFromBody(status, statusText, body, operation) {
  const env = body?.error && typeof body.error === 'object' ? body.error : undefined;
  const detail = Array.isArray(body?.detail)
    ? body.detail.map((d) => d?.msg ?? String(d)).join('; ')
    : (typeof body?.detail === 'string' ? body.detail : env?.message ?? body?.message);
  return new XoongError({
    status, operation, problem: body,
    title: body?.title ?? env?.code ?? statusText,
    detail,
    code: env?.code ?? (typeof body?.code === 'string' ? body.code : undefined),
    retryAfterS: env?.retry_after_s ?? undefined,
    fields: fieldErrors(body, env),
  });
}

/** Stable key part for params: sorted keys, undefined/null dropped. */
function canonical(params = {}) {
  const out = {};
  for (const k of Object.keys(params).sort()) if (params[k] != null) out[k] = params[k];
  return JSON.stringify(out);
}

function buildQuery(names = [], params = {}) {
  const sp = new URLSearchParams();
  for (const name of names) {
    const v = params[name];
    if (v == null) continue;
    for (const item of Array.isArray(v) ? v : [v]) sp.append(name, String(item));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/**
 * @typedef {object} Operation
 * @property {string} id
 * @property {string} method
 * @property {string} path
 * @property {string[]} [query]
 * @property {boolean} [body]
 * @property {any} [response] descriptor
 *
 * @typedef {object} ClientOptions
 * @property {{operations: Record<string, Operation>, entities?: Record<string, any>}} api  contents of .xoong/operations.json
 * @property {string} [baseUrl]
 * @property {typeof fetch} [fetch]
 * @property {() => Record<string,string> | Promise<Record<string,string>>} [headers]  per-request headers (auth)
 * @property {RequestCredentials} [credentials]
 * @property {number} [staleTime]  ms a GET result stays fresh (default 30000)
 * @property {number} [gcTime]     ms an unobserved query is kept (default 300000)
 * @property {boolean} [evictEntities] drop entities no cached query refers to when a query is collected (default true)
 * @property {number} [retry]      GET retries on network/502/503/504 (default 2)
 * @property {number} [retryDelay] base delay in ms, doubled per retry (default 300)
 * @property {Record<string,string[]>} [invalidate] extra rules: mutation operationId -> operationIds to invalidate
 * @property {(e: XoongError) => void} [onError]  global error handler
 * @property {(e: XoongError) => void} [onUnauthorized]
 * @property {string} [streamUrl]  SSE endpoint for `live` views
 */

/** @param {ClientOptions} options */
export function createClient(options) {
  const {
    api, baseUrl = '', headers, credentials, staleTime = 30_000, gcTime = 300_000, evictEntities = true,
    retry = 2, retryDelay = 300, invalidate: overrides = {}, onError, onUnauthorized,
  } = options;
  const doFetch = options.fetch ?? globalThis.fetch?.bind(globalThis);
  const store = createStore(api.entities ?? {});
  /** @type {Map<string, Query>} */
  const queries = new Map();
  let mutating = 0;

  const byRoute = new Map();
  for (const op of Object.values(api.operations)) byRoute.set(`${op.method.toUpperCase()} ${op.path}`, op);

  /** Resolve "listUsers" or "GET /users". */
  function op(ref) {
    const found = (Object.hasOwn(api.operations, ref) ? api.operations[ref] : undefined) ?? byRoute.get(ref.replace(/\s+/g, ' ').trim());
    if (!found) {
      const hint = nearest(ref, [...Object.keys(api.operations), ...byRoute.keys()]);
      throw new Error(`xoong: unknown operation "${ref}"${hint ? `. Closest: "${hint}"` : ''}`);
    }
    return found;
  }

  /** JSON by default; FormData (multipart operations) is sent as it is so the browser sets the boundary. */
  function setBody(init, body) {
    if (body === undefined) return;
    if (typeof FormData !== 'undefined' && body instanceof FormData) init.body = body;
    else { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(body); }
  }

  /** Fill the fields the hints declare as idempotency keys with a fresh UUID (one per call, kept by the caller on retry). */
  function withKeys(o, body) {
    if (!o.uuid?.length) return body;
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      for (const f of o.uuid) if (!body.has(f)) body.set(f, crypto.randomUUID());
      return body;
    }
    const out = { ...(body ?? {}) };
    for (const f of o.uuid) if (out[f] == null || out[f] === '') out[f] = crypto.randomUUID();
    return out;
  }

  async function request(o, params, body, signal) {
    const url = baseUrl + fillPath(o.path, params, o.id) + buildQuery(o.query, params);
    const extra = headers ? await headers() : {};
    const init = { method: o.method.toUpperCase(), headers: { accept: 'application/json', ...extra }, signal, credentials };
    setBody(init, body);
    const attempts = o.method.toUpperCase() === 'GET' ? retry : 0;
    for (let n = 0; ; n++) {
      let res;
      try {
        res = await doFetch(url, init);
      } catch (cause) {
        if (signal?.aborted) throw cause;
        if (n < attempts) { await sleep(retryDelay * 2 ** n); continue; }
        throw new XoongError({ operation: o.id, cause });
      }
      if (res.ok) {
        if (res.status === 204) return null;
        const text = await res.text();
        const json = text ? JSON.parse(text) : null;
        if (o.unwrap && json && typeof json === 'object') { // { code, message, data } envelopes
          if (!(o.unwrap in json)) throw new XoongError({ status: res.status, operation: o.id, detail: `the response has no "${o.unwrap}" field (hint "unwrap" expects an envelope)` });
          return json[o.unwrap] ?? null;
        }
        return json;
      }
      if ([502, 503, 504].includes(res.status) && n < attempts) { await sleep(retryDelay * 2 ** n); continue; }
      let problem;
      try { problem = await res.json(); } catch { /* not JSON */ }
      throw errorFromBody(res.status, res.statusText, problem, o.id);
    }
  }

  function fail(err) {
    if (err.status === 401) onUnauthorized?.(err);
    onError?.(err);
  }

  class Query {
    /** @param {Operation} o @param {any} params */
    constructor(o, params) {
      this.op = o;
      this.params = params;
      this.key = `${o.id}:${canonical(params)}`;
      this.path = fillPath(o.path, params, o.id);
      /** normalized root: entity refs inside */
      this.root = signal(undefined);
      this.status = signal(/** @type {'idle'|'loading'|'success'|'error'} */ ('idle'));
      this.error = signal(/** @type {XoongError|null} */ (null));
      this.data = computed(() => store.denormalize(this.root.value));
      this.updatedAt = 0;
      this.stale = true;
      this.observers = 0;
      /** @type {Promise<any>|null} */ this.inflight = null;
      this.refetchAfter = false;
      this.waiters = 0;
      /** @type {AbortController|null} */ this.abort = null;
      this.gcTimer = undefined;
    }
    isFresh() { return !this.stale && Date.now() - this.updatedAt < staleTime; }

    /** Drop this query after gcTime unless something starts observing it. */
    armGc() {
      clearTimeout(this.gcTimer);
      if (!Number.isFinite(gcTime)) return;
      this.gcTimer = setTimeout(() => {
        if (this.observers === 0 && queries.get(this.key) === this) {
          queries.delete(this.key); disposeComputed(this.data);
          if (evictEntities) store.sweep([...queries.values()].map((q) => q.root.peek())); // entities nothing on screen or in cache refers to
        }
      }, gcTime);
      this.gcTimer.unref?.();
    }

    /** Fetch now (deduplicated). Resolves with denormalized data. */
    fetch() {
      if (this.inflight) return this.inflight;
      batch(() => { this.status.value = 'loading'; this.error.value = null; });
      const ctl = new AbortController();
      this.abort = ctl;
      /** @type {Promise<any>} */ let self;
      self = request(this.op, this.params, undefined, ctl.signal)
        .then((json) => {
          batch(() => {
            this.root.value = normalize(store, this.op.response, json);
            this.status.value = 'success';
            this.updatedAt = Date.now();
            this.stale = false;
          });
          return this.data.peek();
        })
        .catch((err) => {
          if (ctl.signal.aborted) { // nobody wants this result any more: back to "not loaded", no error
            if (!this.inflight || this.inflight === self) { // unless a newer fetch of this query already took over
              batch(() => { this.status.value = this.root.peek() === undefined ? 'idle' : 'success'; });
              this.stale = true;
            }
            throw err;
          }
          const e = err instanceof XoongError ? err : new XoongError({ operation: this.op.id, cause: err, detail: String(err?.message ?? err) });
          batch(() => { this.status.value = 'error'; this.error.value = e; });
          fail(e);
          throw e;
        })
        .finally(() => {
          if (this.inflight && this.inflight !== self) return; // a newer fetch owns the query now
          this.inflight = null;
          if (this.refetchAfter) { this.refetchAfter = false; this.fetch().catch(() => {}); }
        });
      this.inflight = self;
      return self;
    }

    /** Start observing (a view is showing this query). Fetches if stale. */
    retain() {
      this.observers++;
      clearTimeout(this.gcTimer);
      if (!this.isFresh()) this.fetch().catch(() => {});
    }
    release() {
      this.observers = Math.max(0, this.observers - 1);
      // The view moved on (params changed or it was removed) while the request runs: cancel it, unless `load()` waits for it.
      if (this.observers === 0 && this.waiters === 0 && this.inflight) {
        this.abort?.abort();
        this.inflight = null; // a retain() right after (same params selected again) must start a fresh request
        this.abort = null;
      }
      if (this.observers === 0) this.armGc();
    }
    /** Mark stale; refetch right away only if something is watching. */
    invalidate() {
      this.stale = true;
      if (this.observers > 0) {
        if (this.inflight) this.refetchAfter = true; else this.fetch().catch(() => {});
      }
    }
  }

  const client = {
    store, op,

    /** Get (or create) the shared Query for an operation + params. Does not fetch. */
    query(ref, params = {}) {
      const o = op(ref);
      if (o.method.toUpperCase() !== 'GET') throw new Error(`xoong: "${o.id}" is a ${o.method} operation; use mutate()`);
      const key = `${o.id}:${canonical(params)}`;
      let q = queries.get(key);
      if (!q) { queries.set(key, (q = new Query(o, params))); q.armGc(); }
      return q;
    },

    /** Fetch a GET operation once (respecting freshness) and resolve with plain data. */
    async load(ref, params = {}) {
      const q = client.query(ref, params);
      if (q.isFresh()) return q.data.peek();
      q.waiters++;
      try { return await q.fetch(); } finally { q.waiters--; }
    },

    /**
     * Call a mutating operation. Upserts returned entities, then invalidates
     * affected queries (path-prefix rule + overrides from `options.invalidate`).
     * `options.optimistic`: [{ $ref: 'User#1', patch: { status: 'disabled' } }] applies a provisional change to loaded entities
     * until the call finishes, and undoes it if the call fails.
     */
    async mutate(ref, params = {}, body, { optimistic } = {}) {
      const o = op(ref);
      if (o.method.toUpperCase() === 'GET') throw new Error(`xoong: "${o.id}" is a GET operation; use query()/load()`);
      let json;
      mutating++;
      // Optimistic updates: show the expected result at once; take it back if the call fails.
      const undo = (optimistic ?? []).map((u) => store.optimistic(u.$ref, u.patch));
      try {
        json = await request(o, params, withKeys(o, body));
      } catch (err) {
        undo.reverse().forEach((u) => u());
        const e = err instanceof XoongError ? err : new XoongError({ operation: o.id, cause: err });
        fail(e);
        throw e;
      } finally {
        mutating--;
      }
      /** @type {any} */ let root;
      batch(() => {
        const touched = new Set();
        root = json == null ? json : normalize(store, o.response, json, touched);
        const concrete = fillPath(o.path, params, o.id);
        const extra = new Set((overrides[o.id] ?? []).map((r) => op(r).id));
        for (const q of queries.values()) {
          if (!(extra.has(q.op.id) || pathsOverlap(q.path, concrete))) continue;
          // The response just rewrote the very entity this detail query shows: it is already fresh.
          const shown = q.root.peek();
          if (!extra.has(q.op.id) && shown && typeof shown.$ref === 'string' && touched.has(shown.$ref)) {
            q.stale = false; q.updatedAt = Date.now();
            continue;
          }
          q.invalidate();
        }
      });
      return store.denormalize(root);
    },

    /**
     * Call an operation that answers with Server-Sent Events (for example a chat
     * reply streamed over POST) and iterate its events:
     *
     *   for await (const ev of client.stream('POST /v1/sessions/{sid}/messages/stream', { sid }, body)) ...
     *
     * Each event is { event, data, json, id }; `json` is `data` parsed when it is valid JSON.
     * Pass { signal } to cancel. Not cached; use a normal operation for data you want in the store.
     */
    async *stream(ref, params = {}, body, { signal } = {}) {
      const o = op(ref);
      const url = baseUrl + fillPath(o.path, params, o.id) + buildQuery(o.query, params);
      const extra = headers ? await headers() : {};
      const init = { method: o.method.toUpperCase(), headers: { accept: 'text/event-stream', ...extra }, signal, credentials };
      setBody(init, withKeys(o, body));
      let res;
      try { res = await doFetch(url, init); } catch (cause) {
        if (signal?.aborted) throw cause;
        const e = new XoongError({ operation: o.id, cause }); fail(e); throw e;
      }
      if (!res.ok) {
        let problem; try { problem = await res.json(); } catch { /* not JSON */ }
        const e = errorFromBody(res.status, res.statusText, problem, o.id); fail(e); throw e;
      }
      if (!res.body) return;
      const reader = res.body.getReader();
      signal?.addEventListener('abort', () => reader.cancel().catch(() => {}), { once: true }); // stop reading even if fetch ignores the signal
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          let m;
          while ((m = /\r?\n\r?\n/.exec(buffer))) {
            const ev = parseSse(buffer.slice(0, m.index));
            buffer = buffer.slice(m.index + m[0].length);
            if (ev) yield ev;
          }
          if (done) { const ev = parseSse(buffer); if (ev) yield ev; return; }
        }
      } finally {
        reader.cancel().catch(() => {});
      }
    },

    /** Invalidate every cached query (e.g. after a stream resync). */
    invalidateAll() {
      for (const q of queries.values()) q.invalidate();
    },

    /** Number of requests in flight (used by test helpers to wait until idle). */
    get pending() { let n = mutating; for (const q of queries.values()) if (q.inflight) n++; return n; },

    /** Number of cached queries (diagnostics). */
    get size() { return queries.size; },
  };
  return client;
}

function parseSse(block) {
  let event = 'message', id, data = [];
  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue;
    const i = line.indexOf(':');
    const field = i < 0 ? line : line.slice(0, i);
    const value = i < 0 ? '' : line.slice(i + 1).replace(/^ /, '');
    if (field === 'event') event = value; else if (field === 'data') data.push(value); else if (field === 'id') id = value;
  }
  if (!data.length) return null;
  const raw = data.join('\n');
  let json; try { json = JSON.parse(raw); } catch { /* plain text */ }
  return { event, data: raw, json, id };
}
