// @ts-check
/**
 * `xoong check`: static checks for HTML screens against the synced operations table.
 * Every finding has a stable code, a location and a fix, in the same shape as `xoong doctor`.
 *
 *   XO201 unknown operation (with the closest match)
 *   XO202 xo-click calls a GET operation (reads belong on <xo-view get>)
 *   XO203 <xo-view get> uses an operation that is not GET
 *   XO210 <xo-view get> path parameter has no p-<name> attribute
 *   XO220 xo-submit is not on a <form>
 *   XO221 empty xo-each / xo-if / xo-body expression
 *   XO230 unknown xo-* attribute or element (with the closest match)
 *   XO240 button/link triggered by xo-click has no accessible name
 *   XO241 xo-click on a non-interactive element (not reachable by keyboard)
 *   XO250 <xo-table sortable|page-size> but the view's operation lacks the query parameters (sort | limit, offset)
 *   XO204 client.load/query on a non-GET operation, or client.mutate/stream on a GET (JavaScript and TypeScript files)
 *   XO254 xo-selected not on an xo-click element, or xo-select not on a checkbox
 *   XO260 route path missing, not starting with "/", or declared twice
 *   XO261 layout="x" names a layout the router does not declare
 *   XO262 a layout template without an xo-outlet
 *   XO263 p-x=":name" outside a route, or naming a parameter the route does not have
 *   XO253 <xo-table filters="f"> but the view's operation has no query parameter "f"
 *   XO251 <xo-table> outside an <xo-view get>
 *   XO252 <xo-form op> operation has no simple request fields to generate a form from
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { parse } from 'parse5';
import { nearest } from '@xoong/core/closest';
import { XO_ATTRIBUTES, XO_ELEMENTS, XO_UI_ATTRIBUTES, XO_UI_ELEMENTS } from '@xoong/core/syntax';

const ATTRS = new Set([...XO_ATTRIBUTES, ...XO_UI_ATTRIBUTES]);
const TAGS = new Set([...XO_ELEMENTS, ...XO_UI_ELEMENTS]);
const INTERACTIVE = new Set(['button', 'a', 'input', 'select', 'textarea', 'summary']);

/** @typedef {{ level: 'error'|'warn', code: string, file: string, line: number, column: number, message: string, fix: string }} Finding */

/** @param {{ operations: Record<string, any> }} table */
function operationIndex(table) {
  const byRef = new Map();
  for (const op of Object.values(table.operations)) {
    byRef.set(op.id, op);
    byRef.set(`${op.method} ${op.path}`, op);
  }
  return byRef;
}

const attr = (node, name) => node.attrs?.find((a) => a.name === name);
/** The text a screen reader would announce for an element: its text, plus alt/aria-label of descendants. */
const text = (node) => (node.childNodes ?? []).map((c) => {
  if (c.nodeName === '#text') return c.value;
  const label = attr(c, 'aria-label')?.value ?? (c.tagName === 'img' ? attr(c, 'alt')?.value : '') ?? '';
  return label.trim() ? label : text(c);
}).join('').trim();
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/**
 * Check one HTML document.
 * @param {string} source
 * @param {{ operations: Record<string, any> }} table
 * @param {string} [file]
 * @returns {Finding[]}
 */
export function checkHtml(source, table, file = '<input>') {
  /** @type {Finding[]} */
  const findings = [];
  const ops = operationIndex(table);
  const known = [...ops.keys()];
  const document = parse(source, { sourceCodeLocationInfo: true });

  const report = (level, code, node, name, message, fix) => {
    const loc = (name && node.sourceCodeLocation?.attrs?.[name]) || node.sourceCodeLocation;
    findings.push({ level, code, file, line: loc?.startLine ?? 1, column: loc?.startCol ?? 1, message, fix });
  };
  const lookup = (node, name, ref, what) => {
    const key = ref.trim();
    const op = ops.get(key.startsWith('/') ? `GET ${key}` : key.replace(/\s+/g, ' '));
    if (!op) {
      const hint = nearest(key.startsWith('/') ? `GET ${key}` : key, known);
      report('error', 'XO201', node, name, `unknown operation "${key}"${hint ? ` (closest: "${hint}")` : ''}`, hint ? `Use "${hint}"` : 'Run `xoong sync` if the API changed, or fix the operation');
    }
    return op;
  };

  /** @param {any} node @param {{ view?: any }} ctx */
  function walk(node, ctx) {
    const children = node.nodeName === 'template' ? node.content?.childNodes ?? [] : node.childNodes ?? [];
    if (node.tagName) {
      const tag = node.tagName;
      let view = ctx.view;
      if (tag.startsWith('xo-') && !TAGS.has(tag)) {
        const hint = nearest(tag, [...TAGS]);
        report('warn', 'XO230', node, undefined, `unknown element <${tag}>${hint ? ` (closest: <${hint}>)` : ''}`, hint ? `Use <${hint}>` : 'Check the spelling or register the element with define()');
      }
      if (tag === 'xo-view') {
        view = node;
        const get = attr(node, 'get');
        if (get) {
          const op = lookup(node, 'get', get.value);
          if (op) {
            if (op.method !== 'GET') report('error', 'XO203', node, 'get', `<xo-view get> uses ${op.method} ${op.path}, which is not a GET operation`, 'Use a GET operation for reading, and xo-click/xo-submit for mutations');
            const provided = new Set(node.attrs.filter((a) => a.name.startsWith('p-')).map((a) => camel(a.name.slice(2))));
            for (const m of op.path.matchAll(/\{([^}]+)\}/g)) {
              if (!provided.has(m[1])) report('warn', 'XO210', node, 'get', `path parameter "${m[1]}" of ${op.method} ${op.path} has no p-${m[1]} attribute`, `Add p-${m[1]}="..." (or set view.params at runtime and ignore this)`);
            }
          }
        }
      }
      if (tag === 'xo-table') {
        const op = view && attr(view, 'get') ? ops.get((v => (v.startsWith('/') ? `GET ${v}` : v.replace(/\s+/g, ' ')))(attr(view, 'get').value.trim())) : undefined;
        if (!view || !attr(view, 'get')) report('error', 'XO251', node, undefined, '<xo-table> is not inside an <xo-view get="...">', 'Wrap it: <xo-view get="/things"><xo-table ...></xo-table></xo-view>');
        else if (op) {
          const need = [...(attr(node, 'sortable') ? ['sort'] : []), ...(attr(node, 'page-size') ? ['limit', 'offset'] : [])];
          const lacking = need.filter((q) => !(op.query ?? []).includes(q));
          for (const f of (attr(node, 'filters')?.value ?? '').split(',').map((x) => x.trim()).filter(Boolean)) {
            if (!(op.query ?? []).includes(f)) report('error', 'XO253', node, 'filters', `${op.method} ${op.path} has no query parameter "${f}", which the filter box for "${f}" sets`, `Add "${f}" to the operation's parameters, or remove it from filters`);
          }
          if (lacking.length) report('error', 'XO250', node, attr(node, 'sortable') && lacking.includes('sort') ? 'sortable' : 'page-size', `${op.method} ${op.path} has no query parameter ${lacking.map((q) => `"${q}"`).join(', ')}, which <xo-table> needs for ${attr(node, 'sortable') ? 'sorting' : 'paging'}`, `Add ${lacking.join(', ')} to the operation's parameters, or remove ${lacking.includes('sort') ? 'sortable' : 'page-size'}`);
        }
      }
      if (tag === 'xo-form') {
        const ref = attr(node, 'op');
        const op = ref ? lookup(node, 'op', ref.value) : undefined;
        if (op && !(op.bodyFields ?? []).length) report('warn', 'XO252', node, 'op', `${op.method} ${op.path} has no simple request fields, so <xo-form> would be empty`, 'Write the <form xo-submit> by hand, or describe the request body as an object of strings, numbers and booleans');
      }
      for (const a of node.attrs ?? []) {
        if (a.name.startsWith('xo-') && !ATTRS.has(a.name)) {
          const hint = nearest(a.name, [...ATTRS]);
          report('error', 'XO230', node, a.name, `unknown attribute ${a.name}${hint ? ` (closest: ${hint})` : ''}`, hint ? `Use ${hint}` : 'Remove it; xoong has no such attribute');
        }
        if (a.name === 'xo-selected' && !attr(node, 'xo-click')) report('error', 'XO254', node, a.name, 'xo-selected needs xo-click on the same element', 'Add xo-click="METHOD /path/{id}" to run once per ticked row');
        if (a.name === 'xo-select' && (tag !== 'input' || attr(node, 'type')?.value !== 'checkbox')) report('error', 'XO254', node, a.name, `xo-select must be on <input type="checkbox">, found <${tag}>`, 'Use a checkbox, or <xo-table selectable>');
        if ((a.name === 'xo-each' || a.name === 'xo-if' || a.name === 'xo-body') && !a.value.trim()) {
          report('error', 'XO221', node, a.name, `${a.name} is empty`, `Give ${a.name} a path, for example ${a.name}="items"`);
        }
        if (a.name === 'xo-click' || a.name === 'xo-submit') {
          const op = lookup(node, a.name, a.value);
          if (op && op.method === 'GET' && a.name === 'xo-click') report('warn', 'XO202', node, a.name, `${a.name} calls the GET operation ${op.path}`, 'Reads are declared with <xo-view get="...">; xo-click is for mutations');
          if (a.name === 'xo-submit' && tag !== 'form') report('error', 'XO220', node, a.name, `xo-submit must be on a <form>, found <${tag}>`, 'Move xo-submit to the form element');
          if (a.name === 'xo-click') {
            if (!INTERACTIVE.has(tag) && !attr(node, 'role') && !attr(node, 'tabindex')) {
              report('warn', 'XO241', node, a.name, `xo-click on <${tag}> is not reachable by keyboard`, 'Use a <button>, or add role="button" and tabindex="0"');
            }
            if ((tag === 'button' || tag === 'a') && !text(node) && !attr(node, 'aria-label') && !attr(node, 'aria-labelledby') && !attr(node, 'title')) {
              report('warn', 'XO240', node, a.name, `<${tag}> has no accessible name`, 'Add visible text or aria-label');
            }
          }
        }
      }
      // --- <xo-router>: routes, layouts, and route parameters used by views
      let router = ctx.router;
      let route = ctx.route;
      if (tag === 'xo-router') {
        const templates = (node.childNodes ?? []).filter((c) => c.tagName === 'template');
        const layouts = new Set(templates.map((t) => attr(t, 'xo-layout')?.value).filter(Boolean));
        router = { layouts };
        const seen = new Set();
        const hasOutlet = (n) => (n.childNodes ?? []).some((c) => attr(c, 'xo-outlet') || hasOutlet(c)) || (n.content?.childNodes ?? []).some((c) => attr(c, 'xo-outlet') || hasOutlet(c));
        for (const t of templates) {
          const path = attr(t, 'xo-route');
          const layoutName = attr(t, 'xo-layout');
          if (path) {
            const p = path.value.trim();
            if (!p || (p !== '*' && !p.startsWith('/'))) report('error', 'XO260', t, 'xo-route', `route path "${p}" must start with "/" (or be "*" for not found)`, 'Write xo-route="/users/:id"');
            else if (seen.has(p)) report('error', 'XO260', t, 'xo-route', `route "${p}" is declared twice`, 'Remove the duplicate; the first one wins at runtime');
            seen.add(p);
          }
          const uses = attr(t, 'layout');
          if (uses && !layouts.has(uses.value)) {
            const hint = nearest(uses.value, [...layouts]);
            report('error', 'XO261', t, 'layout', `layout "${uses.value}" is not declared${hint ? ` (closest: "${hint}")` : ''}`, hint ? `Use layout="${hint}"` : `Add <template xo-layout="${uses.value}"> with an element that has xo-outlet`);
          }
          if (layoutName && !hasOutlet(t)) report('error', 'XO262', t, 'xo-layout', `layout "${layoutName.value}" has no element with xo-outlet`, 'Put xo-outlet on the element where the route content should appear, for example <main xo-outlet>');
        }
      }
      if (tag === 'template' && attr(node, 'xo-route') && router) route = attr(node, 'xo-route').value.trim();
      for (const a of node.attrs ?? []) {
        if (a.name.startsWith('p-') && a.value.startsWith(':')) {
          const name = a.value.slice(1);
          const names = route ? [...route.matchAll(/:([\w-]+)/g)].map((m) => m[1]) : null;
          if (!names) report('error', 'XO263', node, a.name, `${a.name}="${a.value}" reads a route parameter, but this is not inside a <template xo-route>`, 'Use it inside a route template, or write a fixed value or p-x="?query"');
          else if (!names.includes(name)) {
            const hint = nearest(name, names);
            report('error', 'XO263', node, a.name, `route "${route}" has no parameter ":${name}"${hint ? ` (closest: ":${hint}")` : ''}`, hint ? `Use ${a.name}=":${hint}"` : `Add :${name} to the route path`);
          }
        }
      }
      ctx = { view, router, route };
    }
    for (const child of children) walk(child, ctx);
  }
  walk(document, {});
  findings.sort((a, b) => a.line - b.line || a.column - b.column);
  return findings;
}

/**
 * Template literals tagged `html` in a script: [{ text, line, column }]. `text` has the same shape as the source (same line
 * breaks, same widths): each `${...}` hole becomes "x" followed by spaces and keeps its newlines, so line and column of any
 * finding inside the template map straight back to the file. `line`/`column` point at the first character of the template.
 *
 * A small scanner, not a parser: it skips comments, strings, nested templates and regex literals, so `html\`` inside a comment or
 * string is not a template and braces inside strings do not end a hole. Anything it cannot read is skipped, never guessed.
 */
export function htmlTemplates(source) {
  const out = [];
  const n = source.length;
  let i = 0;
  let prevSignificant = ''; // last non-space code character: tells a regex literal from a division

  /** Skip a quoted string starting at i (the quote); returns the index after it. */
  const skipString = (q) => { for (i++; i < n && source[i] !== q && source[i] !== '\n'; i++) if (source[i] === '\\') i++; return i + 1; };
  /** Skip a template literal (any tag) starting at i (the backtick), including its holes; returns the index after it. */
  const skipTemplate = () => {
    for (i++; i < n && source[i] !== '`'; i++) {
      if (source[i] === '\\') i++;
      else if (source[i] === '$' && source[i + 1] === '{') { i += 2; skipCode('}'); i--; }
    }
    return i + 1;
  };
  /** Skip code until the closing brace of a hole (depth 0), starting after the opening one. Leaves i after the brace. */
  const skipCode = (until) => {
    let depth = 0;
    while (i < n) {
      const c = source[i];
      if (c === '"' || c === "'") { i = skipString(c); continue; }
      if (c === '`') { i = skipTemplate(); continue; }
      if (c === '/' && source[i + 1] === '/') { while (i < n && source[i] !== '\n') i++; continue; }
      if (c === '/' && source[i + 1] === '*') { const e = source.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
      if (c === '{') depth++;
      else if (c === '}') { if (depth === 0 && until === '}') { i++; return; } depth--; }
      i++;
    }
  };

  while (i < n) {
    const c = source[i];
    if (c === '"' || c === "'") { i = skipString(c); prevSignificant = c; continue; }
    if (c === '/' && source[i + 1] === '/') { while (i < n && source[i] !== '\n') i++; continue; }
    if (c === '/' && source[i + 1] === '*') { const e = source.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '/' && /[(,=:[!&|?{};]|^$/.test(prevSignificant)) { // regex literal
      let inClass = false;
      for (i++; i < n && source[i] !== '\n'; i++) {
        if (source[i] === '\\') i++; else if (source[i] === '[') inClass = true; else if (source[i] === ']') inClass = false; else if (source[i] === '/' && !inClass) break;
      }
      i++; prevSignificant = '/'; continue;
    }
    if (c === '`') {
      const tagged = /(?:^|[^\w$.])html\s*$/.test(source.slice(Math.max(0, i - 40), i));
      if (!tagged) { i = skipTemplate(); prevSignificant = '`'; continue; }
      const start = i + 1;
      let text = '';
      for (i++; i < n && source[i] !== '`'; i++) {
        if (source[i] === '\\') { text += source.slice(i, i + 2); i++; continue; }
        if (source[i] === '$' && source[i + 1] === '{') {
          const from = i;
          i += 2; skipCode('}'); i--; // i is now on the closing brace
          const hole = source.slice(from, i + 1);
          text += 'x' + hole.slice(1).replace(/[^\n]/g, ' ');
          continue;
        }
        text += source[i];
      }
      const before = source.slice(0, start).split('\n');
      out.push({ text, line: before.length, column: before[before.length - 1].length + 1 });
      i++; prevSignificant = '`'; continue;
    }
    if (!/\s/.test(c)) prevSignificant = c;
    i++;
  }
  return out;
}

/**
 * Check a JavaScript or TypeScript file: HTML inside html`...` templates, and the first argument of
 * client.load / query / mutate / stream when it is a string literal.
 * @param {string} source
 * @param {{ operations: Record<string, any> }} table
 * @param {string} [file]
 * @returns {Finding[]}
 */
export function checkScript(source, table, file = '<input>') {
  /** @type {Finding[]} */
  const findings = [];
  for (const t of htmlTemplates(source)) {
    for (const f of checkHtml(t.text, table, file)) {
      findings.push({ ...f, line: t.line + f.line - 1, column: f.line === 1 ? t.column + f.column - 1 : f.column }); // text has the source's shape
    }
  }
  const ops = operationIndex(table);
  const known = [...ops.keys()];
  const lineCol = (index) => { const lines = source.slice(0, index).split('\n'); return { line: lines.length, column: lines[lines.length - 1].length + 1 }; };
  // Only calls on something that looks like a xoong client: `client`, `xoongClient`, `getClient()`, `xo` (so `db.query('SELECT 1')` is left alone).
  for (const m of source.matchAll(/(?:\b\w*[cC]lient|\bxo|\bgetClient\(\))\s*\.(load|query|mutate|stream)\(\s*(['"])([^'"\n]+)\2/g)) {
    const [, method, , ref] = m;
    const key = ref.startsWith('/') ? `GET ${ref}` : ref.replace(/\s+/g, ' ').trim();
    const at = lineCol(m.index + m[0].indexOf(ref));
    const op = ops.get(key);
    if (!op) {
      const hint = nearest(key, known);
      findings.push({ level: 'error', code: 'XO201', file, ...at, message: `unknown operation "${ref}"${hint ? ` (closest: "${hint}")` : ''}`, fix: hint ? `Use "${hint}"` : 'Run `xoong sync` if the API changed, or fix the operation' });
    } else if ((method === 'load' || method === 'query') && op.method !== 'GET') {
      findings.push({ level: 'error', code: 'XO204', file, ...at, message: `client.${method}() reads, but ${op.method} ${op.path} is not a GET operation`, fix: 'Use client.mutate() for writes' });
    } else if (method === 'mutate' && op.method === 'GET') {
      findings.push({ level: 'error', code: 'XO204', file, ...at, message: `client.mutate() writes, but ${op.path} is a GET operation`, fix: 'Use client.load() or client.query() for reads' });
    }
  }
  findings.sort((a, b) => a.line - b.line || a.column - b.column);
  return findings;
}

/** Collect .html files from files and folders (skips node_modules and dot folders). */
export async function collectHtml(paths) {
  const out = [];
  const visit = async (p) => {
    const s = await stat(p);
    if (s.isDirectory()) {
      for (const name of await readdir(p)) if (!['node_modules', 'dist', 'build', 'coverage'].includes(name) && !name.startsWith('.')) await visit(join(p, name));
    } else if (['.html', '.htm', '.js', '.mjs', '.ts', '.mts'].includes(extname(p).toLowerCase()) && !p.endsWith('.d.ts') && !p.endsWith('.min.js')) out.push(p);
  };
  for (const p of paths) await visit(p);
  return out.sort();
}

/** @returns {Promise<{ findings: Finding[], files: number }>} */
export async function checkFiles(paths, table) {
  const files = await collectHtml(paths);
  const findings = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    findings.push(...(/\.html?$/i.test(file) ? checkHtml(source, table, file) : checkScript(source, table, file)));
  }
  return { findings, files: files.length };
}

/** Human-readable report. */
export function formatFindings(findings, { files = 0 } = {}) {
  const lines = findings.map((f) => `${f.file}:${f.line}:${f.column}  ${f.level} ${f.code}  ${f.message}\n    fix: ${f.fix}`);
  const errors = findings.filter((f) => f.level === 'error').length;
  lines.push(`\n${files} files, ${errors} errors, ${findings.length - errors} warnings`);
  return lines.join('\n');
}
