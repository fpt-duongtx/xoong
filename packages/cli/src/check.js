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
 *   XO222 <form xo-submit> outside an <xo-view> (it never binds)
 *   XO221 empty xo-each / xo-if / xo-body expression
 *   XO230 unknown xo-* attribute or element (with the closest match)
 *   XO243 <img src="{path}"> inside an <xo-view> (the browser requests the literal text before binding)
 *   XO242 <xo-image> without an alt attribute (alt="" is a decorative image)
 *   XO240 button/link triggered by xo-click has no accessible name
 *   XO241 xo-click on a non-interactive element (not reachable by keyboard)
 *   XO250 <xo-table sortable|page-size> but the view's operation lacks the query parameters (sort | limit, offset)
 *   XO204 client.load/query on a non-GET operation, or client.mutate/stream on a GET (JavaScript and TypeScript files)
 *   XO254 xo-selected not on an xo-click element, or xo-select not on a checkbox
 *   XO255 <xo-form op> operation has no request schema (multipart) and required body fields the flat generator cannot draw: the form cannot succeed
 *   XO260 route path missing, not starting with "/", or declared twice
 *   XO261 layout="x" names a layout the router does not declare
 *   XO262 a layout template without an xo-outlet
 *   XO263 p-x=":name" outside a route, or naming a parameter the route does not have
 *   XO253 <xo-table filters="f"> but the view's operation has no query parameter "f"
 *   XO251 <xo-table> outside an <xo-view get>
 *   XO252 <xo-form op> operation has no simple request fields to generate a form from
 *   XO270 an attribute that does nothing without another on the same element: xo-then, xo-notice, xo-confirm, xo-body, xo-optimistic, xo-with, xo-keep without xo-click/xo-submit, xo-confirm-* without xo-confirm, <xo-dialog size> without heading
 *   XO271 an attribute that takes one of a fixed set of values (xo-confirm-kind, <xo-dialog size>, ...) has another value
 *   XO272 a malformed value: a `field=value` list (xo-with, xo-optimistic), xo-param, xo-move or xo-select
 *   XO273 xo-open names an element that is not an <xo-dialog> (or none in this file), or xo-close is outside an <xo-dialog>
 *   XO274 xo-with / xo-selected names a field the request body of the operation does not have
 *   XO275 xo-param sets a parameter the view's operation does not take (it will not filter the data)
 *   XO276 an attribute outside the element that gives it meaning (xo-route/xo-layout off a router template, xo-tab, xo-menu-trigger, xo-guard, the array buttons)
 *   (XO250 and XO251 apply to <xo-pager> as they do to <xo-table>)
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { excluder } from './exclude.js';
import { join, extname, relative } from 'node:path';
import { parse } from 'parse5';
import { nearest } from '@xoong/core/closest';
import { XO_ATTRIBUTES, XO_ELEMENTS, XO_UI_ATTRIBUTES, XO_UI_ELEMENTS, XO_CONTROL_ATTRIBUTES, XO_CONTROL_ELEMENTS } from '@xoong/core/syntax';
import { VALUE_SETS } from './html-data.js';

const ATTRS = new Set([...XO_ATTRIBUTES, ...XO_UI_ATTRIBUTES, ...XO_CONTROL_ATTRIBUTES]);
const TAGS = new Set([...XO_ELEMENTS, ...XO_UI_ELEMENTS, ...XO_CONTROL_ELEMENTS]);
const INTERACTIVE = new Set(['button', 'a', 'input', 'select', 'textarea', 'summary']);
/** Attributes that tune an action: they do nothing unless xo-click or xo-submit is on the same element. */
const NEEDS_ACTION = ['xo-then', 'xo-notice', 'xo-confirm', 'xo-body', 'xo-optimistic'];
const CONFIRM_DETAILS = ['xo-confirm-title', 'xo-confirm-ok', 'xo-confirm-cancel', 'xo-confirm-kind'];
/** A value is required (an empty one is a mistake). `xo-keep`, `xo-close`, `xo-selected` and the like are fine without one. */
const NEEDS_VALUE = ['xo-each', 'xo-if', 'xo-body', 'xo-then', 'xo-confirm', 'xo-with', 'xo-optimistic', 'xo-open', 'xo-add', 'xo-remove', 'xo-move', 'xo-drag'];
/** Values the runtime also accepts, but the documentation does not offer. */
const VALUE_ALIASES = { 'xo-confirm-kind': ['error'] };

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
 * @param {{ fragment?: boolean }} [options] `fragment`: the source is a piece of a page (an html`...` template), so what may live elsewhere (the dialog an xo-open points at) is not reported
 * @returns {Finding[]}
 */
export function checkHtml(source, table, file = '<input>', { fragment = false } = {}) {
  /** @type {Finding[]} */
  const findings = [];
  const ops = operationIndex(table);
  const known = [...ops.keys()];
  const document = parse(source, { sourceCodeLocationInfo: true });
  /** The operation a reference names ("/users", "GET /users", an operationId), or undefined. */
  const opOf = (ref) => { const key = ref.trim(); return ops.get(key.startsWith('/') ? `GET ${key}` : key.replace(/\s+/g, ' ')); };
  /** id -> tag name of every element that has one (inside templates too): what xo-open="#id" can find. */
  const ids = new Map();
  (function collect(node) {
    for (const child of node.nodeName === 'template' ? node.content?.childNodes ?? [] : node.childNodes ?? []) {
      const id = attr(child, 'id')?.value;
      if (id && !ids.has(id)) ids.set(id, child.tagName);
      collect(child);
    }
  })(document);

  const report = (level, code, node, name, message, fix) => {
    const loc = (name && node.sourceCodeLocation?.attrs?.[name]) || node.sourceCodeLocation;
    findings.push({ level, code, file, line: loc?.startLine ?? 1, column: loc?.startCol ?? 1, message, fix });
  };
  const lookup = (node, name, ref, what) => {
    const key = ref.trim();
    const op = opOf(ref);
    if (!op) {
      const hint = nearest(key.startsWith('/') ? `GET ${key}` : key, known);
      report('error', 'XO201', node, name, `unknown operation "${key}"${hint ? ` (closest: "${hint}")` : ''}`, hint ? `Use "${hint}"` : 'Run `xoong sync` if the API changed, or fix the operation');
    }
    return op;
  };

  /** The rules of one attribute that depend on its element: what it needs beside it, which values it takes, what it names. */
  function attributeRules(node, tag, a, view, ctx) {
    const n = a.name;
    const has = (name) => attr(node, name) !== undefined;
    const acts = has('xo-click') || has('xo-submit') || (tag === 'xo-form' && has('op')); // <xo-form op> is a submitting form: it passes these on to the form it draws
    const value = a.value.trim();
    // XO270: modifiers of an action do nothing without it
    if ((NEEDS_ACTION.includes(n) || (n === 'xo-with' && !has('xo-add'))) && !acts) report('error', 'XO270', node, n, `${n} does nothing here: there is no xo-click or xo-submit on the same element`, `Put ${n} on the button or form that has xo-click / xo-submit, or remove it`);
    if (n === 'xo-keep' && !has('xo-submit')) report('error', 'XO270', node, n, 'xo-keep only applies to xo-submit (a form keeps its fields after sending)', 'Put xo-keep on the <form xo-submit>, or remove it');
    if (CONFIRM_DETAILS.includes(n) && !has('xo-confirm')) report('error', 'XO270', node, n, `${n} does nothing without xo-confirm on the same element`, 'Add xo-confirm="Question?" beside it, or remove it');
    if (tag === 'xo-dialog' && n === 'size' && !has('heading')) report('warn', 'XO270', node, n, '<xo-dialog size> only applies to a titled modal: there is no heading', 'Add heading="Title" (the width then follows size), or remove size');
    // XO276: attributes that need their container
    // in a fragment the router may be outside it: only the wrong element is certain
    if ((n === 'xo-route' || n === 'xo-layout') && (tag !== 'template' || (!fragment && node.parentNode?.tagName !== 'xo-router'))) {
      report('error', 'XO276', node, n, `${n} must be on a <template> that is a direct child of <xo-router>; here it is ${tag === 'template' ? 'a template elsewhere' : `on <${tag}>`}, so the router never sees it`, `Write <xo-router><template ${n}="..."> ... </template></xo-router>`);
    }
    if (n === 'xo-guard' && !((tag === 'form' && has('xo-submit')) || (tag === 'xo-form' && has('op')))) report('warn', 'XO276', node, n, 'xo-guard only applies to a <form xo-submit> (it guards unsaved changes of that form)', 'Put xo-guard on the <form xo-submit>, or remove it');
    if (!fragment) {
      if (n === 'xo-tab' && !ctx.tabs) report('warn', 'XO276', node, n, 'xo-tab is not inside an <xo-tabs>, so it is not a tab', 'Wrap the sections in <xo-tabs>');
      if (n === 'xo-menu-trigger' && !ctx.menu) report('warn', 'XO276', node, n, 'xo-menu-trigger is not inside an <xo-menu>', 'Put the trigger button inside <xo-menu>');
      if (['xo-add', 'xo-remove', 'xo-move', 'xo-drag'].includes(n) && !ctx.form) report('warn', 'XO276', node, n, `${n} edits the array of a form, but this is not inside a <form xo-submit>`, 'Put it inside the <form xo-submit> whose array it edits');
    }
    // XO271: a fixed set of values
    const set = VALUE_SETS[n] ?? VALUE_SETS[`${tag} ${n}`];
    if (set && value && !/\{[^}]*\}/.test(value) && !set.includes(value) && !(VALUE_ALIASES[n] ?? []).includes(value)) {
      const hint = nearest(value, set);
      report('warn', 'XO271', node, n, `${VALUE_SETS[n] ? n : `${tag} ${n}`}="${a.value}" is not one of ${set.map((v) => `"${v}"`).join(', ')}${hint ? ` (closest: "${hint}")` : ''}`, hint ? `Use ${n}="${hint}"` : `Use one of ${set.join(', ')}, or remove it`);
    }
    // XO272: values with a syntax of their own
    const pairs = (n === 'xo-with' || n === 'xo-optimistic') ? value.split(',').map((x) => x.trim()).filter(Boolean) : [];
    for (const pair of pairs) if (!/^[\w.-]+\s*=/.test(pair)) report('error', 'XO272', node, n, `${n}="${a.value}": "${pair}" is not "field=value"; the runtime ignores it`, `Write ${n}="field=value,other={path}"`);
    if (n === 'xo-move' && value && !/^.*:(up|down|-?\d+)$/.test(value)) report('error', 'XO272', node, n, `xo-move="${a.value}" is not "path:up" or "path:down"`, 'Write xo-move="blocks[{$index}]:up"');
    if (n === 'xo-select' && tag === 'input' && value && !/^all:\S/.test(value)) report('error', 'XO272', node, n, `xo-select="${a.value}" takes no value on a row checkbox, or "all:<list>" on the header one`, 'Write xo-select (a row) or xo-select="all:items" (every row of the list)');
    if (n === 'xo-param' && value) {
      const control = ['input', 'select', 'textarea'].includes(tag);
      const name = control && /^[\w-]+$/.test(value) ? value : /^([\w-]*\w)\s*(\+=|-=|~=|=)/.exec(value)?.[1];
      if (!name) report('error', 'XO272', node, n, `xo-param="${a.value}" is not "name=value", "name+=n", "name-=n" or "name~=value"${control ? ' (or just the name, on a field)' : ''}`, control ? 'Write xo-param="q" on the field' : 'Write xo-param="status=draft" (or "offset+=10", "sort~=name")');
      else {
        // XO275: the view's operation has to take the parameter, or nothing filters
        const op = view && attr(view, 'get') ? opOf(attr(view, 'get').value) : undefined;
        if (op) {
          const taken = [...(op.query ?? []), ...[...op.path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1])];
          if (!taken.some((q) => camel(q) === camel(name))) report('warn', 'XO275', node, n, `${op.method} ${op.path} takes no parameter "${name}", so xo-param="${a.value}" changes nothing in the request`, `Add "${name}" to the operation's query parameters, or remove xo-param (it is still available as {${camel(name)}} in the view)`);
        }
      }
    }
    // XO274: fields that join the request body must exist in it
    const field = n === 'xo-with' && !has('xo-add') ? pairs.map((x) => /^([\w.-]+)\s*=/.exec(x)?.[1]).filter(Boolean) : n === 'xo-selected' && value ? [value] : [];
    const opRef = attr(node, 'xo-click') ?? attr(node, 'xo-submit');
    const bodyOp = field.length && opRef ? opOf(opRef.value) : undefined;
    if (bodyOp) {
      const names = new Set([...(bodyOp.bodyFields ?? []), ...(bodyOp.bodySkipped ?? [])].map((f) => f.name));
      if (bodyOp.bodySchema?.t === 'object') for (const k of Object.keys(bodyOp.bodySchema.props ?? {})) names.add(k);
      const fields = bodyOp.bodySchema && bodyOp.bodySchema.t !== 'object' ? undefined : names; // a union body: the names are not known up front
      for (const f of field) {
        if (!bodyOp.body) report('warn', 'XO274', node, n, `${n} adds "${f}" to the request body, but ${bodyOp.method} ${bodyOp.path} has no request body`, `Remove ${n}, or use an operation that takes a body`);
        else if (fields?.size && !fields.has(f.split('.')[0])) {
          const hint = nearest(f.split('.')[0], [...fields]);
          report('warn', 'XO274', node, n, `${n} sets "${f}", which is not a field of the request body of ${bodyOp.method} ${bodyOp.path}${hint ? ` (closest: "${hint}")` : ''}`, hint ? `Use "${hint}"` : 'Name a field of the request body, or remove it');
        }
      }
    }
    // XO273: dialogs
    if (n === 'xo-open') {
      const id = /^#([\w-]+)$/.exec(value)?.[1];
      const found = id ? ids.get(id) : undefined;
      if (id && found && found !== 'xo-dialog') report('error', 'XO273', node, n, `xo-open="${value}" matches a <${found}>, not an <xo-dialog>`, 'Put the id on the <xo-dialog>');
      else if (id && !found && !fragment) report('warn', 'XO273', node, n, `xo-open="${value}" matches no element in this file`, `Add <xo-dialog id="${id}"> to this page (or ignore this when the dialog is in another file)`);
    }
    if (n === 'xo-close' && !fragment && !ctx.dialog) report('warn', 'XO273', node, n, 'xo-close is not inside an <xo-dialog>, so it closes nothing', 'Put the button inside the <xo-dialog> it should close');
  }

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
      if (tag === 'img' && view) for (const n of ['src', 'srcset']) { const a = attr(node, n); if (a && /\{[^}]+\}/.test(a.value)) report('warn', 'XO243', node, n, `<img ${n}="${a.value}"> inside an <xo-view>: the browser requests the literal text before the data is bound`, 'Use <xo-image src="..." alt="..."> (it waits for the data), or add the image from a data field with xo-if'); }
      if (tag === 'xo-image' && attr(node, 'alt') === undefined) report('warn', 'XO242', node, undefined, '<xo-image> has no alt attribute', 'Describe the image in alt, or write alt="" when it is decorative');
      if (tag === 'xo-table' || tag === 'xo-pager') { // both read the enclosing view's data; both page through `limit` and `offset`
        const viewGet = view ? attr(view, 'get') : undefined;
        const op = viewGet ? opOf(viewGet.value) : undefined;
        if (!viewGet) report('error', 'XO251', node, undefined, `<${tag}> is not inside an <xo-view get="...">`, `Wrap it: <xo-view get="/things"><${tag} ...></${tag}></xo-view>`);
        else if (op) {
          const paging = tag === 'xo-pager' || attr(node, 'page-size'); // a pager always pages (page-size defaults to 25)
          const need = [...(attr(node, 'sortable') ? ['sort'] : []), ...(paging ? ['limit', 'offset'] : [])];
          const lacking = need.filter((q) => !(op.query ?? []).includes(q));
          for (const f of (attr(node, 'filters')?.value ?? '').split(',').map((x) => x.trim().split(':')[0]).filter(Boolean)) { // "q:Search": the part before the colon is the query parameter
            if (!(op.query ?? []).includes(f)) report('error', 'XO253', node, 'filters', `${op.method} ${op.path} has no query parameter "${f}", which the filter box for "${f}" sets`, `Add "${f}" to the operation's parameters, or remove it from filters`);
          }
          if (lacking.length) report('error', 'XO250', node, attr(node, 'sortable') && lacking.includes('sort') ? 'sortable' : 'page-size', `${op.method} ${op.path} has no query parameter ${lacking.map((q) => `"${q}"`).join(', ')}, which <${tag}> needs for ${attr(node, 'sortable') && lacking.includes('sort') ? 'sorting' : 'paging'}`, `Add ${lacking.join(', ')} to the operation's parameters, or remove ${tag === 'xo-pager' ? 'the pager' : lacking.includes('sort') ? 'sortable' : 'page-size'}`);
        }
      }
      if (tag === 'xo-form') {
        const ref = attr(node, 'op');
        const op = ref ? lookup(node, 'op', ref.value) : undefined;
        const missing = op?.bodySchema ? [] : (op?.bodySkipped ?? []).filter((s) => s.required); // with a request schema the generator draws nested fields too
        if (op && missing.length) report('warn', 'XO255', node, 'op', `${op.method} ${op.path} requires ${missing.map((m) => `${m.name} (${m.type})`).join(', ')}, which <xo-form> cannot generate yet, so the generated form can never succeed`, 'Write this form by hand (<form xo-submit>), or make the field optional in the API');
        if (op && !(op.bodyFields ?? []).length) report('warn', 'XO252', node, 'op', `${op.method} ${op.path} has no simple request fields, so <xo-form> would be empty`, 'Write the <form xo-submit> by hand, or describe the request body as an object of strings, numbers and booleans');
      }
      for (const a of node.attrs ?? []) {
        if (a.name.startsWith('xo-') && !ATTRS.has(a.name)) {
          const hint = nearest(a.name, [...ATTRS]);
          report('error', 'XO230', node, a.name, `unknown attribute ${a.name}${hint ? ` (closest: ${hint})` : ''}`, hint ? `Use ${hint}` : 'Remove it; xoong has no such attribute');
        }
        if (a.name === 'xo-selected' && !attr(node, 'xo-click')) report('error', 'XO254', node, a.name, 'xo-selected needs xo-click on the same element', 'Add xo-click="METHOD /path/{id}" to run once per ticked row');
        if (a.name === 'xo-select' && (tag !== 'input' || attr(node, 'type')?.value !== 'checkbox')) report('error', 'XO254', node, a.name, `xo-select must be on <input type="checkbox">, found <${tag}>`, 'Use a checkbox, or <xo-table selectable>');
        if (NEEDS_VALUE.includes(a.name) && !a.value.trim()) {
          report('error', 'XO221', node, a.name, `${a.name} is empty`, a.name === 'xo-confirm' ? 'Write the question: xo-confirm="Delete {title}?"' : a.name === 'xo-then' ? 'Write the path to go to: xo-then="/articles/{id}"' : a.name === 'xo-open' ? 'Name the dialog: xo-open="#add"' : `Give ${a.name} a value, for example ${a.name}="${a.name === 'xo-with' || a.name === 'xo-optimistic' ? 'status=done' : 'items'}"`);
        }
        attributeRules(node, tag, a, view, ctx);
        if (a.name === 'xo-click' || a.name === 'xo-submit') {
          const op = lookup(node, a.name, a.value);
          if (op && op.method === 'GET' && a.name === 'xo-click') report('warn', 'XO202', node, a.name, `${a.name} calls the GET operation ${op.path}`, 'Reads are declared with <xo-view get="...">; xo-click is for mutations');
          if (a.name === 'xo-submit' && tag === 'form' && !view) report('error', 'XO222', node, a.name, '<form xo-submit> is not inside an <xo-view>, so it never binds: no model, the inputs stay empty', 'Wrap it in <xo-view> (an <xo-view> without get is enough)');
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
      ctx = { view, router, route, dialog: ctx.dialog || tag === 'xo-dialog', tabs: ctx.tabs || tag === 'xo-tabs', menu: ctx.menu || tag === 'xo-menu', form: ctx.form || (tag === 'form' && attr(node, 'xo-submit') !== undefined) };
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
      let code = '';
      for (i++; i < n && source[i] !== '`'; i++) {
        if (source[i] === '\\') { code += source.slice(i, i + 2); i++; continue; }
        if (source[i] === '$' && source[i + 1] === '{') {
          const from = i;
          i += 2; skipCode('}'); i--; // i is now on the closing brace
          const hole = source.slice(from, i + 1);
          code += 'x' + hole.slice(1).replace(/[^\n]/g, ' ');
          continue;
        }
        code += source[i];
      }
      const before = source.slice(0, start).split('\n');
      out.push({ text: code, line: before.length, column: before[before.length - 1].length + 1 });
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
    for (const f of checkHtml(t.text, table, file, { fragment: true })) {
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
export async function collectHtml(paths, { exclude } = {}) {
  const out = [];
  const skip = excluder(exclude);
  const visit = async (p) => {
    if (skip(relative('.', p))) return;
    const s = await stat(p);
    if (s.isDirectory()) {
      for (const name of await readdir(p)) if (!['node_modules', 'dist', 'build', 'coverage'].includes(name) && !name.startsWith('.')) await visit(join(p, name));
    } else if (['.html', '.htm', '.js', '.mjs', '.ts', '.mts'].includes(extname(p).toLowerCase()) && !p.endsWith('.d.ts') && !p.endsWith('.min.js')) out.push(p);
  };
  for (const p of paths) await visit(p);
  return out.sort();
}

/** @returns {Promise<{ findings: Finding[], files: number }>} */
export async function checkFiles(paths, table, options = {}) {
  const files = await collectHtml(paths, options);
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
