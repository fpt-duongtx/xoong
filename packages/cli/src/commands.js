// @ts-check
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { analyze, generateDts, runtimeTable } from './openapi.js';
import { htmlData } from './html-data.js';

/** Read an OpenAPI document from a file path or an http(s) URL. */
export async function load(source) {
  let text;
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`xoong: could not download ${source} (HTTP ${res.status})`);
    text = await res.text();
  } else {
    text = await readFile(source, 'utf8');
  }
  if (/\.ya?ml(\?|$)/i.test(source)) return parseYaml(text);
  try { return JSON.parse(text); } catch (jsonError) {
    try { return parseYaml(text); } catch { throw new Error(`xoong: could not parse ${source} as JSON or YAML (${jsonError.message})`); }
  }
}

/** True when doctor would fail the command: an error-level finding. Warnings stay a zero exit. */
export const failed = (problems) => problems.some((p) => p.level === 'error');

/** @returns the analysis and writes .xoong/operations.json + .xoong/api.d.ts */
export async function sync(source, { out = '.xoong', hints } = {}) {
  const a = analyze(await load(source), { hints: hints ? JSON.parse(await readFile(hints, 'utf8')) : undefined });
  await mkdir(out, { recursive: true });
  const table = runtimeTable(a);
  await writeFile(join(out, 'operations.json'), JSON.stringify(table, null, 2) + '\n');
  await writeFile(join(out, 'xoong.html-data.json'), JSON.stringify(htmlData(table), null, 2) + '\n'); // editor completion
  await writeFile(join(out, 'api.d.ts'), generateDts(a));
  return a;
}

/**
 * Format findings as `xoong doctor` output. Errors always print in full; each warning code shows
 * up to `limit` examples (use `all` to print everything) so a large API stays readable.
 * @returns {Promise<{ text: string, errors: number, problems: any[] }>}
 */
export async function doctor(source, { hints, all = false, limit = 5 } = {}) {
  const { problems, operations, entities } = analyze(await load(source), { hints: hints ? JSON.parse(await readFile(hints, 'utf8')) : undefined });
  const shown = new Map();
  const hidden = new Map();
  const lines = [];
  for (const p of problems) {
    const n = shown.get(p.code) ?? 0;
    if (p.level === 'warn' && !all && n >= limit) { hidden.set(p.code, (hidden.get(p.code) ?? 0) + 1); continue; }
    shown.set(p.code, n + 1);
    lines.push(`${p.level} ${p.code} ${p.where}\n  ${p.message}\n  fix: ${p.fix}`);
  }
  for (const [code, n] of hidden) lines.push(`... and ${n} more ${code} (run with --all to list them)`);
  const errors = problems.filter((p) => p.level === 'error').length;
  lines.push(`\n${Object.keys(operations).length} operations, ${Object.keys(entities).length} entities, ${errors} errors, ${problems.length - errors} warnings`);
  return { text: lines.join('\n'), errors, problems };
}
