// @ts-check
/**
 * `xoong i18n extract`: the messages a project uses, with the source text as the default (ADR-0010).
 * Reads `xo-t` in HTML (and in HTML written inside JavaScript template strings), and `text('key', 'default')` calls.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { parseSpec } from '@xoong/i18n/spec';
import { parse as parseMessage, argsOf } from '@xoong/i18n/message';

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const unescape = (s) => s.replace(/\\(['"\\])/g, '$1').replace(/\\n/g, '\n');

/**
 * @param {string} source @param {string} [file]
 * @returns {{ key: string, default: string, file: string, line: number }[]}
 */
export function extractMessages(source, file = '<input>') {
  const found = [];
  const lineOf = (index) => source.slice(0, index).split('\n').length;
  // xo-t in markup: every start tag that carries it. The default of a bare key is the text up to the next tag; of attr:key the attribute.
  for (const tag of source.matchAll(/<([a-z][\w-]*)\b((?:[^<>"']|"[^"]*"|'[^']*')*?)\sxo-t=(?:"([^"]*)"|'([^']*)')((?:[^<>"']|"[^"]*"|'[^']*')*)>([^<]*)/gi)) {
    const spec = tag[3] ?? tag[4];
    const attrs = `${tag[2]} ${tag[5]}`;
    for (const { attr, key } of parseSpec(spec)) {
      let value;
      if (attr) { const m = new RegExp(`\\s${attr}=(?:"([^"]*)"|'([^']*)')`).exec(attrs); value = m ? decode(m[1] ?? m[2]) : ''; } else value = decode(tag[6]).replace(/\s+/g, ' ').trim();
      found.push({ key, default: value, file, line: lineOf(tag.index ?? 0) });
    }
  }
  // text('key', 'default') and t('key', args, 'default') in scripts
  for (const m of source.matchAll(/\btext\(\s*(['"])([\w.-]+)\1\s*,\s*(['"])((?:[^'"\\\n]|\\.|(?!\3)['"])*)\3/g)) found.push({ key: m[2], default: unescape(m[4]), file, line: lineOf(m.index ?? 0) });
  return found;
}

/** Walk files and folders for .html and script files. */
export async function extractFrom(paths) {
  const out = [];
  const visit = async (p) => {
    const s = await stat(p);
    if (s.isDirectory()) { for (const n of await readdir(p)) if (n !== 'node_modules' && !n.startsWith('.') && n !== 'dist') await visit(join(p, n)); } else if (['.html', '.htm', '.js', '.mjs', '.ts', '.mts'].includes(extname(p))) out.push(...extractMessages(await readFile(p, 'utf8'), p));
  };
  for (const p of paths) await visit(p);
  return out;
}

/**
 * A catalog template from extracted messages: { key: default }. A key used with different defaults is reported.
 * @returns {{ catalog: Record<string, string>, problems: string[] }}
 */
export function toCatalog(messages) {
  /** @type {Record<string, string>} */ const catalog = {};
  const problems = [];
  for (const m of messages) {
    if (m.key in catalog && catalog[m.key] !== m.default) problems.push(`${m.file}:${m.line}: "${m.key}" has another default text than at its first use ("${catalog[m.key]}" vs "${m.default}")`);
    else catalog[m.key] ??= m.default;
    try { parseMessage(m.default); } catch (e) { problems.push(`${m.file}:${m.line}: the text of "${m.key}" is not a valid message: ${/** @type {Error} */ (e).message}`); }
  }
  return { catalog: Object.fromEntries(Object.entries(catalog).sort(([a], [b]) => a.localeCompare(b))), problems };
}

/**
 * Problems of a translation against the source catalog: missing keys, extra keys, a message that cannot be read, placeholders that differ.
 * @returns {string[]}
 */
export function checkCatalog(source, translation, name = 'catalog') {
  const problems = [];
  for (const [key, text] of Object.entries(source)) {
    if (!(key in translation)) { problems.push(`${name}: missing "${key}"`); continue; }
    try {
      const want = [...argsOf(parseMessage(text))].sort().join(',');
      const have = [...argsOf(parseMessage(translation[key]))].sort().join(',');
      if (want !== have) problems.push(`${name}: "${key}" uses {${have}} but the source uses {${want}}`);
    } catch (e) { problems.push(`${name}: "${key}" is not a valid message: ${/** @type {Error} */ (e).message}`); }
  }
  for (const key of Object.keys(translation)) if (!(key in source)) problems.push(`${name}: "${key}" is not used by the source`);
  return problems;
}
