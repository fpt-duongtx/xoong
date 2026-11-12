// The server runs the same bindNode as the client (ADR-0014). What the screen tests see in the DOM, this HTML contains.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { renderPage } from '../src/render.js';

const operations = {
  version: 1,
  entities: { User: { id: 'id' } },
  operations: {
    listUsers: { id: 'listUsers', method: 'GET', path: '/users', query: ['limit', 'offset'], response: { t: 'object', props: { items: { t: 'array', items: { t: 'entity', name: 'User' } }, total: { t: 'number' }, theme: { t: 'string' } } } },
    createUser: { id: 'createUser', method: 'POST', path: '/users', body: true, response: { t: 'entity', name: 'User' }, bodyFields: [{ name: 'name', type: 'string' }] },
  },
};
const fetch = async () => new Response(JSON.stringify({ items: [{ id: 1, name: 'Ada' }], total: 1, theme: 'dark' }), { status: 200 });
const page = (inner) => `<!doctype html><html><head><title>T</title></head><body>${inner}</body></html>`;

test('ssr keeps the attributes the client keeps', async () => {
  const html = await renderPage(page(`<xo-view get="/users"><xo-table of="items" columns="name" sticky="end" class="wide" data-theme="{theme}"></xo-table><xo-pager page-size="5" id="p" hidden></xo-pager><xo-form op="createUser" class="wide" data-x="1"></xo-form></xo-view>`), { operations, fetch });
  assert.match(html, /<div class="xo-table wide" sticky="end" data-theme="dark">/);
  assert.match(html, /<nav class="xo-pager"[^>]*id="p"[^>]*\shidden/);
  assert.match(html, /<form xo-submit="createUser" class="xo-form wide" data-x="1">/);
  assert.doesNotMatch(html, /display:\s*contents/); // the pager is the <nav>, so hidden is not cancelled by a wrapper
  const saved = /<template data-xo-template[^>]*>([\s\S]*?)<\/template>/.exec(html);
  assert.ok(saved, 'the original markup is kept for the client');
  assert.match(saved[1], /sticky="end"/);
  assert.match(saved[1], /<xo-pager[^>]*hidden/);
});
