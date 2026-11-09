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

// ---- the newer elements and attributes: completion, hover, quick fixes, version ----------------------------------------------------

import { readFileSync } from 'node:fs';
import { SYNTAX } from '@xoong/cli/html-data';

const request = (s, method, params) => s.handle({ jsonrpc: '2.0', id: 1, method, params }).then(([r]) => r.result);
const at = (s, text, marker, method = 'textDocument/completion', offset = 0) => {
  const index = text.indexOf(marker) + offset;
  const before = text.slice(0, index).split('\n');
  return request(s, method, { textDocument: { uri }, position: { line: before.length - 1, character: before.at(-1).length } });
};
const labels = (items) => items.map((i) => i.label);

test('the server reports the version of the package, not a made-up one', async () => {
  const [r] = await make().handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(r.result.serverInfo, { name: 'xoong-lsp', version: pkg.version });
  assert.notEqual(pkg.version, '0.0.1');
});

test('completion inside an xo-* element offers its own attributes first, with what they do, and the xo-* attributes', async () => {
  const s = make();
  const text = '<xo-pager \n<xo-dialog hea\n<xo-table columns="a" \n<div class="x" xo-c';
  await open(s, text);
  const pager = await at(s, text, '<xo-pager ', 'textDocument/completion', '<xo-pager '.length);
  assert.deepEqual(labels(pager).slice(0, 2), ['page-size', 'page-sizes']);
  assert.match(pager[0].documentation, /Rows per page/);
  assert.equal(pager[0].detail, '<xo-pager>');
  assert.ok(labels(pager).includes('xo-click'), 'the xo-* attributes work on any element');
  const dialog = await at(s, text, 'hea', 'textDocument/completion', 3);
  assert.deepEqual(labels(dialog), ['heading']); // filtered by what was typed
  const table = await at(s, text, 'columns="a" ', 'textDocument/completion', 'columns="a" '.length);
  assert.ok(labels(table).includes('page-size') && labels(table).includes('empty') && labels(table).includes('xo-then'));
  const div = await at(s, text, 'xo-c', 'textDocument/completion', 4);
  assert.ok(labels(div).includes('xo-confirm-kind') && labels(div).every((l) => l.startsWith('xo-c')));
  assert.ok(!labels(div).includes('page-size'));
  // a plain element after a space is left to the editor's own HTML completion
  const plain = '<div class="x" ';
  await open(s, plain);
  assert.deepEqual(await at(s, plain, 'class="x" ', 'textDocument/completion', 'class="x" '.length), []);
});

test('completion of the attributes of an element works on a tag that spans lines, and offers p-<param> on a view', async () => {
  const s = make();
  const text = '<xo-view get="/users"\n  live\n  ';
  await open(s, text);
  const items = await request(s, 'textDocument/completion', { textDocument: { uri }, position: { line: 2, character: 2 } });
  assert.ok(labels(items).includes('url-params') && labels(items).includes('p-id'), labels(items).join(','));
  const typed = '<xo-view get="/users" p';
  await open(s, typed);
  assert.deepEqual(labels(await at(s, typed, ' p', 'textDocument/completion', 2)), ['p-id']);
  const closed = '<xo-pager page-size="5"></xo-pager> ';
  await open(s, closed);
  assert.deepEqual(await at(s, closed, '</xo-pager> ', 'textDocument/completion', '</xo-pager> '.length), []); // the tag is closed: not inside it
});

test('completion of values: the fixed sets (xo-confirm-kind, size), filtered by what is typed, replacing it', async () => {
  const s = make();
  const text = '<button xo-confirm-kind="d"></button>\n<xo-dialog heading="T" size="">\n<xo-dialog size=\n<xo-avatar status=\'';
  await open(s, text);
  const kind = await at(s, text, 'kind="d', 'textDocument/completion', 'kind="d'.length);
  assert.deepEqual(labels(kind), ['danger']);
  assert.equal(kind[0].textEdit.newText, 'danger');
  assert.equal(kind[0].textEdit.range.end.character - kind[0].textEdit.range.start.character, 1); // the typed "d" is replaced
  assert.match(kind[0].documentation, /icon and the matching colour/);
  assert.deepEqual(labels(await at(s, text, 'size=""', 'textDocument/completion', 'size="'.length)), ['sm', 'wide', 'full']);
  assert.deepEqual(await at(s, text, 'size=\n', 'textDocument/completion', 'size='.length), []); // no quote yet: nothing to complete
  assert.deepEqual(labels(await at(s, text, "status='", 'textDocument/completion', "status='".length)), ['ok', 'warn', 'muted']);
  const other = '<xo-dialog heading="';
  await open(s, other);
  assert.deepEqual(await at(s, other, 'heading="', 'textDocument/completion', 'heading="'.length), []); // free text has no values
});

test('xo-open completes with the ids of the <xo-dialog>s in the file', async () => {
  const s = make();
  const text = '<xo-dialog id="add" heading="A"></xo-dialog><xo-dialog\n  heading="B" id=\'edit\'></xo-dialog><div id="nope"></div>\n<button xo-open="#e">';
  await open(s, text);
  const edit = await at(s, text, '"#e', 'textDocument/completion', 3);
  assert.deepEqual(labels(edit), ['#edit']);
  assert.equal(edit[0].textEdit.newText, '#edit');
  assert.deepEqual(labels(await at(s, text, '"#e', 'textDocument/completion', 2)).sort(), ['#add', '#edit']);
});

test('every element and attribute of the syntax lists can be completed', async () => {
  const s = make();
  const text = '<xo-\n<p xo-';
  await open(s, text);
  const tags = labels(await request(s, 'textDocument/completion', { textDocument: { uri }, position: { line: 0, character: 4 } }));
  const attributes = labels(await request(s, 'textDocument/completion', { textDocument: { uri }, position: { line: 1, character: 6 } }));
  for (const name of SYNTAX.elements) assert.ok(tags.includes(name), `<${name}> is not offered`);
  for (const name of SYNTAX.attributes) assert.ok(attributes.includes(name), `${name} is not offered`);
});

test('hover explains an attribute of an xo-* element, its values, and p-<param>', async () => {
  const s = make();
  const text = '<xo-dialog heading="T" size="wide" dismiss>\n<xo-view get="/users" p-id="3">\n<button xo-confirm-kind="danger" xo-confirm="x">\n<div size="x" heading="y">\n<xo-pager page-size="5">';
  await open(s, text);
  const hover = (marker, extra = 1) => at(s, text, marker, 'textDocument/hover', extra);
  const size = await hover(' size="wide"', 3);
  assert.match(size.contents.value, /^\*\*<xo-dialog> size\*\*\n\n`sm`, `wide` or `full`[\s\S]*Values: `sm`, `wide`, `full`$/);
  assert.match((await hover(' heading="T"', 3)).contents.value, /\*\*<xo-dialog> heading\*\*[\s\S]*The title/);
  assert.match((await hover(' dismiss', 3)).contents.value, /\*\*<xo-dialog> dismiss\*\*[\s\S]*click outside/);
  assert.match((await hover('p-id', 2)).contents.value, /^\*\*p-id\*\*[\s\S]*path parameter "id"/);
  assert.match((await hover('xo-confirm-kind', 5)).contents.value, /^\*\*xo-confirm-kind\*\*[\s\S]*Values: `danger`, `warning`, `info`, `success`$/);
  assert.match((await hover('page-size', 3)).contents.value, /\*\*<xo-pager> page-size\*\*[\s\S]*Rows per page/);
  assert.equal(await hover(' size="x"', 3), null); // a <div> has no such attribute: nothing to say
  assert.equal(await hover('heading="y"', 3), null);
});

test('quick fixes: a misspelled attribute, element and value are replaced by the closest one', async () => {
  const s = make();
  const text = '<xo-view get="/users"><button xo-clik="x">x</button>\n<xo-tabel></xo-tabel>\n<xo-dialog heading="T" size="wid"></xo-dialog></xo-view>';
  const d = diagnostics(await open(s, text));
  assert.deepEqual(d.map((x) => x.code).sort(), ['XO230', 'XO230', 'XO271']);
  const [r] = await s.handle({ jsonrpc: '2.0', id: 2, method: 'textDocument/codeAction', params: { textDocument: { uri }, context: { diagnostics: d } } });
  assert.deepEqual(r.result.map((a) => a.title).sort(), ['Use "wide"', 'Use <xo-table>', 'Use xo-click']);
  const lines = text.split('\n');
  for (const action of r.result) {
    const [edit] = action.edit.changes[uri];
    const row = lines[edit.range.start.line];
    lines[edit.range.start.line] = row.slice(0, edit.range.start.character) + edit.newText + row.slice(edit.range.end.character);
  }
  assert.equal(lines.join('\n'), '<xo-view get="/users"><button xo-click="x">x</button>\n<xo-table></xo-tabel>\n<xo-dialog heading="T" size="wide"></xo-dialog></xo-view>'); // the closing tag is the author's to rename
});

test('diagnostics for the newer rules arrive with their code, level and fix', async () => {
  const s = make();
  const text = '<xo-view get="/users">\n<button xo-click="POST /users/{id}/disable" xo-confirm-kind="danger">x</button>\n<xo-pager></xo-pager>\n</xo-view>';
  const d = diagnostics(await open(s, text));
  assert.deepEqual(d.map((x) => [x.code, x.severity]), [['XO270', 1], ['XO250', 1]]);
  assert.match(d[0].message, /xo-confirm-kind does nothing without xo-confirm/);
  assert.match(d[0].message, /\nfix: Add xo-confirm=/);
  assert.equal(d[1].range.start.line, 2);
});
