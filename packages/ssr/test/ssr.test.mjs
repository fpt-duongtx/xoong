import { test } from 'vitest';
import assert from 'node:assert/strict';
import { renderPage } from '../src/render.js';

const operations = { version: 1, entities: { User: { id: 'id' } }, operations: {
  listUsers: { id: 'listUsers', method: 'GET', path: '/users', query: ['sort', 'limit', 'offset'], response: { t: 'object', props: { items: { t: 'array', items: { t: 'entity', name: 'User' } } } } },
  slow: { id: 'slow', method: 'GET', path: '/slow', response: null },
} };
const users = [{ id: 1, name: 'Ada <b>' }, { id: 2, name: 'Bob' }];
const api = (calls = []) => async (url) => {
  const u = new URL(url, 'http://api.test');
  calls.push(u.pathname + u.search);
  if (u.pathname === '/users') return new Response(JSON.stringify({ items: users, total: 2 }), { status: 200 });
  if (u.pathname === '/slow') { await new Promise((r) => setTimeout(r, 15000)); return new Response('null'); }
  return new Response(JSON.stringify({ title: 'Not Found' }), { status: 404, headers: { 'content-type': 'application/problem+json' } });
};
const page = (inner) => `<!doctype html><html lang="en"><head><title>T</title><link rel="stylesheet" href="/a.css"><script type="module" src="/main.ts"></script></head><body class="b">${inner}</body></html>`;

test('renders the data into the page, escapes it, keeps head, scripts and attributes', async () => {
  const calls = [];
  const html = await renderPage(page('<h1>Team</h1><xo-view get="/users"><ul><li xo-each="items">{name}</li></ul></xo-view>'), { operations, fetch: api(calls) });
  assert.match(html, /<li[^>]*>Ada &lt;b&gt;<\/li>/); // text is escaped
  assert.match(html, /<li[^>]*>Bob<\/li>/);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>T<\/title>/);
  assert.match(html, /<script type="module" src="\/main.ts">/); // the client still takes over
  assert.match(html, /<body class="b">/);
  assert.deepEqual(calls, ['/users']);
});

test('the original markup is kept in a template, so the browser can render it again (no hydration)', async () => {
  const html = await renderPage(page('<xo-view get="/users"><p xo-if="$loading">Loading…</p><b xo-each="items">{name}</b></xo-view>'), { operations, fetch: api() });
  const tpl = /<template data-xo-template[^>]*>([\s\S]*?)<\/template>/.exec(html);
  assert.ok(tpl, 'template present');
  assert.match(tpl[1], /xo-each="items"/);
  assert.match(tpl[1], /\{name\}/); // still the placeholder, not the data
  assert.doesNotMatch(html, /data-xo-ssr/);
});

test('xo-table is rendered by the same runtime that runs in the browser', async () => {
  const html = await renderPage(page('<xo-view get="/users"><xo-table columns="name"></xo-table></xo-view>'), { operations, fetch: api() });
  assert.match(html, /<table>[\s\S]*<td>Bob<\/td>/);
});

test('pages render one after another with their own data, and a stuck request times out with a clear error', async () => {
  const [a, b] = await Promise.all([
    renderPage(page('<xo-view get="/users"><i xo-each="items">{id}</i></xo-view>'), { operations, fetch: api() }),
    renderPage(page('<xo-view get="/users"><u xo-each="items">{name}</u></xo-view>'), { operations, fetch: api() }),
  ]);
  assert.match(a, /<i[^>]*>1<\/i><i[^>]*>2<\/i>/);
  assert.match(b, /<u[^>]*>Bob<\/u>/);
  assert.doesNotMatch(b, /<i[ >]/); // nothing leaks between renders
  await assert.rejects(() => renderPage(page('<xo-view get="/slow"><p>x</p></xo-view>'), { operations, fetch: api(), timeoutMs: 200 }), /did not finish loading/);
  const again = await renderPage(page('<xo-view get="/users"><i xo-each="items">{id}</i></xo-view>'), { operations, fetch: api() });
  assert.match(again, /<i[^>]*>2<\/i>/); // still works after a timeout
}, 30000);
