// Writes what a model needs, one folder per task, and a manifest of what was written (with the hashes that identify it).
//
//   node tools/benchmark/prepare.mjs <folder> [--tasks crud-admin,paging-filter]
//
// <folder>/<task>/prompt.md   the whole single-turn prompt (give it to the model as the user message, no tools)
// <folder>/manifest.json      suite version, xoong version, hashes of llms.txt, the instructions and each prompt
import { writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tasks, promptOf, fingerprint } from './suite.mjs';

const args = process.argv.slice(2);
const out = args[0];
if (!out || out.startsWith('--')) { console.error('usage: node tools/benchmark/prepare.mjs <folder> [--tasks a,b]'); process.exit(2); }
const i = args.indexOf('--tasks');
const names = i >= 0 ? args[i + 1].split(',') : Object.keys(tasks);
for (const n of names) if (!tasks[n]) { console.error(`unknown task "${n}" (known: ${Object.keys(tasks).join(', ')})`); process.exit(2); }

for (const name of names) {
  await mkdir(join(out, name), { recursive: true });
  await writeFile(join(out, name, 'prompt.md'), await promptOf(name));
}
const fp = await fingerprint();
await writeFile(join(out, 'manifest.json'), JSON.stringify({ ...fp, tasks: names }, null, 2) + '\n');
console.log(`wrote ${names.length} prompts to ${resolve(out)}  (suite ${fp.suiteVersion}, xoong ${fp.xoong}, llms.txt ${fp.llmsSha256})`);
