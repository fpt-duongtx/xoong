import { test } from 'vitest';
import assert from 'node:assert/strict';
import { effect } from '@xoong/core/signals';
import { createClient, XoongError, derived, connectStream, configure } from '../src/index.js';
import { setPointer } from '../src/pointer.js';
import { api, fakeFetch, json, tick } from './helpers.mjs';

const users = () => [{ id: 1, name: 'Ada', role: 'admin' }, { id: 2, name: 'Bob', role: 'user' }];

test('load caches by operation + canonical params (key order irrelevant)', async () => {
  const f = fakeFetch({ 'GET /users': () => users() });
  const c = createClient({ api, fetch: f });
  await c.load('listUsers', { page: 1, tag: 'a' });
  await c.load('GET /users', { tag: 'a', page: 1 });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].search, '?page=1&tag=a');
  await c.load('listUsers', { page: 2 });
  assert.equal(f.calls.length, 2);
});

test('unknown operation gives a hint', () => {
  const c = createClient({ api, fetch: fakeFetch({}) });
  assert.throws(() => c.query('GET /user'), /Closest: "GET \/users"/);
  assert.throws(() => c.query('listUser'), /Closest: "listUsers"/);
});

test('missing path param names the param', async () => {
  const c = createClient({ api, fetch: fakeFetch({}) });
  await assert.rejects(() => c.load('getUser', {}), /path parameter "id"/);
});

test('one entity, many screens: list and detail share a record', async () => {
  const f = fakeFetch({
    'GET /users': () => users(),
    'GET /users/1': () => ({ id: 1, name: 'Ada Lovelace', role: 'admin', bio: 'x' }),
  });
  const c = createClient({ api, fetch: f });
  await c.load('listUsers');
  const list = c.query('listUsers');
  const seen = [];
  effect(() => seen.push(list.data.value[0].name));
  await c.load('getUser', { id: 1 });
  assert.deepEqual(seen, ['Ada', 'Ada Lovelace']); // list view updated without refetching the list
  assert.equal(f.calls.filter((x) => x.key === 'GET /users').length, 1);
  assert.equal(list.data.peek()[0].bio, 'x'); // merged fields
});

test('nested entities are normalized and shared', async () => {
  const f = fakeFetch({
    'GET /orders': () => ({ items: [{ id: 10, total: 5, customer: { id: 1, name: 'Ada' } }], page: 1 }),
    'GET /users/1': () => ({ id: 1, name: 'Ada L' }),
  });
  const c = createClient({ api, fetch: f });
  const data = await c.load('listOrders');
  assert.equal(data.items[0].customer.name, 'Ada');
  assert.equal(data.page, 1);
  await c.load('getUser', { id: 1 });
  assert.equal(c.query('listOrders').data.peek().items[0].customer.name, 'Ada L');
});

test('mutation upserts the entity and refetches observed queries only', async () => {
  let name = 'Ada';
  const f = fakeFetch({
    'GET /users': () => [{ id: 1, name }],
    'GET /users/1': () => ({ id: 1, name }),
    'GET /users/2': () => ({ id: 2, name: 'Bob' }),
    'GET /dashboard': () => ({ n: 1 }),
    'POST /users/1/disable': () => { name = 'Ada (disabled)'; return { id: 1, name }; },
  });
  const c = createClient({ api, fetch: f });
  const list = c.query('listUsers'); list.retain(); await list.inflight;
  await c.load('getUser', { id: 2 });          // not observed
  await c.load('getDashboard');                 // unrelated
  const before = f.calls.length;
  const result = await c.mutate('disableUser', { id: 1 });
  assert.equal(result.name, 'Ada (disabled)');
  await tick(5);
  const after = f.calls.slice(before).map((x) => x.key);
  assert.deepEqual(after.filter((k) => k !== 'POST /users/1/disable'), ['GET /users']); // observed list only
  // unobserved but related query is stale; unrelated and other-id queries stay fresh
  assert.equal(c.query('getUser', { id: 2 }).isFresh(), true);
  assert.equal(c.query('getDashboard').isFresh(), true);
  list.release();
});

test('invalidate override from config', async () => {
  const f = fakeFetch({ 'GET /dashboard': () => ({ n: 1 }), 'POST /orders/5/ship': () => null });
  const c = createClient({ api, fetch: f, invalidate: { shipOrder: ['getDashboard'] } });
  await c.load('getDashboard');
  await c.mutate('shipOrder', { id: 5 });
  assert.equal(c.query('getDashboard').isFresh(), false);
});

test('in-flight requests are deduplicated; invalidate during flight refetches after', async () => {
  let n = 0;
  const f = fakeFetch({ 'GET /dashboard': async () => { n++; await tick(10); return { n }; } });
  const c = createClient({ api, fetch: f });
  const q = c.query('getDashboard');
  q.retain();
  q.retain();
  assert.equal(n, 1);
  q.invalidate();
  for (let i = 0; i < 100 && q.data.peek()?.n !== 2; i++) await tick(10); // poll: a fixed wait is flaky under parallel load
  assert.equal(n, 2);
  assert.equal(q.data.peek().n, 2);
});

test('errors are normalized from problem+json; handlers fire', async () => {
  const seen = [], unauth = [];
  const f = fakeFetch({
    'GET /users': () => json(401, { title: 'Unauthorized', detail: 'token expired' }),
    'POST /users': () => json(422, { title: 'Invalid', detail: 'name required' }),
  });
  const c = createClient({ api, fetch: f, onError: (e) => seen.push(e), onUnauthorized: (e) => unauth.push(e) });
  await assert.rejects(() => c.load('listUsers'), (e) => e instanceof XoongError && e.status === 401 && e.detail === 'token expired');
  assert.equal(unauth.length, 1);
  await assert.rejects(() => c.mutate('createUser', {}, {}), (e) => e.status === 422 && e.operation === 'createUser');
  assert.equal(seen.length, 2);
  const q = c.query('listUsers');
  assert.equal(q.status.peek(), 'error');
  assert.equal(q.error.peek().status, 401);
});

test('GET retries transient failures; mutations do not', async () => {
  let g = 0, p = 0;
  const f = fakeFetch({
    'GET /users': () => (++g < 3 ? json(503, { title: 'busy' }) : users()),
    'POST /users': () => { p++; return json(503, { title: 'busy' }); },
  });
  const c = createClient({ api, fetch: f, retryDelay: 1 });
  assert.equal((await c.load('listUsers')).length, 2);
  assert.equal(g, 3);
  await assert.rejects(() => c.mutate('createUser', {}, { name: 'x' }));
  assert.equal(p, 1);
});

test('auth headers are attached per request', async () => {
  const f = fakeFetch({ 'GET /users': () => users() });
  const c = createClient({ api, fetch: f, headers: async () => ({ authorization: 'Bearer t' }) });
  await c.load('listUsers');
  assert.equal(f.calls[0].headers.authorization, 'Bearer t');
});

test('stream events: patch, version ordering, upsert, delete', async () => {
  const f = fakeFetch({ 'GET /users': () => users() });
  const c = createClient({ api, fetch: f });
  await c.load('listUsers');
  const names = [];
  effect(() => names.push(c.query('listUsers').data.value.map((u) => u.name).join(',')));
  const s = c.store;
  assert.equal(s.applyEvent({ type: 'patch', entity: 'User', id: 1, path: '/name', value: 'Ada2', version: 5 }), true);
  assert.equal(s.applyEvent({ type: 'patch', entity: 'User', id: 1, path: '/name', value: 'old', version: 4 }), false); // stale
  assert.equal(s.applyEvent({ type: 'patch', entity: 'User', id: 999, path: '/name', value: 'x' }), false); // unknown
  assert.equal(s.applyEvent({ type: 'delete', entity: 'User', id: 2, version: 6 }), true);
  assert.equal(names.at(-1), 'Ada2');
  assert.equal(c.query('listUsers').data.peek().filter(Boolean).length, 1);
});

test('derived recomputes from the shared store without any request', async () => {
  const f = fakeFetch({ 'GET /users': () => users() });
  const c = createClient({ api, fetch: f });
  const roles = derived(({ all }) => Object.groupBy(all('User'), (u) => u.role), c);
  await c.load('listUsers');
  const seen = [];
  effect(() => seen.push(Object.keys(roles.value).sort().join()));
  c.store.applyEvent({ type: 'upsert', entity: 'User', id: 3, value: { id: 3, name: 'Cy', role: 'guest' } });
  assert.deepEqual(seen, ['admin,user', 'admin,guest,user']);
  assert.equal(f.calls.length, 1);
});

test('connectStream applies events, resyncs on request and after reconnect', async () => {
  const f = fakeFetch({ 'GET /users': () => users() });
  const c = createClient({ api, fetch: f });
  const q = c.query('listUsers'); q.retain(); await q.inflight;
  let es;
  class FakeES { constructor(url) { es = this; this.url = url; } close() { this.closed = true; } }
  const statuses = [];
  const conn = connectStream({ client: c, url: '/events', EventSource: FakeES, onStatus: (s) => statuses.push(s) });
  es.onmessage({ data: JSON.stringify({ type: 'patch', entity: 'User', id: 1, path: '/name', value: 'Live', version: 1 }) });
  assert.equal(q.data.peek()[0].name, 'Live');
  es.onmessage({ data: 'not json' }); // ignored, no throw
  es.onerror(); es.onopen();          // reconnect => invalidateAll => refetch
  await tick(5);
  assert.equal(f.calls.filter((x) => x.key === 'GET /users').length, 2);
  conn.close();
  assert.deepEqual(statuses, ['error', 'open', 'closed']);
  assert.equal(es.closed, true);
});

test('json pointer set is copy-on-write and blocks prototype pollution', () => {
  const a = { x: { y: 1 } };
  const b = setPointer(a, '/x/y', 2);
  assert.equal(a.x.y, 1); assert.equal(b.x.y, 2);
  assert.throws(() => setPointer({}, '/__proto__/polluted', 1), /forbidden/);
  assert.equal({}.polluted, undefined);
});

test('configure() sets the default client used by derived()', async () => {
  const f = fakeFetch({ 'GET /users': () => users() });
  const c = configure({ api, fetch: f });
  const count = derived(({ all }) => all('User').length);
  await c.load('listUsers');
  assert.equal(count.value, 2);
});

test('an entity deleted and re-created reaches readers that subscribed before', async () => {
  const c = createClient({ api, fetch: fakeFetch({}) });
  const s = c.store;
  s.upsert('User', 1, { id: 1, name: 'Ada' });
  const seen = [];
  effect(() => seen.push(s.denormalize({ $ref: 'User#1' })?.name));
  s.applyEvent({ type: 'delete', entity: 'User', id: 1, version: 2 });
  s.applyEvent({ type: 'upsert', entity: 'User', id: 1, value: { id: 1, name: 'Ada again' }, version: 3 });
  assert.deepEqual(seen, ['Ada', undefined, 'Ada again']);
});

test('a late stale event cannot resurrect a deleted entity', () => {
  const c = createClient({ api, fetch: fakeFetch({}) });
  const s = c.store;
  s.upsert('User', 1, { id: 1, name: 'Ada' });
  assert.equal(s.applyEvent({ type: 'delete', entity: 'User', id: 1, version: 5 }), true);
  assert.equal(s.applyEvent({ type: 'upsert', entity: 'User', id: 1, value: { id: 1, name: 'old' }, version: 4 }), false);
  assert.equal(s.denormalize({ $ref: 'User#1' }), undefined);
});

test('reading an entity that does not exist yet subscribes to its arrival', () => {
  const c = createClient({ api, fetch: fakeFetch({}) });
  const seen = [];
  effect(() => seen.push(c.store.denormalize({ $ref: 'User#9' })?.name));
  c.store.upsert('User', 9, { id: 9, name: 'Late' });
  assert.deepEqual(seen, [undefined, 'Late']);
});

test('unobserved queries are garbage collected after gcTime; observed ones are kept', async () => {
  const f = fakeFetch({ 'GET /users': () => users(), 'GET /dashboard': () => ({ n: 1 }) });
  const c = createClient({ api, fetch: f, gcTime: 20 });
  await c.load('getDashboard');                 // never retained
  const watched = c.query('listUsers'); watched.retain(); await watched.inflight;
  assert.equal(c.size, 2);
  await tick(60);
  assert.equal(c.size, 1);
  watched.release();
  await tick(60);
  assert.equal(c.size, 0);
});

test('pending counts in-flight mutations as well as queries', async () => {
  const f = fakeFetch({ 'POST /orders/1/ship': async () => { await tick(30); return null; } });
  const c = createClient({ api, fetch: f });
  const p = c.mutate('shipOrder', { id: 1 });
  assert.equal(c.pending, 1);
  await p;
  assert.equal(c.pending, 0);
});

test('op() does not resolve inherited object keys', () => {
  const c = createClient({ api, fetch: fakeFetch({}) });
  assert.throws(() => c.op('constructor'), /unknown operation/);
});

test('error bodies: { error: { code, message } } envelopes and FastAPI validation details', async () => {
  const f = fakeFetch({
    'GET /users': () => json(429, { error: { code: 'rate_limited', message: 'slow down', retry_after_s: 7 } }),
    'POST /users': () => json(422, { detail: [{ loc: ['body', 'name'], msg: 'Field required', type: 'missing' }, { loc: ['body', 'x'], msg: 'bad', type: 'v' }] }),
  });
  const c = createClient({ api, fetch: f, retry: 0 });
  await assert.rejects(() => c.load('listUsers'), (e) => e.status === 429 && e.code === 'rate_limited' && e.detail === 'slow down' && e.retryAfterS === 7);
  await assert.rejects(() => c.mutate('createUser', {}, {}), (e) => e.status === 422 && e.detail === 'Field required; bad');
});

test('stream(): parses SSE over POST across chunk boundaries, comments and multi-line data', async () => {
  const enc = new TextEncoder();
  const chunks = ['event: token\ndata: {"t":"Hel', 'lo"}\n\n: keep-alive\n\ndata: line1\ndata: line2\n\nevent: done\r\ndata: {"ok":true}\r\n\r\n'];
  const seenReq = [];
  const f = async (url, init) => {
    seenReq.push({ url, method: init.method, accept: init.headers.accept, body: init.body });
    return new Response(new ReadableStream({ start(c) { chunks.forEach((x) => c.enqueue(enc.encode(x))); c.close(); } }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };
  const c = createClient({ api: { operations: { sendStream: { id: 'sendStream', method: 'POST', path: '/chat/{sid}/stream', body: true } } }, fetch: f });
  const events = [];
  for await (const ev of c.stream('sendStream', { sid: 's1' }, { message: 'hi' })) events.push(ev);
  assert.deepEqual(events.map((e) => [e.event, e.data]), [['token', '{"t":"Hello"}'], ['message', 'line1\nline2'], ['done', '{"ok":true}']]);
  assert.deepEqual(events[0].json, { t: 'Hello' });
  assert.equal(events[1].json, undefined);
  assert.deepEqual(seenReq[0], { url: '/chat/s1/stream', method: 'POST', accept: 'text/event-stream', body: '{"message":"hi"}' });
});

test('stream(): HTTP errors are normalized; cancelling stops the iteration', async () => {
  const errs = [];
  const bad = createClient({ api: { operations: { s: { id: 's', method: 'POST', path: '/s' } } }, fetch: async () => json(503, { error: { code: 'unavailable', message: 'later' } }), onError: (e) => errs.push(e) });
  await assert.rejects(async () => { for await (const _ of bad.stream('s')) { /* none */ } }, (e) => e.status === 503 && e.code === 'unavailable');
  assert.equal(errs.length, 1);

  const enc = new TextEncoder();
  let cancelled = false;
  const c = createClient({ api: { operations: { s: { id: 's', method: 'POST', path: '/s' } } }, fetch: async () => new Response(new ReadableStream({
    start(ctrl) { ctrl.enqueue(enc.encode('data: 1\n\ndata: 2\n\n')); }, cancel() { cancelled = true; } }), { status: 200 }) });
  const got = [];
  for await (const ev of c.stream('s')) { got.push(ev.data); break; }
  await tick(5);
  assert.deepEqual(got, ['1']);
  assert.equal(cancelled, true);
});

test('a mutation that returns the entity a detail query shows does not refetch it, but lists still refetch', async () => {
  let name = 'Ada';
  const f = fakeFetch({
    'GET /users': () => [{ id: 1, name }],
    'GET /users/1': () => ({ id: 1, name }),
    'POST /users/1/disable': () => { name = 'Ada (off)'; return { id: 1, name }; },
  });
  const c = createClient({ api, fetch: f });
  const detail = c.query('getUser', { id: 1 }); detail.retain(); await detail.inflight;
  const list = c.query('listUsers'); list.retain(); await list.inflight;
  await c.mutate('disableUser', { id: 1 });
  await tick(5);
  assert.equal(f.calls.filter((x) => x.key === 'GET /users/1').length, 1);   // detail: no refetch
  assert.equal(f.calls.filter((x) => x.key === 'GET /users').length, 2);     // list: refetched
  assert.equal(detail.data.peek().name, 'Ada (off)');                        // but already up to date
  assert.equal(detail.isFresh(), true);
});

test('unions: members are normalized by their tag; expandable ids stay as ids and objects become shared entities', async () => {
  const table = {
    entities: { File: { id: 'id' }, Folder: { id: 'id' }, Customer: { id: 'id' }, Charge: { id: 'id', props: { customer: { t: 'entity', name: 'Customer' } } } },
    operations: {
      items: { id: 'items', method: 'GET', path: '/items', response: { t: 'object', props: { entries: { t: 'array', items: { t: 'union', key: 'type', map: { file: { t: 'entity', name: 'File' }, folder: { t: 'entity', name: 'Folder' } } } } } } },
      charge: { id: 'charge', method: 'GET', path: '/charges/{id}', response: { t: 'entity', name: 'Charge' } },
      customer: { id: 'customer', method: 'GET', path: '/customers/{id}', response: { t: 'entity', name: 'Customer' } },
    },
  };
  let customer = 'cus_1';
  const f = fakeFetch({
    'GET /items': () => ({ entries: [{ type: 'file', id: 'f1', name: 'a.txt' }, { type: 'folder', id: 'd1', name: 'docs' }, { type: 'weblink', id: 'w1' }, 'stray'] }),
    'GET /charges/ch_1': () => ({ id: 'ch_1', customer }),
    'GET /customers/cus_1': () => ({ id: 'cus_1', name: 'Ada' }),
  });
  const c = createClient({ api: table, fetch: f });
  const items = await c.load('items');
  assert.equal(items.entries[0].name, 'a.txt');                       // File entity
  assert.equal(c.store.denormalize({ $ref: 'Folder#d1' }).name, 'docs'); // Folder entity, stored by its own type
  assert.deepEqual(items.entries.slice(2), [{ type: 'weblink', id: 'w1' }, 'stray']); // unknown tag / scalar left as received

  assert.equal((await c.load('charge', { id: 'ch_1' })).customer, 'cus_1'); // not expanded: still an id
  customer = { id: 'cus_1', name: 'Ada (expanded)' };
  c.query('charge', { id: 'ch_1' }).invalidate();
  const expanded = await c.query('charge', { id: 'ch_1' }).fetch();
  assert.equal(expanded.customer.name, 'Ada (expanded)');
  await c.load('customer', { id: 'cus_1' }); // detail fetch merges into the same entity
  assert.equal(c.store.denormalize({ $ref: 'Customer#cus_1' }).name, 'Ada');
});

test('unions with a default member: the flagged member wins, everything else is the default', async () => {
  const table = {
    entities: { Customer: { id: 'id' }, DeletedCustomer: { id: 'id' } },
    operations: { list: { id: 'list', method: 'GET', path: '/c', response: { t: 'array', items: { t: 'union', key: 'deleted', map: { true: { t: 'entity', name: 'DeletedCustomer' } }, default: { t: 'entity', name: 'Customer' } } } } },
  };
  const c = createClient({ api: table, fetch: fakeFetch({ 'GET /c': () => [{ id: 'a', name: 'Ada' }, { id: 'b', deleted: true }, { id: 'c', deleted: false, name: 'Cy' }] }) });
  await c.load('list');
  assert.equal(c.store.denormalize({ $ref: 'Customer#a' }).name, 'Ada');
  assert.equal(c.store.denormalize({ $ref: 'DeletedCustomer#b' }).deleted, true);
  assert.equal(c.store.denormalize({ $ref: 'Customer#c' }).name, 'Cy'); // deleted:false is not the flag
});

test('field errors are collected from FastAPI, envelope and problem+json bodies', async () => {
  const fail = (body) => {
    const c = createClient({ api, fetch: fakeFetch({ 'POST /users': () => json(422, body) }), retry: 0 });
    return c.mutate('createUser', {}, {}).then(() => assert.fail('should reject'), (e) => e.fields);
  };
  assert.deepEqual(await fail({ detail: [{ loc: ['body', 'address', 'zip'], msg: 'too short' }] }), { 'address.zip': 'too short' });
  assert.deepEqual(await fail({ error: { code: 'invalid', message: 'bad', fields: { email: 'taken' } } }), { email: 'taken' });
  assert.deepEqual(await fail({ errors: [{ pointer: '#/name', detail: 'required' }, { field: 'age', message: 'too low' }] }), { name: 'required', age: 'too low' });
  assert.deepEqual(await fail({ title: 'nope' }), {});
});

test('idempotency keys: a fresh UUID per call for the fields the operation declares, never overwriting a given one', async () => {
  const bodies = [];
  const keyed = { operations: { send: { id: 'send', method: 'POST', path: '/m', body: true, uuid: ['client_message_id'], response: null } } };
  const c = createClient({ api: keyed, fetch: fakeFetch({ 'POST /m': ({ body }) => { bodies.push(body); return null; } }) });
  await c.mutate('send', {}, { text: 'a' });
  await c.mutate('send', {}, { text: 'a' });
  await c.mutate('send', {}, { text: 'b', client_message_id: 'mine' });
  await c.mutate('send', {});
  const [a, b, mine, none] = bodies;
  assert.match(a.client_message_id, /^[0-9a-f-]{36}$/);
  assert.notEqual(a.client_message_id, b.client_message_id);
  assert.equal(mine.client_message_id, 'mine');
  assert.match(none.client_message_id, /^[0-9a-f-]{36}$/);
});

test('unwrap: { code, message, data } envelopes are read as data, for queries and mutations', async () => {
  const wrapped = { entities: { User: { id: 'id' } }, operations: {
    list: { id: 'list', method: 'GET', path: '/u', unwrap: 'data', response: { t: 'array', items: { t: 'entity', name: 'User' } } },
    add: { id: 'add', method: 'POST', path: '/u', body: true, unwrap: 'data', response: { t: 'entity', name: 'User' } },
  } };
  const c = createClient({ api: wrapped, fetch: fakeFetch({
    'GET /u': () => ({ code: 0, message: 'ok', data: [{ id: 1, name: 'Ada' }] }),
    'POST /u': () => ({ code: 0, message: 'ok', data: { id: 2, name: 'Bob' } }),
  }) });
  assert.deepEqual(await c.load('list'), [{ id: 1, name: 'Ada' }]);
  assert.deepEqual(await c.mutate('add', {}, { name: 'Bob' }), { id: 2, name: 'Bob' });
  assert.equal(c.store.has({ $ref: 'User#2' }), true); // entities inside the envelope are shared as usual
});

test('multipart: a FormData body is sent as it is, without a JSON content type', async () => {
  let seen;
  const up = { operations: { upload: { id: 'upload', method: 'POST', path: '/f', body: true, multipart: true, response: null } } };
  const c = createClient({ api: up, fetch: async (url, init) => { seen = init; return new Response(null, { status: 204 }); } });
  const form = new FormData();
  form.set('title', 'x');
  await c.mutate('upload', {}, form);
  assert.equal(seen.body, form);
  assert.equal(seen.headers['content-type'], undefined);
});

test('a request nobody observes any more is cancelled; load() waiters keep theirs', async () => {
  const signals = [];
  const slow = (url, init) => new Promise((resolve, reject) => {
    signals.push(init.signal);
    init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    setTimeout(() => resolve(new Response(JSON.stringify([]), { status: 200 })), 60);
  });
  const c = createClient({ api, fetch: slow, retry: 0 });
  const q = c.query('listUsers', { page: 1 });
  q.retain();
  await tick(5);
  q.release(); // the view moved to another page
  await tick(5);
  assert.equal(signals[0].aborted, true);
  assert.equal(q.status.peek(), 'idle');
  assert.equal(q.error.peek(), null); // a cancellation is not an error
  const kept = c.query('listUsers', { page: 2 });
  const loading = c.load('listUsers', { page: 2 });
  kept.retain(); kept.release();
  await loading;
  assert.equal(signals[1].aborted, false);
});

test('entities no cached query refers to are evicted when a query is collected', async () => {
  const f = fakeFetch({ 'GET /users': ({ url }) => (url.searchParams.get('page') === '1' ? [{ id: 1, name: 'Ada' }] : [{ id: 2, name: 'Bob' }]) });
  const c = createClient({ api, fetch: f, gcTime: 20 });
  await c.load('listUsers', { page: 1 });
  await c.load('listUsers', { page: 2 });
  assert.equal(c.store.refs('User').length, 2);
  const keep = c.query('listUsers', { page: 2 });
  keep.retain(); // page 2 stays on screen; page 1 is collected
  await tick(60);
  assert.deepEqual(c.store.refs('User').map((r) => r.$ref), ['User#2']);
  const off = createClient({ api, fetch: f, gcTime: 20, evictEntities: false });
  await off.load('listUsers', { page: 1 });
  await tick(60);
  assert.equal(off.store.refs('User').length, 1);
});

test('stream versions are forgotten on resync, so a restarted server can start counting again', async () => {
  const c = createClient({ api, fetch: fakeFetch({}) });
  c.store.upsert('User', 1, { id: 1, name: 'Ada' });
  assert.equal(c.store.applyEvent({ type: 'patch', entity: 'User', id: 1, path: '/name', value: 'A', version: 50 }), true);
  assert.equal(c.store.applyEvent({ type: 'patch', entity: 'User', id: 1, path: '/name', value: 'B', version: 1 }), false);
  c.store.resetVersions();
  assert.equal(c.store.applyEvent({ type: 'patch', entity: 'User', id: 1, path: '/name', value: 'B', version: 1 }), true);
});

test('a response with the entity schema replaces the record; projections and stream upserts merge', async () => {
  const rep = { entities: { User: { id: 'id' } }, operations: {
    getUser: { id: 'getUser', method: 'GET', path: '/users/{id}', response: { t: 'entity', name: 'User', replace: true } },
    listUsers: { id: 'listUsers', method: 'GET', path: '/users', response: { t: 'array', items: { t: 'entity', name: 'User' } } },
  } };
  let user = { id: 1, name: 'Ada', nickname: 'A' };
  const c = createClient({ api: rep, fetch: fakeFetch({ 'GET /users/1': () => user, 'GET /users': () => [{ id: 1, name: 'Ada L' }] }) });
  await c.load('getUser', { id: 1 });
  assert.equal(c.store.read('User#1').nickname, 'A');
  await c.load('listUsers'); // a projection merges: nickname survives
  assert.deepEqual(c.store.read('User#1'), { id: 1, name: 'Ada L', nickname: 'A' });
  user = { id: 1, name: 'Ada' }; // the server stopped sending nickname
  c.query('getUser', { id: 1 }).invalidate();
  await c.query('getUser', { id: 1 }).fetch();
  assert.deepEqual(c.store.read('User#1'), { id: 1, name: 'Ada' });
  c.store.applyEvent({ type: 'upsert', entity: 'User', id: 1, value: { id: 1, extra: true } });
  assert.deepEqual(c.store.read('User#1'), { id: 1, name: 'Ada', extra: true });
});

test('selecting the same params again while a request runs starts a fresh request instead of sticking idle', async () => {
  let calls = 0;
  const slow = (url, init) => new Promise((resolve, reject) => {
    calls++;
    init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    setTimeout(() => resolve(new Response(JSON.stringify([{ id: 1, name: 'Ada' }]), { status: 200 })), 30);
  });
  const c = createClient({ api, fetch: slow, retry: 0 });
  const q = c.query('listUsers', { page: 1 });
  q.retain();
  await tick(5);
  q.release(); // a view re-selects the same params: release, then retain in the same turn
  q.retain();
  await tick(80);
  assert.equal(calls, 2);
  assert.equal(q.status.peek(), 'success');
  assert.deepEqual(q.data.peek(), [{ id: 1, name: 'Ada' }]);
});

test('unwrap: a success body without the envelope field is an error, not silent null', async () => {
  const wrapped = { operations: { list: { id: 'list', method: 'GET', path: '/u', unwrap: 'data', response: null } } };
  const c = createClient({ api: wrapped, fetch: fakeFetch({ 'GET /u': () => ({ other: 1 }) }), retry: 0 });
  await assert.rejects(() => c.load('list'), (e) => e instanceof XoongError && /no "data" field/.test(e.detail));
});

test('composite identity: several properties make one id; missing parts keep the object inline', async () => {
  const k8s = { entities: { Pod: { id: ['namespace', 'name'] } }, operations: {
    list: { id: 'list', method: 'GET', path: '/pods', response: { t: 'array', items: { t: 'entity', name: 'Pod' } } },
  } };
  const c = createClient({ api: k8s, fetch: fakeFetch({ 'GET /pods': () => [
    { namespace: 'a', name: 'web', phase: 'Running' }, { namespace: 'b', name: 'web', phase: 'Pending' }, { name: 'orphan' },
  ] }) });
  const items = await c.load('list');
  assert.deepEqual(c.store.refs('Pod').map((r) => r.$ref).sort(), ['Pod#a/web', 'Pod#b/web']); // same name, different namespace: two pods
  assert.equal(items.length, 3);
  assert.deepEqual(items[2], { name: 'orphan' });
  assert.equal(c.store.applyEvent({ type: 'patch', entity: 'Pod', id: 'a/web', path: '/phase', value: 'Failed' }), true);
  assert.equal(c.store.read('Pod#a/web').phase, 'Failed');
});

test('a union without a tag is resolved by a property only one member has', async () => {
  const gh = { entities: { Issue: { id: 'id' }, Pull: { id: 'id' } }, operations: {
    list: { id: 'list', method: 'GET', path: '/items', response: { t: 'array', items: { t: 'union', has: [['pull_request', { t: 'entity', name: 'Pull' }], ['labels', { t: 'entity', name: 'Issue' }]] } } },
  } };
  const c = createClient({ api: gh, fetch: fakeFetch({ 'GET /items': () => [{ id: 1, labels: [] }, { id: 1, pull_request: { url: 'x' } }, { id: 9 }] }) });
  const items = await c.load('list');
  assert.deepEqual(c.store.refs('Issue').map((r) => r.$ref), ['Issue#1']);
  assert.deepEqual(c.store.refs('Pull').map((r) => r.$ref), ['Pull#1']); // same id, different entity types
  assert.deepEqual(items[2], { id: 9 }); // unrecognised: kept as received
});

test('composite ids with separators in a part do not collide', () => {
  const c = createClient({ api: { entities: { K: { id: ['a', 'b'] } }, operations: { l: { id: 'l', method: 'GET', path: '/k', response: { t: 'array', items: { t: 'entity', name: 'K' } } } } }, fetch: fakeFetch({ 'GET /k': () => [{ a: 'x/y', b: 'z' }, { a: 'x', b: 'y/z' }] }) });
  return c.load('l').then(() => assert.equal(c.store.refs('K').length, 2));
});

test('optimistic updates show at once, survive success, and are undone on failure without erasing newer changes', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  let fail = false;
  const f = fakeFetch({
    'GET /users': () => [{ id: 1, name: 'Ada', role: 'admin' }],
    'POST /users/1/disable': async () => { await gate; return fail ? json(500, { title: 'Boom' }) : { id: 1, name: 'Ada', role: 'admin', status: 'disabled' }; },
  });
  const c = createClient({ api, fetch: f, retry: 0 });
  await c.load('listUsers');
  const pending = c.mutate('disableUser', { id: 1 }, undefined, { optimistic: [{ $ref: 'User#1', patch: { status: 'disabled' } }] });
  assert.equal(c.store.read('User#1').status, 'disabled'); // before the server answered
  release();
  await pending;
  assert.equal(c.store.read('User#1').status, 'disabled');

  // failure: the provisional field is taken back, other fields stay, and a newer change in between is kept
  const g = createClient({ api, fetch: fakeFetch({
    'GET /users': () => [{ id: 1, name: 'Ada', status: 'active' }],
    'POST /users/1/disable': async () => { g.store.applyEvent({ type: 'patch', entity: 'User', id: 1, path: '/name', value: 'Ada L' }); return json(500, { title: 'Boom' }); },
  }), retry: 0 });
  await g.load('listUsers');
  await assert.rejects(() => g.mutate('disableUser', { id: 1 }, undefined, { optimistic: [{ $ref: 'User#1', patch: { status: 'disabled' } }] }));
  assert.deepEqual(g.store.read('User#1'), { id: 1, name: 'Ada L', status: 'active' });
  // an entity that is not loaded is ignored
  await g.mutate('disableUser', { id: 1 }, undefined, { optimistic: [{ $ref: 'User#99', patch: { x: 1 } }] }).catch(() => {});
  assert.equal(g.store.read('User#99'), undefined);
});

test('the "live without streamUrl" warning appears once, not once per view', async () => {
  const { configure } = await import('../src/index.js');
  const { acquireStream } = await import('../src/default.js');
  const seen = [];
  const original = console.warn;
  console.warn = (...a) => seen.push(a.join(' '));
  try {
    configure({ api, fetch: fakeFetch({}) });
    const releases = [acquireStream(), acquireStream(), acquireStream()];
    releases.forEach((r) => r());
    assert.equal(seen.filter((m) => /needs `streamUrl`/.test(m)).length, 1);
    configure({ api, fetch: fakeFetch({}) }); // a new configuration may warn again
    acquireStream()();
    assert.equal(seen.filter((m) => /needs `streamUrl`/.test(m)).length, 2);
  } finally { console.warn = original; }
});
