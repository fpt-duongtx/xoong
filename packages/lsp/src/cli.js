#!/usr/bin/env node
// @ts-check
// xoong-lsp: language server over stdio (Content-Length framing). Finds .xoong/operations.json from the workspace folder upward.
import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLanguageServer } from './server.js';

let root = process.cwd();
let cached = { file: '', mtime: 0, table: /** @type {any} */ (null) };

async function operations() {
  for (let dir = root; ; dir = dirname(dir)) {
    const file = join(dir, '.xoong', 'operations.json');
    try {
      const { mtimeMs } = await stat(file);
      if (cached.file !== file || cached.mtime !== mtimeMs) cached = { file, mtime: mtimeMs, table: JSON.parse(await readFile(file, 'utf8')) };
      return cached.table;
    } catch { /* look one folder up */ }
    if (dirname(dir) === dir) return null;
  }
}

const server = createLanguageServer({ operations });
const send = (m) => { const body = Buffer.from(JSON.stringify(m)); process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`); process.stdout.write(body); };

let buffer = Buffer.alloc(0);
let chain = Promise.resolve(); // messages are handled one after another, so responses cannot overtake each other

async function process_(msg) {
  try {
    if (msg.method === 'initialize' && typeof msg.params?.rootUri === 'string' && msg.params.rootUri.startsWith('file:')) root = fileURLToPath(msg.params.rootUri);
    if (msg.method === 'exit') process.exit(0);
    for (const out of await server.handle(msg)) send(out);
  } catch (e) {
    console.error('xoong-lsp:', e); // stderr only: stdout carries the protocol
  }
}

process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  for (;;) {
    const sep = buffer.indexOf('\r\n\r\n');
    if (sep < 0) return;
    const length = Number(/Content-Length: (\d+)/i.exec(buffer.subarray(0, sep).toString())?.[1]);
    if (!length) { buffer = buffer.subarray(sep + 4); continue; } // a header we cannot use: drop it and keep going
    if (buffer.length < sep + 4 + length) return;
    const body = buffer.subarray(sep + 4, sep + 4 + length).toString();
    buffer = buffer.subarray(sep + 4 + length);
    let msg;
    try { msg = JSON.parse(body); } catch { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); continue; }
    chain = chain.then(() => process_(msg));
  }
});
