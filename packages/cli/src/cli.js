#!/usr/bin/env node
// @ts-check
import { sync, doctor } from './commands.js';
import { startDev, parseProxyFlags } from './dev.js';
import { checkFiles, formatFindings } from './check.js';
import { scaffold } from './scaffold.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const HELP = `xoong <command>

  sync <openapi.json|yaml|url> [--out .xoong] [--hints hints.json]   generate operations.json and api.d.ts
  doctor <openapi.json|yaml|url> [--hints hints.json] [--all]   audit the OpenAPI document for xoong
  new <folder> --spec <openapi.json|yaml|url> [--title "My app"] [--link <xoong checkout>]   create a project with a first screen
  check <file|folder>... [--operations .xoong/operations.json] [--format text|json]   check HTML screens
  render <page.html> --api <url> [--url /users/7] [--operations .xoong/operations.json] [--out file]   prerender a page (a route, with --url) with its data (needs @xoong/ssr)
  dev [--root .] [--port 5173] [--proxy /api=http://localhost:8080] [--spa]   serve the app (static, proxy, .ts)
`;

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name, fallback) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : fallback; };

try {
  if (cmd === 'sync' && rest[0]) {
    const a = await sync(rest[0], { out: flag('--out', '.xoong'), hints: flag('--hints') });
    console.log(`synced ${Object.keys(a.operations).length} operations, ${Object.keys(a.entities).length} entities`);
    const errors = a.problems.filter((p) => p.level === 'error');
    for (const p of errors) console.error(`error ${p.code} ${p.where}\n  ${p.message}\n  fix: ${p.fix}`);
    if (errors.length) process.exitCode = 1;
    const warnings = a.problems.length - errors.length;
    if (warnings) console.log(`${warnings} warnings: run "xoong doctor ${rest[0]}"`);
  } else if (cmd === 'doctor' && rest[0]) {
    const { text, errors } = await doctor(rest[0], { hints: flag('--hints'), all: rest.includes('--all') });
    console.log(text);
    process.exitCode = errors ? 1 : 0;
  } else if (cmd === 'new' && rest[0] && flag('--spec')) {
    const result = await scaffold(rest[0], { spec: flag('--spec'), title: flag('--title'), link: flag('--link') });
    console.log(`created ${result.dir}\n  first screen: ${result.screen ?? 'none (no list operation found)'}\n  next: cd ${rest[0]} && npm install && npm run dev\n  ${flag('--link') ? '(packages linked from ' + flag('--link') + ')' : '(the @xoong/* packages are not published yet: run again with --link <path to the xoong repository>)'}`);
  } else if (cmd === 'check' && rest.length) {
    const opsFile = flag('--operations', '.xoong/operations.json');
    let table;
    try { table = JSON.parse(await readFile(opsFile, 'utf8')); } catch { throw new Error(`xoong: cannot read ${opsFile}. Run \`xoong sync <openapi>\` first, or pass --operations <file>`); }
    const format = flag('--format', 'text');
    const targets = rest.filter((v, i) => !v.startsWith('--') && !['--operations', '--format'].includes(rest[i - 1]));
    const { findings, files } = await checkFiles(targets, table);
    console.log(format === 'json' ? JSON.stringify(findings, null, 2) : formatFindings(findings, { files }));
    process.exitCode = findings.some((f) => f.level === 'error') ? 1 : 0;
  } else if (cmd === 'render' && rest[0] && flag('--api')) {
    let renderPage;
    try { ({ renderPage } = await import('@xoong/ssr')); } catch { throw new Error('xoong: `render` needs the @xoong/ssr package: npm install @xoong/ssr'); }
    const opsFile = flag('--operations', '.xoong/operations.json');
    let operations;
    try { operations = JSON.parse(await readFile(opsFile, 'utf8')); } catch { throw new Error(`xoong: cannot read ${opsFile}. Run \`xoong sync <openapi>\` first, or pass --operations <file>`); }
    const at = flag('--url');
    const html = await renderPage(await readFile(rest[0], 'utf8'), { operations, baseUrl: flag('--api'), ...(at ? { url: new URL(at, 'http://xoong.local').href } : {}) });
    const out = flag('--out');
    if (out) { await mkdir(dirname(out), { recursive: true }); await writeFile(out, html); console.log(`rendered ${rest[0]} -> ${out}`); } else process.stdout.write(html);
  } else if (cmd === 'dev') {
    const proxies = rest.flatMap((v, i) => (rest[i - 1] === '--proxy' ? [v] : []));
    const port = flag('--port');
    await startDev({ root: flag('--root'), port: port ? Number(port) : undefined, proxy: parseProxyFlags(proxies), spa: rest.includes('--spa') || undefined });
    // keep running until interrupted
  } else {
    console.log(HELP);
    process.exitCode = cmd ? 2 : 0;
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
