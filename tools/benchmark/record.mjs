// Scores a set of attempts and records the result, with everything that identifies what was measured.
//
//   node tools/benchmark/record.mjs <attempts folder> --model "claude-sonnet-5-5" [--note "..."] [--results benchmarks/results/ai.json] [--no-write]
//
// <attempts folder>/<task>/<run>/<files>    e.g. attempts/crud-admin/run1/index.html (one folder per attempt; a single attempt may also sit directly in <task>/)
// The result is appended to the results file as one run: the model, the date, the hashes of llms.txt and the prompts, every attempt (static stage, behaviour stage,
// the failures) and the rates. Re-scoring the same attempts later (after a scorer change) is `node tools/benchmark/record.mjs <folder> --model ... --rescore <id>`.
import { readdir, readFile, writeFile, stat, mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { score } from './score.mjs';
import { tasks, fingerprint, SUITE_VERSION, parseFiles } from './suite.mjs';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const folder = args[0];
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
if (!folder || folder.startsWith('--') || !opt('model')) { console.error('usage: node tools/benchmark/record.mjs <attempts folder> --model <name> [--note text] [--results file] [--no-write]'); process.exit(2); }
const resultsPath = resolve(opt('results', 'benchmarks/results/ai.json'));

const isDir = async (p) => (await stat(p).catch(() => null))?.isDirectory() ?? false;
const attempts = [];
const scratch = await mkdtemp(join(tmpdir(), 'xoong-answers-'));
for (const task of Object.keys(tasks)) {
  const dir = join(folder, task);
  if (!(await isDir(dir))) continue;
  const entries = (await readdir(dir)).filter((n) => !n.startsWith('.')).sort();
  const subdirs = [];
  for (const r of entries) if (await isDir(join(dir, r))) subdirs.push(r);
  // raw answers of a model (<task>/run1.md, ...): the files are taken out of them in the form the instructions asked for
  for (const f of entries.filter((n) => n.endsWith('.md'))) {
    const out = join(scratch, task, f.replace(/\.md$/, ''));
    for (const [path, text] of Object.entries(parseFiles(await readFile(join(dir, f), 'utf8')))) { await mkdir(dirname(join(out, path)), { recursive: true }); await writeFile(join(out, path), text); }
    await mkdir(out, { recursive: true });
    attempts.push({ task, run: f.replace(/\.md$/, ''), dir: out });
  }
  if (subdirs.length === 0 && !entries.some((n) => n.endsWith('.md'))) { attempts.push({ task, run: 'run1', dir }); continue; }
  for (const r of subdirs) attempts.push({ task, run: r, dir: join(dir, r) });
}
if (!attempts.length) { console.error(`no attempts found under ${folder}`); process.exit(1); }

const results = [];
for (const a of attempts) {
  const r = await score(a.task, a.dir);
  results.push({ task: a.task, run: a.run, pass: r.pass, staticPass: r.staticPass, failures: r.failures, behaviour: r.behaviour });
  console.log(`${a.task.padEnd(14)} ${a.run.padEnd(6)} ${r.pass ? 'PASS' : r.staticPass ? 'FAIL (static ok, behaviour)' : 'FAIL (static)'}${r.failures.length || r.behaviour.length ? '  ' + [...r.failures, ...r.behaviour].slice(0, 3).join('; ') : ''}`);
}

const rate = (list) => ({ attempts: list.length, passed: list.filter((x) => x.pass).length, staticPassed: list.filter((x) => x.staticPass).length });
const perTask = {};
for (const task of Object.keys(tasks)) { const list = results.filter((r) => r.task === task); if (list.length) perTask[task] = rate(list); }
const total = rate(results);
console.log(`\nfirst-attempt correctness: ${total.passed}/${total.attempts} (${Math.round((100 * total.passed) / total.attempts)}%), static stage alone ${total.staticPassed}/${total.attempts}`);

if (args.includes('--no-write')) process.exit(0);
const fp = await fingerprint();
let commit = '';
try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* not a checkout */ }
const date = new Date().toISOString().slice(0, 10);
const run = {
  id: `${date}-${opt('model').replace(/[^a-z0-9.]+/gi, '-').toLowerCase()}-${fp.llmsSha256.slice(0, 6)}`,
  date, model: opt('model'), note: opt('note', ''), commit,
  protocol: 'single turn, no tools, no feedback loop: the model gets the prompt (spec, operations, task) and answers once',
  ...fp, perTask, total, attempts: results,
};
let file = { suiteVersion: SUITE_VERSION, runs: [] };
try { file = JSON.parse(await readFile(resultsPath, 'utf8')); } catch { /* first result */ }
file.suiteVersion = SUITE_VERSION;
file.runs = file.runs.filter((r) => r.id !== run.id).concat(run);
await mkdir(dirname(resultsPath), { recursive: true });
await writeFile(resultsPath, JSON.stringify(file, null, 1) + '\n');
console.log(`recorded as ${run.id} in ${resultsPath}`);
