// @ts-check
/**
 * Test helpers for xoong screens. Framework-agnostic: they use the real DOM
 * and the real data layer, and replace only the network.
 *
 *   import { mount, mockApi } from '@xoong/test'
 *   const api = mockApi(operations, { listUsers: () => [{ id: 1, name: 'Ada' }] })
 *   const screen = await mount('<xo-view get="/users">...</xo-view>', { api })
 *   expect(screen.text('b')).toBe('Ada')
 */
import { configure } from '@xoong/data';
import '@xoong/data/view';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/** Build a Response with a JSON body (problem+json for errors). */
export function respond(status, body) {
  return new Response(body === null || body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

const toRegex = (path) => new RegExp('^' + path.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '([^/]+)') + '$');

/**
 * A fetch replacement driven by operations.json. Handlers are keyed by
 * operationId (or "METHOD /path") and receive { params, query, body }.
 * Return data (200), or respond(status, body). Unhandled operations answer
 * 404 and are listed in `unhandled` so a test can assert nothing unexpected ran.
 *
 * @param {{ operations: Record<string, any> }} table  contents of .xoong/operations.json
 * @param {Record<string, (req: {params: Record<string,string>, query: Record<string,string>, body: any}) => any>} handlers
 */
export function mockApi(table, handlers = {}) {
  const ops = Object.values(table.operations).map((o) => ({ o, re: toRegex(o.path), names: [...o.path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]) }));
  /** @type {{ operation: string, params: any, query: any, body: any }[]} */
  const calls = [];
  /** @type {string[]} */
  const unhandled = [];
  const overrides = { ...handlers };
  async function fetch(url, init = {}) {
    const u = new URL(String(url), 'http://mock');
    const method = (init.method ?? 'GET').toUpperCase();
    const hit = ops.find(({ o, re }) => o.method === method && re.test(u.pathname));
    if (!hit) { unhandled.push(`${method} ${u.pathname}`); return respond(404, { title: 'Not Found', detail: `mockApi: no operation for ${method} ${u.pathname}` }); }
    const m = hit.re.exec(u.pathname);
    const params = Object.fromEntries(hit.names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
    const query = Object.fromEntries(u.searchParams);
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ operation: hit.o.id, params, query, body });
    const handler = overrides[hit.o.id] ?? overrides[`${method} ${hit.o.path}`];
    if (!handler) { unhandled.push(hit.o.id); return respond(404, { title: 'Not Found', detail: `mockApi: no handler for ${hit.o.id}` }); }
    const out = await handler({ params, query, body });
    return out instanceof Response ? out : respond(200, out);
  }
  return {
    fetch, calls, unhandled, table,
    /** Replace or add a handler mid-test. */
    on(id, handler) { overrides[id] = handler; },
    /** Calls of one operation. */
    callsOf: (id) => calls.filter((c) => c.operation === id),
  };
}

/** A controllable EventSource so tests can push live events. */
function createStreamHub() {
  /** @type {Set<any>} */ const sources = new Set();
  class FakeEventSource {
    constructor(url) { this.url = url; sources.add(this); queueMicrotask(() => this.onopen?.()); }
    close() { sources.delete(this); }
  }
  return {
    EventSource: FakeEventSource,
    push: (ev) => sources.forEach((s) => s.onmessage?.({ data: JSON.stringify(ev) })),
    get connections() { return sources.size; },
  };
}

/**
 * Render HTML containing xoong elements against a mocked API.
 * @param {string} html
 * @param {{ api: ReturnType<typeof mockApi>, streamUrl?: string, headers?: any }} options
 */
export async function mount(html, { api, streamUrl = '/events', headers } = {}) {
  if (!api) throw new Error('xoong test: mount() needs { api: mockApi(...) }');
  const hub = createStreamHub();
  const previous = globalThis.EventSource;
  globalThis.EventSource = /** @type {any} */ (hub.EventSource);
  const client = configure({ api: api.table, fetch: /** @type {any} */ (api.fetch), streamUrl, headers, retry: 0, gcTime: Infinity });
  const container = document.createElement('div');
  document.body.append(container);
  container.innerHTML = html;

  /** Wait until requests and reactive updates have settled. */
  async function settle() {
    for (let i = 0; i < 50; i++) {
      await tick(0);
      if (client.pending === 0) { await tick(0); if (client.pending === 0) return; }
    }
    throw new Error('xoong test: requests did not settle (a handler may never resolve)');
  }
  await settle();

  /** @type {any[]} */ const errors = [];
  container.addEventListener('xo-error', (e) => errors.push(/** @type {CustomEvent} */ (e).detail));

  const $ = (sel) => container.querySelector(sel);
  const $$ = (sel) => [...container.querySelectorAll(sel)];
  const screen = {
    container, client, settle, $, $$,
    /** Errors emitted by xo-click/xo-submit (API failures and screen mistakes). */
    errors,
    /** Text content of the first match (whitespace-collapsed). */
    text: (sel) => ($(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    /** Texts of all matches. */
    texts: (sel) => $$(sel).map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()),
    /** Click an element (selector or element) and wait for the app to settle. */
    async click(target) {
      const el = typeof target === 'string' ? $(target) : target;
      if (!el) throw new Error(`xoong test: nothing matches "${target}"`);
      el.click();
      await settle();
    },
    /** Submit a form after filling fields: submit('form', { name: 'Ada' }). */
    async submit(target, fields = {}) {
      const form = /** @type {HTMLFormElement} */ (typeof target === 'string' ? $(target) : target);
      for (const [k, v] of Object.entries(fields)) {
        const input = /** @type {HTMLInputElement} */ (form.elements.namedItem(k));
        if (!input) throw new Error(`xoong test: form has no field "${k}"`);
        input.value = v;
      }
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await settle();
    },
    /** Deliver a live event (as if the server pushed it) and settle. */
    async push(event) { hub.push(event); await settle(); },
    stream: hub,
    unmount() { container.remove(); globalThis.EventSource = previous; },
  };
  return screen;
}
