// Turns a model's answer into the files of an attempt.
//
//   node tools/benchmark/extract.mjs <answer.md> <attempt folder>
//
// The answer must hold "FILE: <path>" lines each followed by a fenced block (see the instructions in suite.mjs). Files that are not found are not written; the scorer then says
// "missing file", which is the honest result for an answer that did not follow the form.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { parseFiles } from './suite.mjs';

const [answerPath, out] = process.argv.slice(2);
if (!answerPath || !out) { console.error('usage: node tools/benchmark/extract.mjs <answer.md> <attempt folder>'); process.exit(2); }
const files = parseFiles(await readFile(answerPath, 'utf8'));
for (const [path, text] of Object.entries(files)) {
  await mkdir(dirname(join(out, path)), { recursive: true });
  await writeFile(join(out, path), text);
}
console.log(`${Object.keys(files).length} file(s): ${Object.keys(files).join(', ') || '(none found)'}`);
