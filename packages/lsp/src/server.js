// @ts-check
/**
 * xoong language server core: pure message handling, no I/O. `handle(message)` returns the messages to send back
 * (a response and/or notifications), so it can be tested without a process. `cli.js` adds stdio framing.
 *
 * Features (one engine, see docs/editor-integration.md):
 *   diagnostics  the findings of `xoong check`, with the same message and fix, as you type
 *   completion   operation names inside xo-click, xo-submit, get and op; xo-* attribute names
 *   hover        what an xo-* attribute or element does
 *   code action  "Use <closest operation>" for unknown operations
 */
import { checkHtml, checkScript } from '@xoong/cli/check';
import { ATTRIBUTE_DOCS, ELEMENT_DOCS } from '@xoong/cli/html-data';
import { XO_ATTRIBUTES, XO_ELEMENTS, XO_UI_ATTRIBUTES, XO_UI_ELEMENTS } from '@xoong/core/syntax';

const ATTRS = [...XO_ATTRIBUTES, ...XO_UI_ATTRIBUTES];
const TAGS = [...XO_ELEMENTS, ...XO_UI_ELEMENTS];
const isScript = (uri) => /\.(m?[jt]s)$/.test(uri);
const isMutationAttr = (name) => name === 'xo-click' || name === 'xo-submit' || name === 'op';

/**
 * @param {{ operations: () => Promise<{ operations: Record<string, any> } | null> }} ctx
 *   `operations()` returns the synced table (re-read on every call so `xoong sync` is picked up) or null if there is none yet.
 */
export function createLanguageServer(ctx) {
  /** @type {Map<string, string>} open documents */
  const docs = new Map();

  const notify = (method, params) => ({ jsonrpc: '2.0', method, params });
  const reply = (id, result) => ({ jsonrpc: '2.0', id, result });

  /** End of the word that starts at (line, col) (0-based), so the squiggle covers the attribute or value, not one letter. */
  function rangeAt(text, line, col) {
    const row = text.split('\n')[line] ?? '';
    let end = col;
    while (end < row.length && !/[\s"'<>=]/.test(row[end])) end++;
    if (end === col) end = Math.min(col + 1, row.length);
    return { start: { line, character: col }, end: { line, character: end } };
  }

  async function diagnose(uri) {
    const text = docs.get(uri) ?? '';
    const table = await ctx.operations();
    if (!table) return notify('textDocument/publishDiagnostics', { uri, diagnostics: [{ range: rangeAt(text, 0, 0), severity: 3, source: 'xoong', code: 'no-operations', message: 'No .xoong/operations.json found. Run `xoong sync <openapi>` so operations can be checked.' }] });
    const findings = isScript(uri) ? checkScript(text, table, uri) : checkHtml(text, table, uri);
    return notify('textDocument/publishDiagnostics', {
      uri,
      diagnostics: findings.map((f) => ({
        range: rangeAt(text, f.line - 1, f.column - 1),
        severity: f.level === 'error' ? 1 : 2,
        source: 'xoong', code: f.code,
        message: `${f.message}\nfix: ${f.fix}`,
        data: { fix: f.fix },
      })),
    });
  }

  /** The text of the line before the cursor. */
  const before = (uri, pos) => (docs.get(uri)?.split('\n')[pos.line] ?? '').slice(0, pos.character);

  async function complete(uri, pos) {
    const line = before(uri, pos);
    const value = /\b(xo-click|xo-submit|get|op)\s*=\s*(["'])([^"']*)$/.exec(line);
    if (value) {
      const table = await ctx.operations();
      if (!table) return [];
      const [, attr, , typed] = value;
      const reads = attr === 'get';
      const items = [];
      for (const o of Object.values(table.operations)) {
        if (reads ? o.method !== 'GET' : o.method === 'GET') continue;
        for (const label of reads ? [o.id, o.path] : [o.id, `${o.method} ${o.path}`]) if (label.toLowerCase().includes(typed.toLowerCase())) {
          items.push({ label, kind: 12, detail: `${o.method} ${o.path}`, documentation: o.bodyFields ? `Body: ${o.bodyFields.map((b) => b.name + (b.required ? '*' : '')).join(', ')}` : undefined,
            textEdit: { range: { start: { line: pos.line, character: pos.character - typed.length }, end: pos }, newText: label } });
        }
      }
      return items;
    }
    const attr = /<[\w-]+[^<>]*\s(xo-[\w-]*|[\w-]*)$/.exec(line);
    if (attr && attr[1].startsWith('xo-')) return ATTRS.map((name) => ({ label: name, kind: 10, documentation: ATTRIBUTE_DOCS[name] }));
    const tag = /<(xo-[\w-]*)$/.exec(line);
    if (tag) return TAGS.map((name) => ({ label: name, kind: 7, documentation: ELEMENT_DOCS[name]?.[0] }));
    return [];
  }

  function hover(uri, pos) {
    const row = docs.get(uri)?.split('\n')[pos.line] ?? '';
    for (const m of row.matchAll(/xo-[\w-]+/g)) {
      if (m.index <= pos.character && pos.character <= m.index + m[0].length) {
        const name = m[0];
        const text = ATTRIBUTE_DOCS[name] ?? ELEMENT_DOCS[name]?.[0];
        if (text) return { contents: { kind: 'markdown', value: `**${name}**\n\n${text}` } };
      }
    }
    return null;
  }

  function codeActions(uri, diagnostics) {
    const actions = [];
    for (const d of diagnostics ?? []) {
      const closest = d.code === 'XO201' && /Use "([^"]+)"/.exec(d.data?.fix ?? '')?.[1];
      if (!closest) continue;
      const text = docs.get(uri) ?? '';
      const row = text.split('\n')[d.range.start.line] ?? '';
      const quoted = /(["'])([^"']*)\1/.exec(row.slice(d.range.start.character));
      if (!quoted) continue;
      const start = d.range.start.character + quoted.index + 1;
      actions.push({ title: `Use "${closest}"`, kind: 'quickfix', diagnostics: [d], isPreferred: true,
        edit: { changes: { [uri]: [{ range: { start: { line: d.range.start.line, character: start }, end: { line: d.range.start.line, character: start + quoted[2].length } }, newText: closest }] } } });
    }
    return actions;
  }

  /** @param {any} msg @returns {Promise<any[]>} */
  async function handle(msg) {
    const { method, id, params } = msg;
    switch (method) {
      case 'initialize': return [reply(id, { capabilities: { textDocumentSync: 1, completionProvider: { triggerCharacters: ['"', "'", '-', '<'] }, hoverProvider: true, codeActionProvider: true }, serverInfo: { name: 'xoong-lsp', version: '0.0.1' } })];
      case 'shutdown': return [reply(id, null)];
      case 'textDocument/didOpen': docs.set(params.textDocument.uri, params.textDocument.text); return [await diagnose(params.textDocument.uri)];
      case 'textDocument/didChange': docs.set(params.textDocument.uri, params.contentChanges.at(-1).text); return [await diagnose(params.textDocument.uri)];
      case 'textDocument/didSave': return docs.has(params.textDocument.uri) ? [await diagnose(params.textDocument.uri)] : []; // also picks up a fresh `xoong sync`
      case 'textDocument/didClose': docs.delete(params.textDocument.uri); return [notify('textDocument/publishDiagnostics', { uri: params.textDocument.uri, diagnostics: [] })];
      case 'textDocument/completion': return [reply(id, await complete(params.textDocument.uri, params.position))];
      case 'textDocument/hover': return [reply(id, hover(params.textDocument.uri, params.position))];
      case 'textDocument/codeAction': return [reply(id, codeActions(params.textDocument.uri, params.context?.diagnostics))];
      default: return id !== undefined ? [{ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } }] : [];
    }
  }

  return { handle };
}
