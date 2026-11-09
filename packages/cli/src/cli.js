#!/usr/bin/env node
// @ts-check
import { sync, doctor } from './commands.js';
import { startDev, parseProxyFlags, loadConfig } from './dev.js';
import { checkFiles, formatFindings } from './check.js';
import { scaffold } from './scaffold.js';
import { COMMANDS, parseArgs } from './args.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const HELP = `xoong <command>

  sync <openapi.json|yaml|url> [--out .xoong] [--hints hints.json]   generate operations.json and api.d.ts
  doctor <openapi.json|yaml|url> [--hints hints.json] [--all]   audit the OpenAPI document for xoong
  new <folder> --spec <openapi.json|yaml|url> [--title "My app"] [--link <xoong checkout>]   create a project with a first screen
  check <file|folder>... [--operations .xoong/operations.json] [--format text|json] [--exclude glob]...   check HTML screens
  render <page.html> --api <url> [--url /users/7] [--operations .xoong/operations.json] [--out file]   prerender a page (a route, with --url) with its data (needs @xoong/ssr)
  build [--root .] [--out dist] [--base /admin] [--include path]... [--exclude glob]... [--no-preload]   static output for strict-CSP hosting (no import map, no inline code)
  i18n extract <html|js files or folders>... [--out catalogs/en.json]   list xo-t keys with their source text
  i18n check <catalog.json> --source <en.json>   missing keys, wrong placeholders, invalid messages
  dev [--root .] [--port 5173] [--proxy /api=http://localhost:8080]... [--spa]   serve the app (static, proxy, .ts)
  --version   print the version

Options that do not exist are refused. Exit code: 0 done, 1 findings or a failure (also a refused option), 2 unknown command or a missing argument.
`;

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === '--version' || cmd === '-v') { console.log(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version); process.exit(0); }
if (rest.includes('--help') || rest.includes('-h') || cmd === '--help' || cmd === '-h' || cmd === 'help') { console.log(HELP); process.exit(0); } // never start work on a help request

try {
  // `i18n` has two sub-commands; the table of options is per command (args.js). An option that does not exist is refused, never ignored.
  const name = cmd === 'i18n' ? `i18n ${rest[0]}` : cmd;
  const known = Object.hasOwn(COMMANDS, name);
  const a = known ? parseArgs(name, cmd === 'i18n' ? rest.slice(1) : rest) : null;
  if (!a) {
    console.log(HELP); // an unknown command, or a missing argument
    process.exitCode = cmd ? 2 : 0;
  } else if (cmd === 'sync') {
    const result = await sync(a.args[0], { out: a.value('--out', '.xoong'), hints: a.value('--hints') });
    console.log(`synced ${Object.keys(result.operations).length} operations, ${Object.keys(result.entities).length} entities`);
    const errors = result.problems.filter((p) => p.level === 'error');
    for (const p of errors) console.error(`error ${p.code} ${p.where}\n  ${p.message}\n  fix: ${p.fix}`);
    if (errors.length) process.exitCode = 1;
    const dropped = result.problems.filter((p) => p.code === 'XO113'); // what the document asks for and xoong does not do: said in full, one line per kind
    for (const p of dropped) console.warn(`warning ${p.code}: ${p.message}. ${p.fix}`);
    const warnings = result.problems.length - errors.length - dropped.length;
    if (warnings) console.log(`${warnings} warnings: run "xoong doctor ${a.args[0]}"`);
  } else if (cmd === 'doctor') {
    const { text, errors } = await doctor(a.args[0], { hints: a.value('--hints'), all: a.has('--all') });
    console.log(text);
    process.exitCode = errors ? 1 : 0;
  } else if (cmd === 'new') {
    const result = await scaffold(a.args[0], { spec: a.value('--spec'), title: a.value('--title'), link: a.value('--link') });
    console.log(`created ${result.dir}\n  first screen: ${result.screen ?? 'none (no list operation found)'}\n  next: cd ${a.args[0]} && npm install && npm run dev\n  ${a.value('--link') ? '(packages linked from ' + a.value('--link') + ')' : '(the @xoong/* packages are not published yet: run again with --link <path to the xoong repository>)'}`);
  } else if (cmd === 'check') {
    const opsFile = a.value('--operations', '.xoong/operations.json');
    let table;
    try { table = JSON.parse(await readFile(opsFile, 'utf8')); } catch { throw new Error(`xoong: cannot read ${opsFile}. Run \`xoong sync <openapi>\` first, or pass --operations <file>`); }
    const exclude = [...a.all('--exclude'), ...(((await loadConfig('.')).check ?? {}).exclude ?? [])];
    const { findings, files } = await checkFiles(a.args, table, { exclude });
    console.log(a.value('--format', 'text') === 'json' ? JSON.stringify(findings, null, 2) : formatFindings(findings, { files }));
    process.exitCode = findings.some((f) => f.level === 'error') ? 1 : 0;
  } else if (cmd === 'render') {
    let renderPage;
    try { ({ renderPage } = await import('@xoong/ssr')); } catch { throw new Error('xoong: `render` needs the @xoong/ssr package: npm install @xoong/ssr'); }
    const opsFile = a.value('--operations', '.xoong/operations.json');
    let operations;
    try { operations = JSON.parse(await readFile(opsFile, 'utf8')); } catch { throw new Error(`xoong: cannot read ${opsFile}. Run \`xoong sync <openapi>\` first, or pass --operations <file>`); }
    const at = a.value('--url');
    const html = await renderPage(await readFile(a.args[0], 'utf8'), { operations, baseUrl: a.value('--api'), ...(at ? { url: new URL(at, 'http://xoong.local').href } : {}) });
    const out = a.value('--out');
    if (out) { await mkdir(dirname(out), { recursive: true }); await writeFile(out, html); console.log(`rendered ${a.args[0]} -> ${out}`); } else process.stdout.write(html);
  } else if (name === 'i18n extract') {
    const { extractFrom, toCatalog } = await import('./i18n-extract.js');
    const out = a.value('--out');
    const { catalog, problems } = toCatalog(await extractFrom(a.args));
    const json = JSON.stringify(catalog, null, 2) + '\n';
    if (out) { await mkdir(dirname(out), { recursive: true }); await writeFile(out, json); console.log(`${Object.keys(catalog).length} messages -> ${out}`); } else process.stdout.write(json);
    for (const p of problems) console.error(`error: ${p}`);
    process.exitCode = problems.length ? 1 : 0;
  } else if (name === 'i18n check') {
    const { checkCatalog } = await import('./i18n-extract.js');
    const problems = checkCatalog(JSON.parse(await readFile(/** @type {string} */ (a.value('--source')), 'utf8')), JSON.parse(await readFile(a.args[0], 'utf8')), a.args[0]);
    for (const p of problems) console.error(p);
    console.log(problems.length ? `${problems.length} problems` : 'ok');
    process.exitCode = problems.length ? 1 : 0;
  } else if (cmd === 'build') {
    const { build, CSP } = await import('./build.js');
    const r = await build({ root: a.value('--root', '.'), out: a.value('--out', 'dist'), base: a.value('--base', ''), include: a.all('--include'), exclude: a.all('--exclude'), preload: a.has('--no-preload') ? false : undefined });
    const total = r.files.reduce((n, f) => n + f.bytes, 0);
    const gz = r.files.reduce((n, f) => n + f.gzip, 0);
    console.log(`built ${r.files.length} files into ${r.out} (${(total / 1024).toFixed(1)} KB, ${(gz / 1024).toFixed(1)} KB gzip)`);
    for (const w of r.warnings) console.warn(`warning: ${w}`);
    console.log(`\nruns under:  Content-Security-Policy: ${CSP}`);
  } else if (cmd === 'dev') {
    const port = a.value('--port');
    if (port !== undefined && !(/^\d+$/.test(port) && Number(port) <= 65535)) throw new Error(`xoong dev: --port must be a number from 0 to 65535, not "${port}"`);
    await startDev({ root: a.value('--root'), port: port ? Number(port) : undefined, proxy: parseProxyFlags(a.all('--proxy')), spa: a.has('--spa') || undefined });
    // keep running until interrupted
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
