// First-attempt-correctness scorer (docs/ai-integration.md section 5).
//   node tools/benchmark/score.mjs <task> <folder with the files an assistant produced>
// A task passes when: every expected file exists, `xoong check` reports no errors, every required operation is used,
// every required construct is present, and no forbidden pattern (hand-written HTTP, innerHTML, utility CSS) appears.
import { readFile, access, mkdtemp } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { sync } from '../../packages/cli/src/commands.js';
import { checkHtml } from '../../packages/cli/src/check.js';

const here = dirname(fileURLToPath(import.meta.url));
export const tasks = JSON.parse(await readFile(join(here, 'tasks/tasks.json'), 'utf8'));

const FORBIDDEN = [
  [/\bfetch\s*\(/, 'calls fetch() by hand'], [/\baxios\b|XMLHttpRequest/, 'uses an HTTP library'], [/\.innerHTML\s*=/, 'assigns innerHTML'],
  [/class="[^"]*\b(flex|grid|p-\d|m-\d|text-(sm|lg|xl)|bg-\w+-\d+)\b/, 'uses utility classes'], [/\bonclick=|\bonsubmit=/i, 'uses inline event handlers'],
];

/** @returns {Promise<{ task: string, pass: boolean, failures: string[], findings: any[] }>} */
export async function score(taskName, dir) {
  const task = tasks[taskName];
  if (!task) throw new Error(`unknown task "${taskName}" (known: ${Object.keys(tasks).join(', ')})`);
  const failures = [];
  const out = await mkdtemp(join(tmpdir(), 'xoong-bench-'));
  await sync(join(here, 'tasks', task.spec), { out, hints: task.hints ? join(here, 'tasks', task.hints) : undefined });
  const table = JSON.parse(await readFile(join(out, 'operations.json'), 'utf8'));
  const findings = [];
  let all = '';
  for (const file of task.files) {
    let text;
    try { text = await readFile(join(dir, file), 'utf8'); } catch { failures.push(`missing file ${file}`); continue; }
    all += text + '\n';
    for (const f of checkHtml(text, table, file)) { findings.push(f); if (f.level === 'error') failures.push(`${f.file}:${f.line} ${f.code} ${f.message}`); }
  }
  const css = []; // stylesheets next to the page count for the forbidden-pattern scan too
  for (const f of ['app.css', 'src/app.css']) { try { css.push(await readFile(join(dir, f), 'utf8')); } catch { /* optional */ } }
  const ops = Object.values(table.operations);
  for (const id of task.mustUse) {
    const op = ops.find((o) => o.id === id);
    const used = new RegExp(`\\b${id}\\b`).test(all) || (op && (all.includes(`${op.method} ${op.path}`) || (op.method === 'GET' && new RegExp(`get\\s*=\\s*["']${op.path.replace(/[{}]/g, (c) => `\\${c}`)}["']`).test(all))));
    if (!used) failures.push(`does not use ${id}`);
  }
  for (const needle of task.mustContain) if (!needle.split('|').some((n) => all.includes(n))) failures.push(`does not contain "${needle}"`); // "a|b": either is fine
  for (const [re, what] of FORBIDDEN) if (re.test(all)) failures.push(what);
  void css;
  return { task: taskName, pass: failures.length === 0, failures, findings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [name, dir] = process.argv.slice(2);
  if (!name || !dir) { console.error('usage: node tools/benchmark/score.mjs <task> <folder>'); process.exit(2); }
  const r = await score(name, dir);
  console.log(JSON.stringify(r, null, 2));
  process.exitCode = r.pass ? 0 : 1;
}
