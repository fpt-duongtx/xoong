#!/usr/bin/env node
// Run xoong's OpenAPI pipeline over a folder of real-world specs and report what happens.
//
//   node tools/corpus.mjs <folder> [--tsc] [--hints folder-with-<spec>.hints.json]
//
// For every *.openapi.json / *.openapi.yaml: analyze, count operations/entities/findings, generate
// api.d.ts, and (with --tsc) type-check it with `tsc --strict`. YAML files are compared with a
// JSON twin of the same name when one exists. The specs themselves are not part of this repo
// (each has its own license); keep them outside the working tree.
import { readdirSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { analyze, generateDts } from '../packages/cli/src/openapi.js';
import { load } from '../packages/cli/src/commands.js';

const [dir, ...flags] = process.argv.slice(2);
if (!dir) { console.error('usage: node tools/corpus.mjs <folder> [--tsc] [--hints <folder>]'); process.exit(2); }
const tsc = flags.includes('--tsc');
const hintsDir = flags.includes('--hints') ? flags[flags.indexOf('--hints') + 1] : undefined;
const out = mkdtempSync(join(tmpdir(), 'xoong-corpus-'));

const specs = [
  ...readdirSync(dir).filter((f) => /\.openapi\.(json|yaml)$/.test(f)).map((f) => ({ name: f, path: join(dir, f) })),
  ...(existsSync(join(dir, 'broken')) ? readdirSync(join(dir, 'broken')).filter((f) => /\.json$/.test(f)).map((f) => ({ name: 'broken/' + f, path: join(dir, 'broken', f) })) : []),
];

const results = new Map();
let failures = 0;
for (const { name, path } of specs) {
  const row = {};
  try {
    const hintFile = hintsDir && join(hintsDir, basename(name).replace(/\.openapi\.(json|yaml)$/, '.hints.json'));
    const hints = hintFile && existsSync(hintFile) ? JSON.parse(readFileSync(hintFile, 'utf8')) : undefined;
    const t0 = performance.now();
    const a = analyze(await load(path), { hints });
    row.ms = Math.round(performance.now() - t0);
    row.ops = Object.keys(a.operations).length;
    row.ents = Object.keys(a.entities).length;
    row.err = a.problems.filter((p) => p.level === 'error').length;
    row.warn = a.problems.length - row.err;
    row.codes = [...new Set(a.problems.filter((p) => p.level === 'error').map((p) => p.code))].join(',');
    const dts = join(out, name.replace(/\//g, '_') + '.d.ts');
    writeFileSync(dts, generateDts(a));
    if (tsc) {
      try { execFileSync('npx', ['tsc', '--noEmit', '--strict', '--target', 'es2022', dts], { stdio: 'pipe' }); row.tsc = 'ok'; }
      catch (e) { row.tsc = 'FAIL'; failures++; row.detail = String(e.stdout).split('\n').slice(0, 2).join(' | '); }
    }
  } catch (e) { row.crash = String(e.message).split('\n')[0].slice(0, 100); }
  results.set(name, row);
}

for (const [name, r] of results) {
  const twin = name.endsWith('.yaml') ? results.get(name.replace(/yaml$/, 'json')) : undefined;
  const same = twin && !twin.crash && !r.crash ? (twin.ops === r.ops && twin.ents === r.ents && twin.warn === r.warn && twin.err === r.err ? ' yaml==json' : ' YAML!=JSON') : '';
  if (twin && same.includes('!=')) failures++;
  console.log(name.padEnd(58), r.crash ? `unsupported: ${r.crash}` : `ops=${r.ops} ents=${r.ents} err=${r.err}${r.codes ? `(${r.codes})` : ''} warn=${r.warn} ${r.ms}ms${r.tsc ? ' tsc=' + r.tsc : ''}${same}`);
  if (r.detail) console.log('   ', r.detail);
}
console.log(`\n${results.size} documents, generated types in ${out}`);
process.exitCode = failures ? 1 : 0;
