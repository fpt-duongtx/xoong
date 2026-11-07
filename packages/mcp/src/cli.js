#!/usr/bin/env node
// @ts-check
// xoong-mcp [--operations .xoong/operations.json] [--llms llms.txt] [--docs docs]
import { readFile, access } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createServer } from './server.js';

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const opsFile = flag('--operations', '.xoong/operations.json');
const exists = (p) => access(p).then(() => true, () => false);

const server = createServer({
  async llms() {
    // the project's own file first, then the copy that sits at the repository root of this package
    for (const p of [flag('--llms'), 'llms.txt', fileURLToPath(new URL('../../../llms.txt', import.meta.url))].filter(Boolean)) if (await exists(p)) return readFile(p, 'utf8');
    throw new Error('llms.txt not found: pass --llms <file>');
  },
  async operations() {
    try { return JSON.parse(await readFile(opsFile, 'utf8')); } catch { throw new Error(`cannot read ${opsFile}: run \`xoong sync <openapi>\` first or pass --operations <file>`); }
  },
  docsDir: flag('--docs') ?? ((await exists('docs')) ? 'docs' : undefined),
});

const lines = createInterface({ input: process.stdin });
for await (const line of lines) {
  if (!line.trim()) continue;
  let msg;
  try { msg = JSON.parse(line); } catch { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n'); continue; }
  const out = await server.handle(msg);
  if (out) process.stdout.write(JSON.stringify(out) + '\n'); // stdout carries protocol messages only
}
