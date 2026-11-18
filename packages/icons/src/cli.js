#!/usr/bin/env node
// xoong-icons: writes the stylesheet for ONLY the icons a project uses, so a set of hundreds costs a few kilobytes.
//   xoong-icons --scan src --scan index.html --out public/icons.css
//   xoong-icons --scan src --include star,heart --variants regular,fill --out icons.css
//   xoong-icons --list                     print every icon name
// Options: --scan <file|dir> (repeatable; reads .html .js .mjs .ts .css .md .json .vue .svelte .jsx .tsx), --include <a,b> icons the scan cannot see
// (built at run time), --variants <regular,fill,bold> (default: regular, plus fill and bold when `xi-fill` / `xi-bold` appear), --legacy (also `.ic[data-ic]`),
// --layer <name>, --no-base (leave out the `.xi` box and modifiers), --out <file> (default: stdout).
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { names, scan, buildCss } from './index.js';

const TEXT = new Set(['.html', '.htm', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.css', '.md', '.json', '.vue', '.svelte', '.xo']);
const args = process.argv.slice(2);
const opt = (flag) => args.flatMap((a, i) => (a === flag ? [args[i + 1]] : []));
const has = (flag) => args.includes(flag);

function* files(path) {
  const st = statSync(path);
  if (!st.isDirectory()) { yield path; return; }
  for (const e of readdirSync(path, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(path, e.name);
    if (e.isDirectory()) yield* files(p); else if (TEXT.has(extname(e.name))) yield p;
  }
}

if (has('--list')) { console.log(names.join('\n')); process.exit(0); }
const roots = opt('--scan');
if (!roots.length && !opt('--include').length) { console.error('xoong-icons: nothing to do. Give --scan <dir|file> and/or --include a,b (see the header of this file), or --list.'); process.exit(2); }
const found = new Set(opt('--include').flatMap((s) => s.split(',').filter(Boolean)));
const variants = new Set(opt('--variants').flatMap((s) => s.split(',')).filter(Boolean));
const autoVariants = !variants.size;
if (autoVariants) variants.add('regular');
const unknown = new Set();
for (const root of roots) for (const f of files(root)) {
  const r = scan(readFileSync(f, 'utf8'));
  r.names.forEach((n) => found.add(n)); r.unknown.forEach((n) => unknown.add(n));
  if (autoVariants) r.variants.forEach((v) => variants.add(v));
}
for (const n of [...found]) if (!names.includes(n)) { unknown.add(n); found.delete(n); }
if (unknown.size) console.error(`xoong-icons: not in the set (ignored): ${[...unknown].join(', ')}`);
const css = buildCss({ names: [...found], variants: [...variants], legacy: has('--legacy'), base: !has('--no-base'), layer: opt('--layer')[0] ?? '' });
const out = opt('--out')[0];
if (out) { writeFileSync(out, css); console.error(`xoong-icons: ${found.size} icons (${[...variants].join(', ')}), ${css.length} bytes -> ${out}`); } else process.stdout.write(css);
