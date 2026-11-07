// @ts-check
/**
 * A small Model Context Protocol server (JSON-RPC 2.0, newline-delimited over stdio).
 * No SDK: the protocol surface xoong needs is `initialize`, `tools/list` and `tools/call`.
 *
 * Tools (the loop an assistant follows: read the spec, write code, check, fix from the message):
 *   get_spec          the whole llms.txt
 *   list_operations   operations of the synced API (id, method, path, query, body fields)
 *   check             run `xoong check` on HTML source text; returns structured findings
 *   explain_error     what an XO code means and how to fix it
 *   search_docs       find a term in the docs folder (when one is configured)
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { checkHtml } from '@xoong/cli/check';

export const PROTOCOL_VERSION = '2024-11-05';

/** Meaning and fix for every code `xoong check` and `xoong doctor` can print. Kept in step with check.js by a test. */
export const EXPLANATIONS = {
  XO201: 'An operation name in xo-click, xo-submit, <xo-view get> or <xo-form op> does not exist in the synced API. Use the closest name the message gives, or run `xoong sync` if the API changed.',
  XO202: 'xo-click calls a GET operation. Reads are declared with <xo-view get="...">; xo-click is for mutations.',
  XO203: '<xo-view get> uses an operation that is not GET. Use a GET operation for reading and xo-click/xo-submit for writes.',
  XO210: 'The view\'s operation has a path parameter such as {id}, but the view has no p-id attribute. Add p-id="..." or set view.params in JavaScript.',
  XO220: 'xo-submit is only valid on a <form>. Move the attribute to the form element.',
  XO221: 'xo-each, xo-if or xo-body has no path. Give it one, for example xo-each="items".',
  XO230: 'An xo-* element or attribute that xoong does not define, usually a typo. The message names the closest valid one.',
  XO240: 'A button or link triggered by xo-click has no accessible name. Add visible text or aria-label.',
  XO241: 'xo-click is on an element that keyboards cannot reach. Use a <button>, or add role="button" and tabindex="0".',
  XO250: '<xo-table sortable> needs a `sort` query parameter on the view\'s operation, and page-size needs `limit` and `offset`. Add them to the API or remove the attribute.',
  XO251: '<xo-table> must be inside an <xo-view get="...">, which supplies its data.',
  XO252: '<xo-form op> found no simple request fields to generate. Write the <form xo-submit> by hand.',
};

const TOOLS = [
  { name: 'get_spec', description: 'Return xoong\'s whole public API as one short document (llms.txt). Read it before writing xoong code.', inputSchema: { type: 'object', properties: {} } },
  { name: 'list_operations', description: 'List the operations of the synced API: id, method, path, query parameters and request body fields. Use these exact names in xo-click, xo-submit and <xo-view get>.', inputSchema: { type: 'object', properties: { filter: { type: 'string', description: 'Only operations whose id or path contains this text.' } } } },
  { name: 'check', description: 'Run `xoong check` on HTML source text and return findings with line, column, message and fix. Fix every error before showing code to the user.', inputSchema: { type: 'object', properties: { html: { type: 'string', description: 'The HTML source of a screen.' } }, required: ['html'] } },
  { name: 'explain_error', description: 'Explain an XO error code (for example XO201) and how to fix it.', inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } },
  { name: 'search_docs', description: 'Search the xoong documentation for a term and return matching lines with file names.', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
];

/**
 * @param {{ llms: () => Promise<string>, operations: () => Promise<{ operations: Record<string, any> }>, docsDir?: string }} ctx
 */
export function createServer(ctx) {
  const text = (t, isError = false) => ({ content: [{ type: 'text', text: t }], ...(isError ? { isError: true } : {}) });

  /** @param {string} name @param {any} args */
  async function callTool(name, args = {}) {
    switch (name) {
      case 'get_spec': return text(await ctx.llms());
      case 'list_operations': {
        const table = await ctx.operations();
        const f = String(args.filter ?? '').toLowerCase();
        const rows = Object.values(table.operations).filter((o) => !f || o.id.toLowerCase().includes(f) || o.path.toLowerCase().includes(f))
          .map((o) => ({ id: o.id, call: `${o.method} ${o.path}`, ...(o.query ? { query: o.query } : {}), ...(o.bodyFields ? { bodyFields: o.bodyFields.map((b) => b.name + (b.required ? '*' : '')) } : {}), ...(o.stream ? { stream: true } : {}), ...(o.multipart ? { multipart: true } : {}) }));
        return text(JSON.stringify(rows, null, 2));
      }
      case 'check': {
        if (typeof args.html !== 'string') return text('check needs an "html" string', true);
        const findings = checkHtml(args.html, await ctx.operations(), 'screen.html');
        return text(findings.length ? JSON.stringify(findings, null, 2) : 'No findings.');
      }
      case 'explain_error': {
        const code = String(args.code ?? '').toUpperCase();
        return EXPLANATIONS[code] ? text(`${code}: ${EXPLANATIONS[code]}`) : text(`Unknown code "${args.code}". Known: ${Object.keys(EXPLANATIONS).join(', ')}. API audit codes (XO1xx) are explained by \`xoong doctor\`.`, true);
      }
      case 'search_docs': {
        if (!ctx.docsDir) return text('No docs folder is configured (start the server with --docs <folder>).', true);
        const q = String(args.query ?? '').toLowerCase();
        if (!q) return text('search_docs needs a query', true);
        const hits = [];
        for (const file of (await readdir(ctx.docsDir)).filter((f) => f.endsWith('.md')).sort()) {
          (await readFile(join(ctx.docsDir, file), 'utf8')).split('\n').forEach((line, i) => { if (line.toLowerCase().includes(q) && hits.length < 40) hits.push(`${file}:${i + 1}: ${line.trim()}`); });
        }
        return text(hits.length ? hits.join('\n') : `No match for "${args.query}".`);
      }
      default: return text(`Unknown tool "${name}"`, true);
    }
  }

  /**
   * Handle one JSON-RPC message. Returns the response object, or null for notifications.
   * @param {any} msg
   */
  async function handle(msg) {
    if (!msg || typeof msg !== 'object' || typeof msg.method !== 'string') return { jsonrpc: '2.0', id: msg?.id ?? null, error: { code: -32600, message: 'Invalid request' } };
    if (msg.id === undefined) return null; // notification (initialized, cancelled, ...)
    const reply = (result) => ({ jsonrpc: '2.0', id: msg.id, result });
    const fail = (code, message) => ({ jsonrpc: '2.0', id: msg.id, error: { code, message } });
    try {
      switch (msg.method) {
        case 'initialize': return reply({ protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: { name: 'xoong', version: '0.0.1' }, instructions: 'Call get_spec first. Write xoong screens, then call check on the HTML and fix every error from its message.' });
        case 'ping': return reply({});
        case 'tools/list': return reply({ tools: TOOLS });
        case 'tools/call': return reply(await callTool(msg.params?.name, msg.params?.arguments));
        default: return fail(-32601, `Method not found: ${msg.method}`);
      }
    } catch (e) {
      return msg.method === 'tools/call' ? reply(text(`${e instanceof Error ? e.message : e}`, true)) : fail(-32603, String(e instanceof Error ? e.message : e));
    }
  }

  return { handle, tools: TOOLS };
}
