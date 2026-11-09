import { test } from 'vitest';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, symlinkSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, EXPLANATIONS } from '../src/server.js';
import { SYNTAX } from '@xoong/cli/html-data';

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
  assert.deepEqual(list.result.tools.map((t) => t.name), ['get_spec', 'list_operations', 'check', 'explain_error', 'explain_syntax', 'search_docs']);
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

test('explain_error knows every code `xoong check`, `xoong doctor` and `xoong sync` can print, and says so for unknown ones', async () => {
  const codesIn = (file) => [...new Set(readFileSync(new URL(file, import.meta.url), 'utf8').match(/\bXO\d{3}\b/g))];
  const check = codesIn('../../cli/src/check.js');
  const doctor = codesIn('../../cli/src/openapi.js');
  assert.ok(check.length >= 30 && doctor.length >= 12, `found ${check.length} check codes and ${doctor.length} doctor codes`);
  for (const code of [...check, ...doctor]) assert.ok(EXPLANATIONS[code], `${code} has no explanation in the MCP server`);
  for (const code of Object.keys(EXPLANATIONS)) assert.ok([...check, ...doctor].includes(code), `${code} is explained but nothing prints it`);
  assert.match((await call('explain_error', { code: 'xo201' })).content[0].text, /^XO201:/);
  assert.match((await call('explain_error', { code: 'XO110' })).content[0].text, /^XO110: An operation has no operationId/); // a doctor code
  assert.match((await call('explain_error', { code: 'XO270' })).content[0].text, /xo-then, xo-notice, xo-confirm/);
  const unknown = await call('explain_error', { code: 'XO999' });
  assert.equal(unknown.isError, true);
  assert.match(unknown.content[0].text, /Known: XO\d{3}/);
});

test('explain_syntax explains an element, an attribute or an attribute of an element, suggests for a typo, and lists everything without a name', async () => {
  const dialog = (await call('explain_syntax', { name: 'xo-dialog' })).content[0].text;
  assert.match(dialog, /^<xo-dialog>: A modal on the native <dialog>/);
  assert.match(dialog, /size \(sm \| wide \| full\)/);
  assert.match((await call('explain_syntax', { name: 'xo-confirm-kind' })).content[0].text, /Values: danger, warning, info, success\./);
  assert.match((await call('explain_syntax', { name: 'xo-pager page-size' })).content[0].text, /^<xo-pager page-size>: Rows per page/);
  const typo = await call('explain_syntax', { name: 'xo-confirm-knd' });
  assert.equal(typo.isError, true);
  assert.match(typo.content[0].text, /Did you mean: xo-confirm-kind\?/);
  assert.equal((await call('explain_syntax', { name: 'nothing-like-it' })).isError, true);
  const all = (await call('explain_syntax', {})).content[0].text;
  for (const name of [...SYNTAX.elements, ...SYNTAX.attributes]) assert.ok(all.includes(name), `${name} is not in the list`);
});

test('explain_syntax answers for every element and attribute xoong defines (a new one needs its description in html-data.js)', async () => {
  for (const name of [...SYNTAX.elements, ...SYNTAX.attributes]) {
    const r = await call('explain_syntax', { name });
    assert.ok(!r.isError, `${name} has no explanation`);
    assert.ok(r.content[0].text.length > name.length + 30, `${name}: ${r.content[0].text}`);
  }
});

test('search_docs needs a docs folder, and finds terms in it', async () => {
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

test('search_docs searches the project docs first and the xoong docs that ship with the package after them', async () => {
  const project = mkdtempSync(join(tmpdir(), 'xoong-mcp-docs-'));
  writeFileSync(join(project, 'notes.md'), 'our rule for defineTemplate: never');
  const both = createServer({ llms: async () => '', operations: async () => table, docsDir: project, bundledDocsDir: new URL('../../../docs', import.meta.url).pathname });
  const text = (await both.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'search_docs', arguments: { query: 'defineTemplate' } } })).result.content[0].text;
  assert.match(text, /^notes\.md:1: our rule/);
  assert.match(text, /\nxoong\/admin\.md:\d+:/);
  const only = createServer({ llms: async () => '', operations: async () => table, bundledDocsDir: new URL('../../../docs', import.meta.url).pathname });
  const r = await only.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'search_docs', arguments: { query: 'defineTemplate' } } });
  assert.match(r.result.content[0].text, /^admin\.md:\d+:/); // no prefix when there is only one folder
  const same = createServer({ llms: async () => '', operations: async () => table, docsDir: new URL('../../../docs', import.meta.url).pathname, bundledDocsDir: new URL('../../../docs/', import.meta.url).pathname });
  const once = (await same.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'search_docs', arguments: { query: 'defineTemplate' } } })).result.content[0].text.split('\n');
  assert.equal(once.length, new Set(once).size); // the same folder is not searched twice
});

test('installed from npm (no repository around it), the server still has the spec and the docs: prepack.mjs puts them in src/', async () => {
  // a copy of the package as npm lays it out: node_modules/@xoong/mcp/src, with @xoong/cli next to it and nothing at the three-folders-up place
  const root = mkdtempSync(join(tmpdir(), 'xoong-mcp-installed-'));
  const installed = join(root, 'node_modules/@xoong/mcp');
  mkdirSync(join(installed, 'src'), { recursive: true });
  cpSync(new URL('../src', import.meta.url).pathname, join(installed, 'src'), { recursive: true });
  cpSync(new URL('../package.json', import.meta.url).pathname, join(installed, 'package.json'));
  symlinkSync(new URL('../../cli', import.meta.url).pathname, join(root, 'node_modules/@xoong/cli'), 'dir');
  const empty = mkdtempSync(join(tmpdir(), 'xoong-mcp-project-')); // a project with no llms.txt and no docs/
  writeFileSync(join(empty, 'operations.json'), JSON.stringify(table));
  const ask = async (name, args) => {
    const child = spawn(process.execPath, [join(installed, 'src/cli.js'), '--operations', join(empty, 'operations.json')], { cwd: empty, stdio: ['pipe', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })}\n`);
    while (!out.includes('\n')) await new Promise((r) => setTimeout(r, 20));
    child.kill();
    return JSON.parse(out).result;
  };
  const before = await ask('get_spec', {});
  assert.equal(before.isError, true, 'without the copy there is no spec to give (the bug prepack.mjs fixes)');
  assert.match(before.content[0].text, /llms\.txt not found/);

  const prepack = new URL('../prepack.mjs', import.meta.url).pathname;
  await new Promise((resolve, reject) => spawn(process.execPath, [prepack, '--src', join(installed, 'src')], { stdio: 'inherit' }).on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`prepack exited ${c}`)))));
  const spec = await ask('get_spec', {});
  assert.equal(spec.content[0].text, readFileSync(new URL('../../../llms.txt', import.meta.url), 'utf8'));
  assert.match((await ask('search_docs', { query: 'defineTemplate' })).content[0].text, /^admin\.md:\d+:/);

  await new Promise((resolve, reject) => spawn(process.execPath, [prepack, '--clean', '--src', join(installed, 'src')], { stdio: 'inherit' }).on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`prepack exited ${c}`)))));
  assert.equal((await ask('get_spec', {})).isError, true); // --clean removes the copies again
});

test('the package ships what prepack.mjs makes: the scripts are declared, the copies are not committed', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(pkg.scripts, { prepack: 'node prepack.mjs', postpack: 'node prepack.mjs --clean' });
  assert.deepEqual(pkg.files, ['src']);
  assert.match(readFileSync(new URL('../.gitignore', import.meta.url), 'utf8'), /^src\/llms\.txt$[\s\S]*^src\/docs\/$/m);
});
