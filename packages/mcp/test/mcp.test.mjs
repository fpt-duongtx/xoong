import { test } from 'vitest';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, EXPLANATIONS } from '../src/server.js';

const table = { operations: {
  listUsers: { id: 'listUsers', method: 'GET', path: '/users', query: ['limit'] },
  createUser: { id: 'createUser', method: 'POST', path: '/users', body: true, bodyFields: [{ name: 'name', type: 'string', required: true }] },
  disableUser: { id: 'disableUser', method: 'POST', path: '/users/{id}/disable' },
} };
const server = createServer({ llms: async () => 'SPEC', operations: async () => table });
const call = async (name, args) => (await server.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })).result;

test('initialize announces tools; notifications get no reply; unknown methods are errors', async () => {
  const init = await server.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  assert.equal(init.result.protocolVersion, '2024-11-05');
  assert.deepEqual(init.result.capabilities, { tools: {} });
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(init.result.serverInfo, { name: 'xoong', version: pkg.version });
  assert.equal(await server.handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.equal((await server.handle({ jsonrpc: '2.0', id: 2, method: 'nope' })).error.code, -32601);
  assert.equal((await server.handle({ nonsense: true })).error.code, -32600);
  const list = await server.handle({ jsonrpc: '2.0', id: 3, method: 'tools/list' });
  assert.deepEqual(list.result.tools.map((t) => t.name), ['get_spec', 'list_operations', 'check', 'explain_error', 'search_docs']);
});

test('get_spec and list_operations', async () => {
  assert.equal((await call('get_spec')).content[0].text, 'SPEC');
  const rows = JSON.parse((await call('list_operations', { filter: 'user' })).content[0].text);
  assert.deepEqual(rows.find((r) => r.id === 'createUser'), { id: 'createUser', call: 'POST /users', bodyFields: ['name*'] });
  assert.equal(JSON.parse((await call('list_operations', { filter: 'disable' })).content[0].text).length, 1);
});

test('check returns structured findings with the fix, and "No findings." for a correct screen', async () => {
  const bad = JSON.parse((await call('check', { html: '<xo-view get="/users"><button xo-click="POST /user">x</button></xo-view>' })).content[0].text);
  assert.equal(bad[0].code, 'XO201');
  assert.match(bad[0].fix, /POST \/users/);
  assert.equal((await call('check', { html: '<xo-view get="/users"><p>ok</p></xo-view>' })).content[0].text, 'No findings.');
  const script = JSON.parse((await call('check', { script: 'await client.load("listUser");' })).content[0].text);
  assert.equal(script[0].code, 'XO201');
  assert.equal((await call('check', {})).isError, true);
});

test('explain_error knows every code check.js can report, and says so for unknown ones', async () => {
  const source = readFileSync(new URL('../../cli/src/check.js', import.meta.url), 'utf8');
  const codes = [...new Set([...source.matchAll(/ \*   (XO\d{3}) /g)].map((m) => m[1]))];
  assert.ok(codes.length >= 12);
  for (const code of codes) assert.ok(EXPLANATIONS[code], `${code} has no explanation in the MCP server`);
  assert.match((await call('explain_error', { code: 'xo201' })).content[0].text, /^XO201:/);
  assert.equal((await call('explain_error', { code: 'XO999' })).isError, true);
});

test('search_docs needs a configured folder, and finds terms in it', async () => {
  assert.equal((await call('search_docs', { query: 'x' })).isError, true);
  const withDocs = createServer({ llms: async () => '', operations: async () => table, docsDir: new URL('../../../docs', import.meta.url).pathname });
  const r = await withDocs.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'search_docs', arguments: { query: 'defineTemplate' } } });
  assert.match(r.result.content[0].text, /admin\.md:\d+:/);
});

test('the stdio program speaks newline-delimited JSON-RPC and keeps stdout clean', async () => {
  const opsFile = join(mkdtempSync(join(tmpdir(), 'xoong-mcp-')), 'operations.json');
  writeFileSync(opsFile, JSON.stringify(table));
  const child = spawn(process.execPath, [new URL('../src/cli.js', import.meta.url).pathname, '--operations', opsFile], { stdio: ['pipe', 'pipe', 'inherit'] });
  const replies = [];
  let buf = '';
  child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { replies.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); } });
  const send = (m) => child.stdin.write(JSON.stringify(m) + '\n');
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_spec', arguments: {} } });
  child.stdin.write('not json\n');
  await new Promise((resolve) => { const t = setInterval(() => { if (replies.length >= 3) { clearInterval(t); resolve(); } }, 20); });
  child.kill();
  assert.equal(replies[0].id, 1);
  assert.match(replies[1].result.content[0].text, /^# xoong/);
  assert.equal(replies[2].error.code, -32700);
});
