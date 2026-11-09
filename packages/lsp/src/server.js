// @ts-check
/**
 * xoong language server core: pure message handling, no I/O. `handle(message)` returns the messages to send back
 * (a response and/or notifications), so it can be tested without a process. `cli.js` adds stdio framing.
 *
 * Features (one engine, see docs/editor-integration.md):
 *   diagnostics  the findings of `xoong check`, with the same message and fix, as you type
 *   completion   operation names inside xo-click, xo-submit, get and op; xo-* attribute names; the attributes of an xo-* element
 *                (page-size on <xo-pager>) and the values of attributes that take a fixed set (xo-confirm-kind, <xo-dialog size>);
 *                the ids of the <xo-dialog>s of the file inside xo-open
 *   hover        what an xo-* attribute or element does, and an attribute of an xo-* element
 *   code action  "Use <closest ...>" for an unknown operation, attribute or value
 */
import { readFileSync } from 'node:fs';
import { checkHtml, checkScript } from '@xoong/cli/check';
import { ATTRIBUTE_DOCS, ELEMENT_DOCS, SYNTAX, VALUE_SETS, elementAttributes } from '@xoong/cli/html-data';

/** The version of this package, read from its own package.json (it ships with every npm package). */
export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const ATTRS = SYNTAX.attributes;
const TAGS = SYNTAX.elements;
const isScript = (uri) => /\.(c|m)?[jt]sx?$/.test(uri);
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

  /** The start tag the cursor is in, if any: its name and the text of it up to the cursor (spans lines). */
  function openTag(uri, pos) {
    const lines = (docs.get(uri) ?? '').split('\n');
    const upto = [...lines.slice(Math.max(0, pos.line - 30), pos.line), (lines[pos.line] ?? '').slice(0, pos.character)].join('\n'); // a tag rarely spans more than a few lines
    const lt = upto.lastIndexOf('<');
    if (lt < 0) return null;
    const m = /^<([a-zA-Z][\w-]*)((?:[^<>"']|"[^"]*"|'[^']*')*(?:"[^"]*|'[^']*)?)$/.exec(upto.slice(lt)); // no `>` outside quotes yet (a quote may still be open at the cursor): inside the tag
    return m ? { tag: m[1], text: m[2] } : null;
  }

  /** The ids of the <xo-dialog> elements in a document, for xo-open. */
  const dialogIds = (uri) => [...(docs.get(uri) ?? '').matchAll(/<xo-dialog\b[^>]*?\sid\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]);

  async function complete(uri, pos) {
    const line = before(uri, pos);
    const value = /(?<![\w:.-])(xo-click|xo-submit|get|op)\s*=\s*(["'])([^"']*)$/.exec(line);
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
    // inside a start tag: the values of an attribute that takes a fixed set, then the names of attributes
    const open = openTag(uri, pos);
    if (open && /^\s/.test(open.text)) { // the name of the tag is complete (otherwise the cursor is still in it: element names below)
      const typed = /(?:^|\s)([\w:.-]+)\s*=\s*(["'])([^"']*)$/.exec(open.text);
      if (typed) {
        const [, name, , prefix] = typed;
        const edit = (label) => ({ range: { start: { line: pos.line, character: pos.character - prefix.length }, end: pos }, newText: label });
        if (name === 'xo-open') return dialogIds(uri).filter((id) => `#${id}`.startsWith(prefix)).map((id) => ({ label: `#${id}`, kind: 12, detail: '<xo-dialog>', textEdit: edit(`#${id}`) }));
        const set = VALUE_SETS[`${open.tag} ${name}`] ?? VALUE_SETS[name];
        return set ? set.filter((v) => v.startsWith(prefix)).map((label) => ({ label, kind: 12, documentation: elementAttributes(open.tag).find(([n]) => n === name)?.[1] ?? ATTRIBUTE_DOCS[name], textEdit: edit(label) })) : [];
      }
      const word = /(?:^|\s)([\w:.-]*)$/.exec(open.text)?.[1];
      if (word !== undefined && !/=\s*(["'][^"']*)?$/.test(open.text)) {
        const known = TAGS.includes(open.tag);
        const own = known ? elementAttributes(open.tag).map(([name, doc]) => ({ label: name, kind: 10, detail: `<${open.tag}>`, documentation: doc })) : [];
        const global = word.startsWith('xo-') || (word === '' && known) ? ATTRS.map((name) => ({ label: name, kind: 10, documentation: ATTRIBUTE_DOCS[name] })) : [];
        const params = open.tag === 'xo-view' && (word === '' || word.startsWith('p')) ? [...new Set(Object.values((await ctx.operations())?.operations ?? {}).flatMap((o) => [...o.path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1])))].map((name) => ({ label: `p-${name}`, kind: 10, documentation: `Value of the path parameter "${name}" for the view's operation.` })) : [];
        return [...own, ...params, ...global].filter((i) => i.label.startsWith(word));
      }
    }
    const tag = /<(xo-[\w-]*)$/.exec(line);
    if (tag) return TAGS.map((name) => ({ label: name, kind: 7, documentation: ELEMENT_DOCS[name]?.[0] }));
    return [];
  }

  function hover(uri, pos) {
    const row = docs.get(uri)?.split('\n')[pos.line] ?? '';
    const values = (tag, name) => VALUE_SETS[`${tag} ${name}`] ?? VALUE_SETS[name];
    const show = (name, text, set) => ({ contents: { kind: 'markdown', value: `**${name}**\n\n${text}${set ? `\n\nValues: ${set.map((v) => `\`${v}\``).join(', ')}` : ''}` } });
    // an attribute of an xo-* element (page-size, heading, size): the word under the cursor, inside the start tag
    for (const m of row.matchAll(/[\w:.-]+/g)) {
      if (m.index > pos.character || pos.character > m.index + m[0].length) continue;
      const open = openTag(uri, { line: pos.line, character: m.index + m[0].length });
      if (open && TAGS.includes(open.tag) && open.text.endsWith(m[0]) && /\s$/.test(open.text.slice(0, -m[0].length))) {
        const own = elementAttributes(open.tag).find(([name]) => name === m[0]);
        if (own) return show(`<${open.tag}> ${m[0]}`, own[1], values(open.tag, m[0]));
      }
      if (open && open.tag === 'xo-view' && /^p-[\w-]+$/.test(m[0]) && open.text.endsWith(m[0])) return show(m[0], `Value of the path parameter "${m[0].slice(2)}" for the view's operation (\`p-id="42"\`; \`p-id="?id"\` reads ?id= from the page URL; \`p-id=":id"\` reads a route parameter).`);
    }
    for (const m of row.matchAll(/xo-[\w-]+/g)) {
      if (m.index <= pos.character && pos.character <= m.index + m[0].length) {
        const name = m[0];
        const text = ATTRIBUTE_DOCS[name] ?? ELEMENT_DOCS[name]?.[0];
        if (text) return show(name, text, values('', name));
      }
    }
    return null;
  }

  function codeActions(uri, diagnostics) {
    const actions = [];
    for (const d of diagnostics ?? []) {
      const fix = d.data?.fix ?? '';
      const text = docs.get(uri) ?? '';
      const row = text.split('\n')[d.range.start.line] ?? '';
      const at = d.range.start.character;
      /** @type {{ title: string, start: number, length: number, newText: string } | null} */
      let change = null;
      if (d.code === 'XO201') {
        const closest = /Use "([^"]+)"/.exec(fix)?.[1];
        if (closest && isScript(uri)) { // the diagnostic starts at the operation name itself
          const typo = /unknown operation "([^"]+)"/.exec(d.message)?.[1];
          if (typo && row.startsWith(typo, at)) change = { title: `Use "${closest}"`, start: at, length: typo.length, newText: closest };
        } else if (closest) { // the diagnostic starts at the attribute: replace the quoted value after it
          const quoted = /(["'])([^"']*)\1/.exec(row.slice(at));
          if (quoted) change = { title: `Use "${closest}"`, start: at + quoted.index + 1, length: quoted[2].length, newText: closest };
        }
      } else if (d.code === 'XO271') { // a value outside the set: fix is `Use size="wide"`
        const closest = /^Use [\w-]+="([^"]+)"$/.exec(fix)?.[1];
        const quoted = /(["'])([^"']*)\1/.exec(row.slice(at));
        if (closest && quoted) change = { title: `Use "${closest}"`, start: at + quoted.index + 1, length: quoted[2].length, newText: closest };
      } else if (d.code === 'XO230') { // a misspelled attribute (fix: `Use xo-click`) or element (`Use <xo-table>`)
        const typo = /unknown (?:attribute|element) <?([\w-]+)>?/.exec(d.message)?.[1];
        const attribute = /^Use (xo-[\w-]+)$/.exec(fix)?.[1];
        const element = /^Use <(xo-[\w-]+)>$/.exec(fix)?.[1];
        if (typo && attribute && row.startsWith(typo, at)) change = { title: `Use ${attribute}`, start: at, length: typo.length, newText: attribute };
        else if (typo && element && row.startsWith(`<${typo}`, at)) change = { title: `Use <${element}>`, start: at + 1, length: typo.length, newText: element };
      }
      if (!change) continue;
      const line = d.range.start.line;
      actions.push({ title: change.title, kind: 'quickfix', diagnostics: [d], isPreferred: true,
        edit: { changes: { [uri]: [{ range: { start: { line, character: change.start }, end: { line, character: change.start + change.length } }, newText: change.newText }] } } });
    }
    return actions;
  }

  /** @param {any} msg @returns {Promise<any[]>} */
  async function handle(msg) {
    try {
      return await dispatch(msg ?? {});
    } catch (e) { // one bad message must never take the server down
      return msg?.id !== undefined ? [{ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: String(e instanceof Error ? e.message : e) } }] : [];
    }
  }

  async function dispatch(msg) {
    const { method, id, params } = msg;
    switch (method) {
      case 'initialize': return [reply(id, { capabilities: { textDocumentSync: 1, completionProvider: { triggerCharacters: ['"', "'", '-', '<', ' '] }, hoverProvider: true, codeActionProvider: true }, serverInfo: { name: 'xoong-lsp', version: VERSION } })];
      case 'shutdown': return [reply(id, null)];
      case 'textDocument/didOpen': docs.set(params.textDocument.uri, params.textDocument.text); return [await diagnose(params.textDocument.uri)];
      case 'textDocument/didChange': {
        const text = params?.contentChanges?.at(-1)?.text;
        if (typeof text !== 'string') return []; // nothing usable: keep the last known text
        docs.set(params.textDocument.uri, text);
        return [await diagnose(params.textDocument.uri)];
      }
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
