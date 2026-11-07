import { test } from 'vitest';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createLanguageServer } from '../src/server.js';

const table = { operations: {
  listUsers: { id: 'listUsers', method: 'GET', path: '/users' },
  createUser: { id: 'createUser', method: 'POST', path: '/users', body: true, bodyFields: [{ name: 'name', type: 'string', required: true }] },
  disableUser: { id: 'disableUser', method: 'POST', path: '/users/{id}/disable' },
} };
const make = () => createLanguageServer({ operations: async () => table });
const uri = 'file:///app/index.html';
const open = (s, text, u = uri) => s.handle({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: { textDocument: { uri: u, text } } });
const diagnostics = (out) => out.find((m) => m.method === 'textDocument/publishDiagnostics').params.diagnostics;

test('initialize announces the capabilities', async () => {
  const [r] = await make().handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  assert.deepEqual(Object.keys(r.result.capabilities).sort(), ['codeActionProvider', 'completionProvider', 'hoverProvider', 'textDocumentSync']);
});

test('diagnostics carry the same code, message and fix as xoong check, on the right range', async () => {
  const s = make();
  const d = diagnostics(await open(s, '<xo-view get="/users">\n  <button xo-click="POST /user/{id}/disable">Off</button>\n</xo-view>'));
  assert.equal(d.length, 1);
  assert.equal(d[0].code, 'XO201');
  assert.equal(d[0].severity, 1);
  assert.match(d[0].message, /closest: "POST \/users\/\{id\}\/disable"/);
  assert.match(d[0].message, /fix: Use "POST/);
  assert.equal(d[0].range.start.line, 1);
  assert.ok(d[0].range.end.character > d[0].range.start.character + 5); // covers the attribute, not one letter
  // changing the text re-checks; a corrected screen has none
  const fixed = diagnostics(await s.handle({ jsonrpc: '2.0', method: 'textDocument/didChange', params: { textDocument: { uri }, contentChanges: [{ text: '<xo-view get="/users"></xo-view>' }] } }));
  assert.deepEqual(fixed, []);
});

test('script files are checked too, and a missing operations table is explained once', async () => {
  const ts = diagnostics(await open(make(), 'await client.load("listUser");', 'file:///app/a.ts'));
  assert.equal(ts[0].code, 'XO201');
  const none = createLanguageServer({ operations: async () => null });
  assert.equal(diagnostics(await open(none, '<p></p>'))[0].code, 'no-operations');
});

test('completion offers operations by context: mutations for xo-click, reads for get, filtered by what was typed', async () => {
  const s = make();
  const text = '<xo-view get="/u"><button xo-click="dis"></button></xo-view>';
  await open(s, text);
  const at = (character) => s.handle({ jsonrpc: '2.0', id: 1, method: 'textDocument/completion', params: { textDocument: { uri }, position: { line: 0, character } } }).then(([r]) => r.result);
  const click = await at(text.indexOf('dis') + 3);
  assert.deepEqual(click.map((i) => i.label).sort(), ['POST /users/{id}/disable', 'disableUser']);
  assert.equal(click[0].textEdit.range.start.character, text.indexOf('dis')); // replaces what was typed
  const get = await at(text.indexOf('/u') + 2);
  assert.deepEqual(get.map((i) => i.label), ['/users']); // reads are written as paths in <xo-view get>
  assert.deepEqual(await at(3), []);
});

test('completion of attribute and element names, and hover docs', async () => {
  const s = make();
  await open(s, '<button xo-\n<xo-ta\n<xo-view xo-click="x"></xo-view>');
  const call = (method, line, character) => s.handle({ jsonrpc: '2.0', id: 1, method, params: { textDocument: { uri }, position: { line, character } } }).then(([r]) => r.result);
  assert.ok((await call('textDocument/completion', 0, 11)).some((i) => i.label === 'xo-param'));
  assert.ok((await call('textDocument/completion', 1, 6)).some((i) => i.label === 'xo-table'));
  const h = await call('textDocument/hover', 2, 12);
  assert.match(h.contents.value, /\*\*xo-click\*\*[\s\S]*Call an operation/);
  assert.equal(await call('textDocument/hover', 2, 0), null);
  assert.match((await call('textDocument/hover', 2, 3)).contents.value, /\*\*xo-view\*\*/);
});

test('quick fix replaces an unknown operation with the closest one', async () => {
  const s = make();
  const text = '<xo-view get="/users"><button xo-click="POST /user/{id}/disable">x</button></xo-view>';
  const d = diagnostics(await open(s, text));
  const [r] = await s.handle({ jsonrpc: '2.0', id: 2, method: 'textDocument/codeAction', params: { textDocument: { uri }, context: { diagnostics: d } } });
  const edit = r.result[0].edit.changes[uri][0];
  assert.equal(r.result[0].title, 'Use "POST /users/{id}/disable"');
  const applied = text.slice(0, edit.range.start.character) + edit.newText + text.slice(edit.range.end.character);
  assert.match(applied, /xo-click="POST \/users\/\{id\}\/disable"/);
});

test('the stdio program frames messages with Content-Length and finds .xoong/operations.json', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'xoong-lsp-'));
  mkdirSync(join(dir, '.xoong'));
  writeFileSync(join(dir, '.xoong/operations.json'), JSON.stringify(table));
  const child = spawn(process.execPath, [new URL('../src/cli.js', import.meta.url).pathname], { stdio: ['pipe', 'pipe', 'inherit'] });
  const got = [];
  let buf = Buffer.alloc(0);
  child.stdout.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    for (;;) {
      const sep = buf.indexOf('\r\n\r\n');
      if (sep < 0) return;
      const len = Number(/Content-Length: (\d+)/.exec(buf.subarray(0, sep).toString())[1]);
      if (buf.length < sep + 4 + len) return;
      got.push(JSON.parse(buf.subarray(sep + 4, sep + 4 + len).toString()));
      buf = buf.subarray(sep + 4 + len);
    }
  });
  const send = (m) => { const b = Buffer.from(JSON.stringify(m)); child.stdin.write(`Content-Length: ${b.length}\r\n\r\n`); child.stdin.write(b); };
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { rootUri: pathToFileURL(dir).href } });
  send({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: { textDocument: { uri: pathToFileURL(join(dir, 'a.html')).href, text: '<xo-view get="/nope"></xo-view>' } } });
  await new Promise((resolve) => { const t = setInterval(() => { if (got.length >= 2) { clearInterval(t); resolve(); } }, 20); });
  child.kill();
  assert.equal(got[0].id, 1);
  assert.equal(got[1].params.diagnostics[0].code, 'XO201');
});

test('a malformed message never crashes the server: requests get an error, notifications are ignored', async () => {
  const s = make();
  await open(s, '<p></p>');
  assert.deepEqual(await s.handle({ jsonrpc: '2.0', method: 'textDocument/didChange', params: { textDocument: { uri }, contentChanges: [] } }), []);
  assert.deepEqual(await s.handle({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: {} }), []); // no textDocument
  const [bad] = await s.handle({ jsonrpc: '2.0', id: 9, method: 'textDocument/hover', params: {} });
  assert.equal(bad.error.code, -32603);
  assert.deepEqual(await s.handle(null), []);
  const throwing = createLanguageServer({ operations: async () => { throw new Error('disk gone'); } });
  assert.deepEqual(await open(throwing, '<p></p>'), []); // a failing operations() does not end the session
});

test('the quick fix edits the right text in script files, even with other arguments on the line', async () => {
  const s = make();
  const text = "client.load('listUsr', { a: 'b' });";
  const u = 'file:///app/a.ts';
  const d = diagnostics(await open(s, text, u));
  const [r] = await s.handle({ jsonrpc: '2.0', id: 2, method: 'textDocument/codeAction', params: { textDocument: { uri: u }, context: { diagnostics: d } } });
  const edit = r.result[0].edit.changes[u][0];
  assert.equal(text.slice(0, edit.range.start.character) + edit.newText + text.slice(edit.range.end.character), "client.load('listUsers', { a: 'b' });");
});

test('completion ignores look-alike attributes (data-op, ?get=) and .tsx counts as a script', async () => {
  const s = make();
  const text = '<a data-op="dis" href="?get=l">';
  await open(s, text);
  const at = (c) => s.handle({ jsonrpc: '2.0', id: 1, method: 'textDocument/completion', params: { textDocument: { uri }, position: { line: 0, character: c } } }).then(([r]) => r.result);
  assert.deepEqual(await at(text.indexOf('dis') + 3), []);
  assert.deepEqual(await at(text.indexOf('=l') + 2), []);
  const ts = diagnostics(await open(s, 'client.load("nope");', 'file:///app/a.tsx'));
  assert.equal(ts[0].code, 'XO201');
});
