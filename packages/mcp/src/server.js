// @ts-check
/**
 * A small Model Context Protocol server (JSON-RPC 2.0, newline-delimited over stdio).
 * No SDK: the protocol surface xoong needs is `initialize`, `tools/list` and `tools/call`.
 *
 * Tools (the loop an assistant follows: read the spec, write code, check, fix from the message):
 *   get_spec          the whole llms.txt
 *   list_operations   operations of the synced API (id, method, path, query, body fields)
 *   check             run `xoong check` on HTML source text; returns structured findings
 *   explain_error     what an XO code means and how to fix it (the XO2xx codes of `xoong check`, the XO1xx codes of `xoong doctor`)
 *   explain_syntax    what an xo-* element or attribute does, with its attributes and values (no name: the list of all)
 *   search_docs       find a term in the docs (the ones that ship with this package, and the project's own folder when one is given)
 */
import { readFileSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { checkHtml, checkScript } from '@xoong/cli/check';
import { SYNTAX, explainSyntax } from '@xoong/cli/html-data';

export const PROTOCOL_VERSION = '2024-11-05';

/** The version of this package, read from its own package.json (it ships with every npm package). */
export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

/** Meaning and fix for every code `xoong check` and `xoong doctor` can print. Kept in step with check.js by a test. */
export const EXPLANATIONS = {
  XO201: 'An operation name in xo-click, xo-submit, <xo-view get> or <xo-form op> does not exist in the synced API. Use the closest name the message gives, or run `xoong sync` if the API changed.',
  XO202: 'xo-click calls a GET operation. Reads are declared with <xo-view get="...">; xo-click is for mutations.',
  XO203: '<xo-view get> uses an operation that is not GET. Use a GET operation for reading and xo-click/xo-submit for writes.',
  XO210: 'The view\'s operation has a path parameter such as {id}, but the view has no p-id attribute. Add p-id="..." or set view.params in JavaScript.',
  XO222: '<form xo-submit> must be inside an <xo-view>, otherwise it never binds. Wrap it in <xo-view> (without get is fine).',
  XO220: 'xo-submit is only valid on a <form>. Move the attribute to the form element.',
  XO221: 'xo-each, xo-if or xo-body has no path. Give it one, for example xo-each="items".',
  XO230: 'An xo-* element or attribute that xoong does not define, usually a typo. The message names the closest valid one.',
  XO243: 'An <img> whose src or srcset has {data} inside an <xo-view> is requested by the browser with the literal text before the data is bound. Use <xo-image src="{path}" alt="..."> instead.',
  XO242: '<xo-image> has no alt attribute. Describe the image, or write alt="" when it is only decoration.',
  XO240: 'A button or link triggered by xo-click has no accessible name. Add visible text or aria-label.',
  XO241: 'xo-click is on an element that keyboards cannot reach. Use a <button>, or add role="button" and tabindex="0".',
  XO250: '<xo-table sortable> needs a `sort` query parameter on the view\'s operation, and page-size (and every <xo-pager>) needs `limit` and `offset`. Add them to the API or remove the attribute or the pager.',
  XO253: 'A filter box of <xo-table filters="..."> sets a query parameter of the same name, and the view\'s operation does not declare it. Add the parameter to the API or remove the filter.',
  XO204: 'client.load()/query() were given a write operation, or client.mutate()/stream() a GET. Reads: load/query. Writes: mutate.',
  XO254: 'xo-selected only makes sense on an xo-click button, and xo-select on a checkbox. Move the attribute.',
  XO260: 'A route path must start with "/" (or be "*" for not found) and each path may be declared once per router. Write xo-route="/users/:id".',
  XO261: 'layout="x" on a route (or layout) names a layout that is not declared in the same <xo-router>. Declare <template xo-layout="x">, or use the closest name the message gives.',
  XO262: 'A layout template needs one element with xo-outlet where the route content is shown, for example <main xo-outlet>.',
  XO263: 'p-x=":name" reads a route parameter: it only works inside a <template xo-route="..."> whose path contains :name. Fix the name, or use a fixed value or p-x="?query".',
  XO255: 'This operation has no request schema (for example a multipart body), so <xo-form> can only draw simple fields, and the operation requires nested objects, arrays or unions: the generated form can never satisfy the server. Write the <form xo-submit> by hand.',
  XO251: '<xo-table> and <xo-pager> must be inside an <xo-view get="...">, which supplies their data.',
  XO252: '<xo-form op> found no simple request fields to generate. Write the <form xo-submit> by hand.',
  XO270: 'An attribute that does nothing where it is. xo-then, xo-notice, xo-confirm, xo-body, xo-optimistic and xo-with tune an action, so they need xo-click or xo-submit on the same element (xo-with also works with xo-add); xo-keep needs xo-submit; xo-confirm-title, xo-confirm-ok, xo-confirm-cancel and xo-confirm-kind need xo-confirm; <xo-dialog size> needs heading. Move the attribute onto the element that has the action, or remove it.',
  XO271: 'An attribute that takes one of a fixed set of values has another one, and the runtime silently uses the default. xo-confirm-kind: danger, warning, info, success. <xo-dialog size>: sm, wide, full. Use the closest value the message gives (call explain_syntax with the attribute to see them all).',
  XO272: 'A value with a syntax of its own is malformed, and the runtime ignores it. xo-with and xo-optimistic: "field=value,other={path}". xo-param: "name=value", "name+=n", "name-=n" or "name~=value" (just the name on an <input>/<select>). xo-move: "path:up" or "path:down". xo-select: no value on a row checkbox, "all:<list>" on the header one.',
  XO273: 'xo-open="#id" must name an <xo-dialog> (the id is not in this file, or it is on another element), and xo-close only closes the <xo-dialog> it is inside. Put the id on the <xo-dialog>, and the close button inside it.',
  XO274: 'xo-with (and the field name of xo-selected="ids") adds a field to the request body, and the operation has no such field (or no request body at all). Use list_operations to see the body fields; the message names the closest one.',
  XO275: 'xo-param sets a view parameter, and the view\'s operation does not take it as a path or query parameter, so the request does not change (the value is still available as {name} in the view). Add the parameter to the API, or remove xo-param.',
  XO276: 'An attribute outside the element that gives it meaning: xo-route and xo-layout belong on a <template> that is a direct child of <xo-router>; xo-tab inside <xo-tabs>; xo-menu-trigger inside <xo-menu>; xo-guard on a <form xo-submit>; xo-add, xo-remove, xo-move and xo-drag inside a <form xo-submit>.',
  // `xoong doctor` and `xoong sync` (the API document and the hints file)
  XO100: 'The OpenAPI document has no "paths". Add a paths object (or declare webhooks/components only if that is intended).',
  XO101: 'x-xoong-id names a property that the schema does not have. Name existing properties or remove it.',
  XO102: 'Two schemas that are one entity (a hint or x-xoong-entity maps them together) use different id properties. Use the same id property for every schema of one entity.',
  XO110: 'An operation has no operationId, so xoong made one up (the message says which). Add an operationId: it is the stable name used in xo-click, <xo-view get> and the typed client.',
  XO111: 'Two operations have the same operationId. Make them unique.',
  XO112: 'A {param} of the path is not declared under parameters with in: path. Declare it so the type is known.',
  XO113: 'The document asks for something that changes what a call needs or does, and xoong does not apply it (one finding per kind, naming a few operations): a required header parameter (such as X-Tenant-Id: send it with configure({ headers: () => ({ ... }) })), a cookie parameter (the browser sends its own; configure({ credentials: \'include\' }) for another origin), HEAD, OPTIONS or TRACE operations (not generated: use fetch()), servers (requests go to the page\'s origin: configure({ baseUrl })), or a query parameter with explode: false, deepObject or pipeDelimited/spaceDelimited (xoong sends name=a&name=b and writes no object: pass the text the server expects). operations.json is not changed by any of these.',
  XO120: 'A GET operation has no application/json success schema, so no types or cache can be generated for it. Describe the response.',
  XO130: 'An operation documents no error responses. Document 4xx/5xx or default (application/problem+json) so errors have a shape.',
  XO140: 'A schema has an id-like property but is not treated as an entity, so its records are stored inline and not shared between screens. If instances repeat across responses, add the hint { "schemas": { "Name": { "id": "prop" } } } or x-xoong-id; otherwise ignore.',
  XO150: 'A $ref points to something that does not exist in the document. Define the target or remove the reference.',
  XO151: 'An external $ref is not resolved by xoong. Bundle the document so every reference is local (for example with redocly bundle).',
  XO160: 'A response contains a union of entities that cannot be told apart, so they are not stored in the shared entity store. Give the members a property with one fixed value each, or an OpenAPI discriminator.',
  XO161: 'A union in a request body cannot be told apart, so a generated form draws it as free-form. Add a discriminator, or a property with a different fixed value (const or one-value enum) in each member.',
  XO170: 'The hint idempotencyKeys.<operationId> names a field that the request body does not have. Name an existing body property or remove the hint.',
  XO171: 'xoong.hints.json has a key xoong does not know (usually a typo), so it does nothing. The keys are idNames, schemas, unwrap, idempotencyKeys and fields.',
  XO172: 'A hint refers to something the document does not have: a fields key must be "Schema.property" of an existing schema, and idempotencyKeys must name an existing operationId. Use the closest name the message gives.',
};

/** The tools, as `tools/list` returns them (the documentation site builds its table of tools from this list). */
export const TOOLS = [
  { name: 'get_spec', description: 'Return xoong\'s whole public API as one short document (llms.txt). Read it before writing xoong code.', inputSchema: { type: 'object', properties: {} } },
  { name: 'list_operations', description: 'List the operations of the synced API: id, method, path, query parameters and request body fields. Use these exact names in xo-click, xo-submit and <xo-view get>.', inputSchema: { type: 'object', properties: { filter: { type: 'string', description: 'Only operations whose id or path contains this text.' } } } },
  { name: 'check', description: 'Run `xoong check` on HTML source text and return findings with line, column, message and fix. Fix every error before showing code to the user.', inputSchema: { type: 'object', properties: { html: { type: 'string', description: 'The HTML source of a screen.' }, script: { type: 'string', description: 'JavaScript or TypeScript source instead of html: checks html`...` templates and client.load/query/mutate/stream calls.' } } } },
  { name: 'explain_error', description: 'Explain an XO error code and how to fix it: XO2xx from `check`, XO1xx from `xoong doctor` and `xoong sync` (for example XO201, XO110).', inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } },
  { name: 'explain_syntax', description: 'Explain an xo-* element (<xo-dialog>) or attribute (xo-confirm-kind, or "xo-dialog size"): what it does, its attributes and the values it takes. Never invent an attribute: ask here first. Without a name it lists every element and attribute.', inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'An element (xo-table or <xo-table>), an attribute (xo-then), or an attribute of an element ("xo-table page-size").' } } } },
  { name: 'search_docs', description: 'Search the xoong documentation for a term and return matching lines with file names.', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
];

/**
 * @param {{ llms: () => Promise<string>, operations: () => Promise<{ operations: Record<string, any> }>, docsDir?: string, bundledDocsDir?: string }} ctx
 *   `docsDir`: the project's own docs folder (searched first); `bundledDocsDir`: the xoong documentation that ships with this package.
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
        if (typeof args.html !== 'string' && typeof args.script !== 'string') return text('check needs an "html" or a "script" string', true);
        const table = await ctx.operations();
        const findings = typeof args.script === 'string' ? checkScript(args.script, table, 'screen.ts') : checkHtml(args.html, table, 'screen.html');
        return text(findings.length ? JSON.stringify(findings, null, 2) : 'No findings.');
      }
      case 'explain_error': {
        const code = String(args.code ?? '').toUpperCase();
        return EXPLANATIONS[code] ? text(`${code}: ${EXPLANATIONS[code]}`) : text(`Unknown code "${args.code}". Known: ${Object.keys(EXPLANATIONS).join(', ')}. API audit codes (XO1xx) are explained by \`xoong doctor\`.`, true);
      }
      case 'explain_syntax': {
        if (!String(args.name ?? '').trim()) return text(`Elements: ${SYNTAX.elements.join(', ')}.\nAttributes: ${SYNTAX.attributes.join(', ')}.\nAsk again with a name for what it does.`);
        const r = explainSyntax(args.name);
        return r.found ? text(r.text) : text(`xoong has no element or attribute "${args.name}"${r.suggestions.length ? `. Did you mean: ${r.suggestions.join(', ')}?` : ''} Call explain_syntax without a name for the whole list.`, true);
      }
      case 'search_docs': {
        const q = String(args.query ?? '').toLowerCase();
        const here = ctx.docsDir ? resolve(ctx.docsDir) : undefined;
        const dirs = [ctx.docsDir ? { dir: ctx.docsDir, label: '' } : undefined, ctx.bundledDocsDir && resolve(ctx.bundledDocsDir) !== here ? { dir: ctx.bundledDocsDir, label: ctx.docsDir ? 'xoong/' : '' } : undefined].filter((d) => !!d);
        if (!dirs.length) return text('No docs folder is configured (start the server with --docs <folder>).', true);
        if (!q) return text('search_docs needs a query', true);
        const hits = [];
        for (const { dir, label } of dirs) {
          for (const file of (await readdir(dir)).filter((f) => f.endsWith('.md')).sort()) {
            (await readFile(join(dir, file), 'utf8')).split('\n').forEach((line, i) => { if (line.toLowerCase().includes(q) && hits.length < 40) hits.push(`${label}${file}:${i + 1}: ${line.trim()}`); });
          }
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
        case 'initialize': return reply({ protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: { name: 'xoong', version: VERSION }, instructions: 'Call get_spec first. Write xoong screens, then call check on the HTML and fix every error from its message. Never invent an xo-* attribute or an operation: explain_syntax says what an element or attribute does, list_operations gives the real operation names, explain_error explains a code.' });
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
