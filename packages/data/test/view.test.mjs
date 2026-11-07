import { test } from 'vitest';
import assert from 'node:assert/strict';
import { withBrowser } from '../../../tools/browser.mjs';
import { api } from './helpers.mjs';

function backend() {
  const state = { users: [{ id: 1, name: 'Ada', tags: ['x', 'y'] }, { id: 2, name: 'Bob', tags: [] }], hits: {}, streams: [] };
  const send = (res, status, body) => { res.statusCode = status; res.setHeader('content-type', status >= 400 ? 'application/problem+json' : 'application/json'); res.end(JSON.stringify(body)); };
  const hit = (k) => (state.hits[k] = (state.hits[k] ?? 0) + 1);
  const routes = {
    'GET /api/users': (_q, res) => { hit('list'); send(res, 200, state.users); },
    'GET /api/users/1': (_q, res) => { hit('one'); send(res, 200, state.users[0]); },
    'GET /api/users/404': (_q, res) => send(res, 404, { title: 'Not Found', detail: 'no such user' }),
    'POST /api/users/1/disable': (_q, res) => { state.users[0] = { ...state.users[0], name: 'Ada (disabled)' }; send(res, 200, state.users[0]); },
    'GET /__hits': (_q, res) => send(res, 200, state.hits),
    'POST /__push': async (req, res) => {
      let body = ''; for await (const c of req) body += c;
      for (const r of state.streams) r.write(`data: ${body}\n\n`);
      send(res, 200, { pushed: state.streams.length });
    },
    'GET /events': (_q, res) => { res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }); res.write(': open\n\n'); state.streams.push(res); },
  };
  return { state, routes };
}

const run = async (body, setup = (s) => {}) => {
  const b = backend();
  setup(b.state);
  return withBrowser(async (page, base, errors) => {
    page.on('console', () => {});
    const out = await page.evaluate(`(async () => {
      const { configure } = await import('@xoong/data');
      await import('@xoong/data/view');
      const api = ${JSON.stringify(api)};
      const client = configure({ api, baseUrl: '/api', streamUrl: '/events', retry: 0 });
      const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
      const until = async (fn, ms = 4000) => { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error('timed out waiting for the page'); await wait(10); } };
      // Wait for the view to start, then until nothing is in flight: a fixed delay is flaky on a cold or busy machine.
      const mount = async (html) => { const d = document.createElement('div'); d.innerHTML = html; document.body.append(d); await wait(20); await until(() => client.pending === 0); await wait(20); return d; };
      ${body}
    })()`);
    return { out, errors, state: b.state, base };
  }, { routes: Object.fromEntries(Object.entries(b.routes).map(([k, h]) => [k, h])) });
};

test('xo-view: loading state, each, interpolation, attribute binding, tags nested each', async () => {
  const { out, errors } = await run(`
    const d = await mount('<xo-view get="/users"><p xo-if="$loading" id="l">Loading</p><ul><li xo-each="." data-id="{id}"><b>{name}</b><i xo-each="tags">[{.}]</i></li></ul></xo-view>');
    return { li: [...d.querySelectorAll('li')].map((l) => l.dataset.id + ':' + l.querySelector('b').textContent + ':' + l.textContent.replace(/\\s+/g,'')), loading: !!d.querySelector('#l') };
  `);
  assert.deepEqual(errors, []);
  assert.deepEqual(out.li, ['1:Ada:Ada[x][y]', '2:Bob:Bob']);
  assert.equal(out.loading, false);
});

test('xo-view: action calls the operation, refetches, keeps DOM rows (keyed), emits xo-done', async () => {
  const { out, errors, state } = await run(`
    const d = await mount('<xo-view get="/users"><ul><li xo-each="."><b>{name}</b><button xo-click="POST /users/{id}/disable">x</button></li></ul></xo-view>');
    const row = d.querySelector('li');
    let done = null;
    d.addEventListener('xo-done', (e) => (done = e.detail));
    row.querySelector('button').click();
    await until(() => client.pending === 0); await wait(30);
    return { name: d.querySelector('li b').textContent, sameRow: d.querySelector('li') === row, done: done?.name };
  `);
  assert.deepEqual(errors, []);
  assert.equal(out.name, 'Ada (disabled)');
  assert.equal(out.sameRow, true);
  assert.equal(out.done, 'Ada (disabled)');
  assert.equal(state.hits.list, 2); // initial + invalidation refetch (observed list)
});

test('two views share one entity; stream patch updates both without any request', async () => {
  const { out, errors } = await run(`
    const d = await mount('<xo-view live get="/users"><li xo-each="."><span class="a">{name}</span></li></xo-view><xo-view live get="/users/{id}" p-id="1"><h1>{name}</h1></xo-view>');
    for (let i = 0; i < 150; i++) { // wait until the stream is connected (a no-op event reaches one subscriber)
      const r = await fetch('/__push', { method: 'POST', body: '{"type":"noop"}' }).then((x) => x.json());
      if (r.pushed >= 1) break;
      await wait(20);
    }
    const hitsBefore = await fetch('/__hits').then((r) => r.json());
    const push = (ev) => fetch('/__push', { method: 'POST', body: JSON.stringify(ev) });
    await push({ type: 'patch', entity: 'User', id: 1, path: '/name', value: 'Ada Live', version: 1 });
    await until(() => d.querySelector('.a').textContent === 'Ada Live' && d.querySelector('h1').textContent === 'Ada Live');
    const afterPatch = [d.querySelector('.a').textContent, d.querySelector('h1').textContent];
    await push({ type: 'upsert', entity: 'User', id: 3, value: { id: 3, name: 'Cy', tags: [] }, version: 1 });
    await push({ type: 'delete', entity: 'User', id: 2, version: 2 });
    await until(() => d.querySelectorAll('.a').length === 1);
    const hitsAfter = await fetch('/__hits').then((r) => r.json());
    return { afterPatch, hitsBefore, hitsAfter, names: [...d.querySelectorAll('.a')].map((e) => e.textContent) };
  `);
  assert.deepEqual(errors, []);
  assert.deepEqual(out.afterPatch, ['Ada Live', 'Ada Live']);
  assert.deepEqual(out.hitsAfter, out.hitsBefore); // zero extra requests
  assert.deepEqual(out.names, ['Ada Live']); // delete removed Bob; upsert of Cy is not in the list query result
});

test('xo-view: errors expose $error and emit xo-error; params can be set at runtime', async () => {
  const { out, errors } = await run(`
    const d = await mount('<xo-view get="/users/{id}" p-id="404"><p xo-if="$error" class="e">{$error.detail}</p><h1 xo-if="!$error">{name}</h1></xo-view>');
    const view = d.querySelector('xo-view');
    const first = d.querySelector('.e')?.textContent;
    view.params = { id: 1 };
    await until(() => d.querySelector('h1')?.textContent === 'Ada');
    return { first, second: d.querySelector('h1')?.textContent, stillError: !!d.querySelector('.e') };
  `);
  assert.deepEqual(errors, []);
  assert.equal(out.first, 'no such user');
  assert.equal(out.second, 'Ada');
  assert.equal(out.stillError, false);
});

test('xo-view: removing the view releases its query and stream', async () => {
  const { out, errors } = await run(`
    const d = await mount('<xo-view live get="/users"><li xo-each="."><span>{name}</span></li></xo-view>');
    d.remove();
    await until(() => client.query('GET /users').observers === 0);
    const q = client.query('GET /users');
    return { observers: q.observers };
  `);
  assert.deepEqual(errors, []);
  assert.equal(out.observers, 0);
});

test('xo-each rows follow their item: primitives and inline objects update, not just entities', async () => {
  const { out, errors } = await run(`
    const d = await mount('<xo-view get="/users/{id}" p-id="1"><i xo-each="tags">[{.}]</i></xo-view>');
    const view = d.querySelector('xo-view');
    const first = d.textContent.replace(/\\s+/g, '');
    client.store.applyEvent({ type: 'patch', entity: 'User', id: 1, path: '/tags', value: ['x', 'z', 'w'] });
    await until(() => d.textContent.replace(/\\s+/g, '') === '[x][z][w]');
    return { first, second: d.textContent.replace(/\\s+/g, '') };
  `);
  assert.deepEqual(errors, []);
  assert.equal(out.first, '[x][y]');
  assert.equal(out.second, '[x][z][w]');
});

test('attribute interpolation: script URLs are neutralised, event-handler attributes refused', async () => {
  const { out, errors } = await run(`
    client.store.upsert('User', 7, { id: 7, site: 'javascript:alert(1)', ok: 'https://example.com/a', sneaky: ' JaVa\\tScript:alert(1)', cmd: 'alert(1)' });
    const d = await mount('<xo-view get="/users/{id}" p-id="1"><a id="a" href="{site}">a</a><a id="b" href="{ok}">b</a></xo-view>');
    client.store.upsert('User', 1, { id: 1, site: 'javascript:alert(1)', ok: 'https://example.com/a', sneaky: ' JaVa\\tScript:alert(1)', cmd: 'alert(1)' });
    await wait(30);
    const d2 = await mount('<xo-view get="/users/{id}" p-id="1"><a id="c" href="{sneaky}">c</a><button id="e" onclick="{cmd}">e</button></xo-view>');
    return { a: d.querySelector('#a').getAttribute('href'), b: d.querySelector('#b').getAttribute('href'), c: d2.querySelector('#c').getAttribute('href'), onclick: d2.querySelector('#e').hasAttribute('onclick') };
  `);
  assert.deepEqual(errors, []);
  assert.equal(out.a, 'about:blank');
  assert.equal(out.b, 'https://example.com/a');
  assert.equal(out.c, 'about:blank');
  assert.equal(out.onclick, false);
});

test('view params (p-*) are available to actions and interpolation inside the view', async () => {
  const { out, errors, state } = await run(`
    const d = await mount('<xo-view get="/users/{id}" p-id="1"><span class="id">{id}</span><button xo-click="POST /users/{id}/disable">x</button></xo-view>');
    d.querySelector('button').click();
    await wait(60);
    return { id: d.querySelector('.id').textContent, name: client.store.denormalize({ $ref: 'User#1' }).name };
  `);
  assert.deepEqual(errors, []);
  assert.equal(out.id, '1'); // entity field wins over the param of the same name; here both are 1
  assert.equal(out.name, 'Ada (disabled)');
});
