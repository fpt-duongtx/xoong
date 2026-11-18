// The suite: the tasks, the one prompt every model gets, and the hashes that say exactly what was measured.
// Anything that changes what an assistant sees (llms.txt, a task text, an OpenAPI file, the prompt below) changes a hash, and a result records them, so two
// results are comparable only when their hashes match.
import { readFile, mkdtemp } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sync } from '../../packages/cli/src/commands.js';
import { describeResponse } from '../../packages/cli/src/check.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');

/** Bump when the protocol or the way a task is scored changes in a way that makes old results incomparable. */
export const SUITE_VERSION = 2;

export const tasks = JSON.parse(await readFile(join(here, 'tasks/tasks.json'), 'utf8'));

export const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/** The one instruction block. Deliberately plain: it says what to produce and in which form, and nothing about how to use xoong (that is what llms.txt is for). */
export const INSTRUCTIONS = `You are building web screens with xoong, a small web framework. You get three things below: (1) the xoong spec, (2) the operations of the API you build against, (3) the task.

How to answer:
- Answer in ONE message. Do not ask questions. Do not use tools; everything you need is below.
- Write every file the task asks for, complete and ready to use, as a line "FILE: <path>" followed by a fenced code block with the whole file.
- Write only the files the task asks for. No explanations are needed.`;

/** The operations of a task's API, in the shape the MCP tool list_operations gives. */
export async function operationsOf(taskName) {
  const task = tasks[taskName];
  const out = await mkdtemp(join(tmpdir(), 'xoong-ops-'));
  await sync(join(here, 'tasks', task.spec), { out, hints: task.hints ? join(here, 'tasks', task.hints) : undefined });
  const table = JSON.parse(await readFile(join(out, 'operations.json'), 'utf8'));
  const rows = Object.values(table.operations).map((o) => ({ id: o.id, call: `${o.method} ${o.path}`, ...(o.query ? { query: o.query } : {}), ...(describeResponse(o.response) ? { response: describeResponse(o.response) } : {}), ...(o.bodyFields ? { bodyFields: o.bodyFields.map((b) => b.name + (b.required ? '*' : '')) } : {}), ...(o.stream ? { stream: true } : {}), ...(o.multipart ? { multipart: true } : {}) }));
  return { table, text: JSON.stringify(rows, null, 2) };
}

/** The complete prompt of a task. */
export async function promptOf(taskName) {
  const llms = await readFile(join(root, 'llms.txt'), 'utf8');
  const taskText = (await readFile(join(here, 'tasks', taskName, 'task.md'), 'utf8')).trim();
  const ops = await operationsOf(taskName);
  const files = tasks[taskName].files.join(', ');
  return `${INSTRUCTIONS}\n\n===== 1. THE XOONG SPEC =====\n${llms.trim()}\n\n===== 2. THE OPERATIONS OF THE API (${tasks[taskName].spec.split('/')[0]}) =====\n${ops.text}\n\n===== 3. THE TASK =====\n${taskText}\n\nFiles to write: ${files}.\n`;
}

/** What identifies this version of the suite and of what the assistant sees. */
export async function fingerprint() {
  const llms = await readFile(join(root, 'llms.txt'), 'utf8');
  const prompts = {};
  for (const name of Object.keys(tasks)) prompts[name] = sha256(await promptOf(name)).slice(0, 12);
  const pkg = JSON.parse(await readFile(join(root, 'packages/xoong/package.json'), 'utf8'));
  return { suiteVersion: SUITE_VERSION, xoong: pkg.version, llmsSha256: sha256(llms).slice(0, 12), instructionsSha256: sha256(INSTRUCTIONS).slice(0, 12), prompts };
}

/**
 * Files from a model's answer: "FILE: path" (or a heading, a bold line or a code-fence info string with the path) followed by a fenced block.
 * Returns { path: content }. Paths that leave the folder are refused.
 */
export function parseFiles(answer) {
  const files = {};
  const re = /(?:^|\n)[ \t]*(?:#{1,6}\s*|\*\*|`)?(?:FILE|File|file)\s*:\s*`?([^\s`*]+)`?\**[ \t]*\n+[ \t]*(`{3,}|~{3,})[^\n]*\n([\s\S]*?)\n[ \t]*\2[ \t]*(?=\n|$)/g;
  for (const m of answer.matchAll(re)) {
    const path = m[1].replace(/^\.?\//, '');
    if (!path || path.includes('..') || path.startsWith('/')) continue;
    files[path] = m[3] + '\n';
  }
  return files;
}
