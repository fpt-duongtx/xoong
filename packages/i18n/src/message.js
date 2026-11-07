// @ts-check
/**
 * The message language of xoong catalogs (ADR-0010): a subset of ICU MessageFormat 1, which is also valid input for the
 * Unicode MessageFormat tooling. Pure functions, no DOM.
 *
 *   Hello {name}                                   argument
 *   {total, number}  {when, date}  {when, time}  {when, relative}      formatted with Intl
 *   {count, plural, =0 {No items} one {# item} other {# items}}        plural categories from Intl.PluralRules; # is the number
 *   {count, plural, offset:1 =0 {Nobody} one {{name} and # other} other {{name} and # others}}
 *   {gender, select, female {her} male {his} other {their}}
 *   {place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}
 *   Use '{' and '}' for literal braces, and '' for an apostrophe
 *
 * A message that cannot be parsed is reported once and shown as it was written; formatting never throws.
 */
import { format as formatValue } from '@xoong/data/format';

/** @typedef {string | { arg: string, type?: string } | { arg: string, kind: 'plural' | 'select' | 'selectordinal', offset: number, options: Record<string, Node[]> } | { hash: true }} Node */

class ParseError extends Error {}

/** @param {string} source @returns {Node[]} */
export function parse(source) {
  let i = 0;
  const n = source.length;

  /** Text and placeholders until `}` (when nested) or the end. */
  function nodes(nested, inPlural) {
    /** @type {Node[]} */ const out = [];
    let text = '';
    const flush = () => { if (text) { out.push(text); text = ''; } };
    while (i < n) {
      const c = source[i];
      if (c === "'") { // quoting: '' is an apostrophe; '{ ... }' up to the closing quote is literal
        if (source[i + 1] === "'") { text += "'"; i += 2; continue; }
        if (source[i + 1] === '{' || source[i + 1] === '}' || (inPlural && source[i + 1] === '#')) {
          const end = source.indexOf("'", i + 1);
          if (end > 0) { text += source.slice(i + 1, end).replace(/''/g, "'"); i = end + 1; continue; }
        }
        text += c; i++; continue;
      }
      if (c === '}') { if (nested) break; throw new ParseError('unmatched }'); }
      if (c === '{') { flush(); out.push(placeholder()); continue; }
      if (c === '#' && inPlural) { flush(); out.push({ hash: true }); i++; continue; }
      text += c; i++;
    }
    flush();
    return out;
  }

  const ws = () => { while (i < n && /\s/.test(source[i])) i++; };
  const word = () => { const s = i; while (i < n && /[^\s,{}]/.test(source[i])) i++; return source.slice(s, i); };

  function placeholder() {
    i++; // {
    ws();
    const arg = word();
    if (!arg) throw new ParseError('empty argument');
    ws();
    if (source[i] === '}') { i++; return { arg }; }
    if (source[i] !== ',') throw new ParseError(`expected "," or "}" after ${arg}`);
    i++; ws();
    const type = word();
    ws();
    if (['number', 'date', 'time', 'relative'].includes(type)) {
      if (source[i] === ',') { i++; ws(); word(); ws(); } // a style ("short", "percent") is accepted and ignored
      if (source[i] !== '}') throw new ParseError(`expected "}" after ${arg}, ${type}`);
      i++;
      return { arg, type };
    }
    if (type === 'plural' || type === 'select' || type === 'selectordinal') {
      if (source[i] !== ',') throw new ParseError(`expected "," after ${type}`);
      i++; ws();
      let offset = 0;
      if (source.startsWith('offset:', i)) { i += 7; offset = Number(word()); ws(); }
      /** @type {Record<string, Node[]>} */ const options = {};
      while (i < n && source[i] !== '}') {
        const key = word();
        if (!key) throw new ParseError(`expected a case in ${type}`);
        ws();
        if (source[i] !== '{') throw new ParseError(`expected "{" after case ${key}`);
        i++;
        options[key] = nodes(true, type !== 'select');
        if (source[i] !== '}') throw new ParseError(`unclosed case ${key}`);
        i++; ws();
      }
      if (source[i] !== '}') throw new ParseError(`unclosed ${type}`);
      if (!options.other) throw new ParseError(`${type} needs an "other" case`);
      i++;
      return { arg, kind: type, offset, options };
    }
    throw new ParseError(`unknown type "${type}"`);
  }

  const result = nodes(false, false);
  if (i < n) throw new ParseError('unexpected input');
  return result;
}

/** The argument names a message uses, nested ones included (for checking that a translation keeps the same placeholders). */
export function argsOf(nodes, out = new Set()) {
  for (const node of nodes) {
    if (typeof node === 'string' || 'hash' in node) continue;
    out.add(node.arg);
    if ('options' in node) for (const list of Object.values(node.options)) argsOf(list, out);
  }
  return out;
}

const warned = new Set();
const report = (source, error) => {
  if (warned.has(source)) return;
  warned.add(source);
  console.error(`xoong i18n: cannot read the message "${source}": ${error.message}. It is shown as written.`);
};

/** @type {Map<string, Node[] | null>} */
const cache = new Map();
function compiled(source) {
  if (!cache.has(source)) {
    try { cache.set(source, parse(source)); } catch (e) { report(source, /** @type {Error} */ (e)); cache.set(source, null); }
  }
  return cache.get(source);
}

/**
 * Format a message.
 * @param {string} source the message
 * @param {(name: string) => any} get where argument values come from (an object lookup, or the scope of a view)
 * @param {string} locale
 */
export function formatMessage(source, get, locale) {
  const tree = compiled(source);
  if (!tree) return source;
  try { return render(tree, get, locale, undefined); } catch { return source; }
}

function render(tree, get, locale, hash) {
  let out = '';
  for (const node of tree) {
    if (typeof node === 'string') { out += node; continue; }
    if ('hash' in node) { out += hash === undefined ? '#' : new Intl.NumberFormat(locale).format(hash); continue; }
    const value = get(node.arg);
    if ('kind' in node) {
      if (node.kind === 'select') { out += render(node.options[String(value)] ?? node.options.other, get, locale, hash); continue; }
      const n = Number(value) - node.offset;
      const exact = node.options[`=${Number(value)}`];
      const category = new Intl.PluralRules(locale, { type: node.kind === 'selectordinal' ? 'ordinal' : 'cardinal' }).select(n);
      out += render(exact ?? node.options[category] ?? node.options.other, get, locale, n);
      continue;
    }
    if (node.type === 'number') out += value == null || value === '' ? '' : formatValue('number', value, locale);
    else if (node.type) out += formatValue(node.type, value, locale);
    else out += value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
  return out;
}
