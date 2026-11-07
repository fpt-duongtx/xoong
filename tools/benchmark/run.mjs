// Score a set of attempts: a folder with one sub-folder per task, each holding the files an assistant produced.
//   node tools/benchmark/run.mjs <attempts folder>      prints one line per task and the pass rate
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { score, tasks } from './score.mjs';

const root = process.argv[2];
if (!root) { console.error('usage: node tools/benchmark/run.mjs <attempts folder>'); process.exit(2); }
let passed = 0, ran = 0;
for (const name of Object.keys(tasks)) {
  const dir = join(root, name);
  if (!(await access(dir).then(() => true, () => false))) { console.log(`${name.padEnd(14)} (no attempt)`); continue; }
  const r = await score(name, dir);
  ran++; if (r.pass) passed++;
  console.log(`${name.padEnd(14)} ${r.pass ? 'PASS' : 'FAIL'}${r.failures.length ? '  ' + r.failures.join('; ') : ''}`);
}
console.log(`\nfirst-attempt correctness: ${passed}/${ran}`);
process.exitCode = passed === ran ? 0 : 1;
