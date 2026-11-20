// @ts-check
/**
 * The binding engine: `bindNode` walks a node and binds text, attributes, `xo-each`, `xo-if`, `xo-use` and the elements of the admin set (`defineTemplate`)
 * against a scope, and hands the attributes that act (`xo-click`, `xo-param`, `xo-select`, `xo-add`...) to their own modules.
 */
import { effect, signal, batch, untracked } from '@xoong/core/signals';
import { isRef } from './store.js';
import { parseInterpolation, evalParts } from './scope.js';
import { isSafeUrl } from './safe-url.js';
import { bindAction } from './actions.js';
import { bindParam, bindSelect } from './state.js';
import { bindDrag, bindArrayAction } from './arrays.js';

/**
 * Components that expand into plain markup before binding (used by @xoong/ui).
 * tag -> (el, { host, client, take }) => Node.
 * `take(name)` reads an attribute the component handles and removes it. Every attribute still on the host after
 * expand is copied onto the first element root of the output (ADR-0014): `class` is appended, `style` is the
 * component's declarations then the author's, and any other attribute is the author's.
 */
const templates = new Map();
/** @param {string} tag @param {(el: Element, env: { host: any, client: any, take: (name: string) => string | null }) => Node} expand */
export function defineTemplate(tag, expand) { templates.set(tag, expand); }

/** `@xoong/i18n` registers how `xo-t` elements are translated (the view supplies the scope for `{placeholders}`). */
let translator = /** @type {{ apply: (el: Element, get: (name: string) => any) => void, hasText: (spec: string) => boolean } | null} */ (null);
/** @param {{ apply: (el: Element, get: (name: string) => any) => void, hasText: (spec: string) => boolean }} t */
export function setTranslator(t) { translator = t; }

export function bindNode(node, scope, ctx, disposers) {
  const { lookup } = ctx;
  if (node.nodeType === 3) {
    const parts = parseInterpolation(node.data);
    if (parts) disposers.push(effect(() => { const text = evalParts(parts, scope, lookup); if (node.data !== text) node.data = text; })); // an identical write still wakes observers and costs layout
    return;
  }
  if (node.nodeType !== 1) return;
  const el = /** @type {Element} */ (node);
  if (el.localName === 'script' || el.localName === 'style') return;

  const expand = templates.get(el.localName);
  if (expand) return expandHost(el, expand, scope, ctx, disposers);
  if (el.hasAttribute('xo-each') && el.hasAttribute('xo-if') && el.localName !== 'template') return eachWithIf(el, scope, ctx, disposers);
  if (el.hasAttribute('xo-each')) return bindEach(el, scope, ctx, disposers);
  if (el.hasAttribute('xo-if')) return bindIf(el, scope, ctx, disposers);

  // xo-t: translate this element; its `{placeholders}` come from the scope. Without @xoong/i18n the text is bound as written.
  let translated = false;
  if (el.hasAttribute('xo-t') && translator) {
    const t = translator;
    translated = t.hasText(el.getAttribute('xo-t') ?? ''); // only a translated *text* replaces the children; attribute-only translations leave them bound
    disposers.push(effect(() => t.apply(el, (name) => ctx.lookup(scope, name))));
  }
  let childScope = scope;
  /** @type {string | null} */ let useSpec = null;
  // getAttributeNames(), not `attributes`: iterating `attributes` makes the browser create an Attr node for every attribute of every row and keep it as long as the row lives
  for (const name of el.getAttributeNames()) {
    const value = el.getAttribute(name) ?? '';
    if (name === 'xo-use') { useSpec = value; el.removeAttribute(name); } // read once; a row is cloned from the template, which still has it
    else if (name === 'xo-src' || name === 'xo-srcset') { // the address of an image, set when it is bound: the template holds no src, so nothing is requested before the data is there
      el.removeAttribute(name);
      if (parseInterpolation(value)) bindDataAttribute(el, name.slice(3), value, scope, ctx, disposers); else el.setAttribute(name.slice(3), value);
    } else if (name === 'xo-click' || name === 'xo-submit') {
      const engine = bindAction(el, name === 'xo-click' ? 'click' : 'submit', value, scope, ctx, disposers);
      if (engine) childScope = { value: () => engine.model.value, parent: scope, vars: { $form: () => engine.model } }; // `$form.dirty`, `$form.errors['title.vi']` ... inside the form
    } else if (ACTING[name]) ACTING[name](el, value, scope, ctx, disposers, name);
    else if (!SETTINGS.has(name)) bindDataAttribute(el, name, value, scope, ctx, disposers);
  }
  if (el.localName === 'xo-view') return; // a nested view binds its own children against its own data when it starts; the outer pass must not touch them (its `p-*` attributes above are bound to the outer scope)
  if (useSpec !== null) return bindUse(el, useSpec, childScope, ctx, disposers);
  if (!translated) for (const child of [...el.childNodes]) bindNode(child, childScope, ctx, disposers); // a translated element's text is the message, not markup
}

/** The attributes that act, by name: how each is bound to its element. (`xo-click` and `xo-submit` are bound in `bindNode`: a form gives its children a scope.) */
const ACTING = /** @type {Record<string, (el: Element, value: string, scope: any, ctx: any, disposers: (() => void)[], name: string) => void>} */ ({
  'xo-add': (el, value, scope, ctx, disposers, name) => bindArrayAction(el, name, value, scope, ctx, disposers),
  'xo-remove': (el, value, scope, ctx, disposers, name) => bindArrayAction(el, name, value, scope, ctx, disposers),
  'xo-move': (el, value, scope, ctx, disposers, name) => bindArrayAction(el, name, value, scope, ctx, disposers),
  'xo-drag': (el, value, scope, ctx) => bindDrag(el, value, scope, ctx),
  'xo-select': (el, value, scope, ctx, disposers) => bindSelect(el, value, scope, ctx, disposers),
  'xo-param': (el, value, scope, ctx, disposers) => bindParam(el, value, scope, ctx, disposers),
  'xo-refresh': (el, _value, _scope, ctx, disposers) => {
    const refresh = () => ctx.host.refresh();
    el.addEventListener('click', refresh);
    disposers.push(() => el.removeEventListener('click', refresh));
  },
});
/** Attributes that the attributes above read (an action's own settings): nothing to bind on their own. */
const SETTINGS = new Set(['xo-body', 'xo-keep', 'xo-optimistic', 'xo-selected', 'xo-with', 'xo-confirm', 'xo-notice', 'xo-then', 'xo-t']);

/** An element of the admin set (`<xo-table>`, `<xo-form>`...) is replaced by the markup it expands to, and that markup is bound. */
function expandHost(el, expand, scope, ctx, disposers) {
  let out;
  try {
    out = expand(el, { host: ctx.host, client: ctx.client, take: (n, v = el.getAttribute(n)) => (el.removeAttribute(n), v) });
  } catch (e) {
    console.error(e); // a typo in the screen: say so, leave a marker, keep the rest of the screen alive
    ctx.host.emit('xo-error', e);
    el.replaceWith(document.createComment(`<${el.localName}> failed: ${e.message}`));
    return;
  }
  const nodes = out.nodeType === 11 ? [...out.childNodes] : [out], root = nodes.find((n) => n.nodeType === 1) || el; // replaceWith moves a fragment's children out, so remember them first. No element root: copy onto the host, which replaceWith then removes
  for (const n of el.getAttributeNames()) root.setAttribute(n, ((n === 'class' || n === 'style') && root.getAttribute(n) ? root.getAttribute(n) + (n === 'class' ? ' ' : ';') : '') + el.getAttribute(n));
  el.replaceWith(out);
  for (const n of nodes) bindNode(n, scope, ctx, disposers);
}

/** `xo-each` and `xo-if` on one element: each row is shown when its own condition holds (a row made of a template can hold the condition). */
function eachWithIf(el, scope, ctx, disposers) {
  const rows = document.createElement('template'), row = /** @type {Element} */ (el.cloneNode(true));
  rows.setAttribute('xo-each', /** @type {string} */ (el.getAttribute('xo-each')));
  row.removeAttribute('xo-each');
  rows.content.append(row);
  el.replaceWith(rows);
  return bindEach(rows, scope, ctx, disposers);
}

/** A `{path}` in an attribute: bound text, a boolean attribute that follows the data, or a URL kept safe. Data never reaches an attribute that runs code. */
function bindDataAttribute(el, name, value, scope, ctx, disposers) {
  const { lookup } = ctx;
  const parts = parseInterpolation(value);
  if (parts) {
    if (isScriptAttr(name)) {
      console.error(`xoong: refusing to interpolate data into the "${name}" attribute (it executes code)`);
      el.removeAttribute(name);
      return;
    }
    if (BOOLEAN_ATTRS.has(name) && parts.length === 1 && typeof parts[0] !== 'string') { // hidden="{closed}": present when true, absent when false
      const path = parts[0].path;
      disposers.push(effect(() => {
        const v = lookup(scope, path);
        const on = Array.isArray(v) ? v.length > 0 : !!v && v !== 'false';
        el.toggleAttribute(name, on);
        if ((name === 'checked' || name === 'selected') && name in el) /** @type {any} */ (el)[name] = on; // the attribute only sets the default state
      }));
      return;
    }
    disposers.push(effect(() => {
      let v = evalParts(parts, scope, lookup);
      if (URL_ATTRS.has(name) && !isSafeUrl(v, name === 'src' && (el.localName === 'img' || el.localName === 'xo-image'))) v = 'about:blank';
      if (el.getAttribute(name) !== v) el.setAttribute(name, v);
    }));
  }
}

/** How deep `xo-use` may nest (a template that names itself ends when its list is empty; this stops one that never does). */
const MAX_USE_DEPTH = 32;
const warnedUse = new Set();

/**
 * `<template xo-define="name">` nearest to `from`: beside it or around it (a row of a list can define its own, and a row is bound before it is in the page, so
 * the search goes up the parents it has), then in the view, then in the page. A name that is not a plain word is not a name (it may come from data).
 */
function findTemplate(from, host, name) {
  if (!/^[\w:.-]+$/.test(name)) return null;
  const sel = `template[xo-define="${name}"]`;
  for (let n = from.parentNode; n && n !== host; n = n.parentNode) { const t = /** @type {any} */ (n).querySelector?.(sel); if (t) return /** @type {HTMLTemplateElement} */ (t); }
  return /** @type {HTMLTemplateElement | null} */ (host.querySelector(sel) ?? document.querySelector(sel));
}

/**
 * `xo-use="name"` (or `xo-use="block-{type}"`): the element's content is the template of that name, bound against the current item, so a template can
 * show a list of items that each name a template, itself included (a tree). On a `<template xo-use>` the content stands with no element around it.
 * What the element holds itself is shown when no template has the name.
 */
function bindUse(el, spec, scope, ctx, disposers) {
  const bare = el.localName === 'template';
  const own = document.createDocumentFragment();
  own.append(.../** @type {Node[]} */ ([...(bare ? /** @type {HTMLTemplateElement} */ (el).content.childNodes : el.childNodes)]));
  const parts = parseInterpolation(spec);
  /** @type {Comment} */ let end;
  if (bare) { end = document.createComment('/xo-use'); el.replaceWith(document.createComment('xo-use'), end); }
  let name = /** @type {string | null} */ (null), stops = /** @type {(() => void)[]} */ ([]), shown = /** @type {Node[]} */ ([]);
  const clear = () => { stops.forEach((s) => s()); stops = []; for (const n of shown) n.remove(); shown = []; };
  disposers.push(effect(() => {
    const next = (parts ? evalParts(parts, scope, ctx.lookup) : spec).trim();
    if (next === name) return;
    name = next;
    untracked(() => {
      clear();
      const depth = /** @type {any} */ (scope).useDepth + 1 || 1;
      if (depth > MAX_USE_DEPTH) { console.error(`xoong: xo-use="${spec}" nests more than ${MAX_USE_DEPTH} deep: a template that uses itself needs a list that ends`); return; }
      const def = findTemplate(bare ? end : el, ctx.host, next);
      if (!def && !own.childNodes.length && !warnedUse.has(next)) { warnedUse.add(next); console.warn(`xoong: no <template xo-define="${next}"> for xo-use="${spec}"`); }
      const frag = (def ? def.content : own).cloneNode(true);
      shown = [...frag.childNodes];
      if (bare) end.before(frag); else el.append(frag);
      const inner = { ...scope, useDepth: depth };
      batch(() => { for (const n of shown) bindNode(n, inner, ctx, stops); });
    });
  }));
  disposers.push(clear);
}

/** Boolean attributes: `{flag}` as the whole value turns them on and off (an attribute with the value "false" would still count as set). */
const BOOLEAN_ATTRS = new Set(['hidden', 'disabled', 'checked', 'selected', 'readonly', 'required', 'open', 'multiple', 'inert', 'autofocus', 'controls', 'loop', 'muted', 'reversed']);

/** Attributes whose value is a URL: data must not smuggle in script schemes. */
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'poster', 'xlink:href', 'data', 'cite', 'srcset']);
const isScriptAttr = (name) => name.startsWith('on') || name === 'srcdoc';

function bindIf(el, scope, ctx, disposers) {
  const expr = el.getAttribute('xo-if').trim();
  // `xo-if="type=image"` / `xo-if="status!=draft"`: compare a path with a literal (the text of the value; quotes optional)
  const cmp = /^(.+?)\s*(!?=)\s*(?:'([^']*)'|"([^"]*)"|(.*?))\s*$/.exec(expr);
  const negate = cmp ? cmp[2] === '!=' : expr.startsWith('!');
  const path = cmp ? cmp[1].trim() : negate ? expr.slice(1).trim() : expr;
  const literal = cmp ? (cmp[3] ?? cmp[4] ?? cmp[5]) : undefined;
  const tpl = el.cloneNode(true);
  tpl.removeAttribute('xo-if');
  const marker = document.createComment('xo-if');
  el.replaceWith(marker);
  /** @type {{ node: Element, stops: (() => void)[] } | null} */
  let shown = null;
  disposers.push(effect(() => {
    const v = ctx.lookup(scope, path);
    const truthy = literal !== undefined ? String(v ?? '') === literal : Array.isArray(v) ? v.length > 0 : !!v;
    const want = negate ? !truthy : truthy;
    if (want && !shown) {
      const node = /** @type {Element} */ (tpl.cloneNode(true));
      const stops = [];
      marker.after(node);
      bindNode(node, scope, ctx, stops);
      shown = { node, stops };
    } else if (!want && shown) {
      shown.stops.forEach((s) => s());
      shown.node.remove();
      shown = null;
    }
  }));
  disposers.push(() => { shown?.stops.forEach((s) => s()); shown?.node.remove(); shown = null; });
}

function bindEach(el, scope, ctx, disposers) {
  const path = el.getAttribute('xo-each').trim();
  // `<template xo-each="blocks">...</template>` repeats its children with no element of its own (a list of mixed blocks: h2, p, ul, figure)
  const fragmentRows = el.localName === 'template';
  const tpl = /** @type {Element} */ (el.cloneNode(true));
  tpl.removeAttribute('xo-each');
  const start = document.createComment('xo-each');
  const end = document.createComment('/xo-each');
  el.replaceWith(start, end);
  /** A row is the nodes from `first` to `last` (one element, or the children of a template between two comments). */
  /** @typedef {{ first: Node, last: Node, stops: (() => void)[], index: ReturnType<typeof signal>, current: ReturnType<typeof signal>, frag?: DocumentFragment }} Row */
  /** @type {Map<string, Row>} */
  let rows = new Map();
  const nodesOf = (/** @type {Row} */ row) => { const out = [row.first]; for (let n = row.first; n !== row.last && n.nextSibling; ) { n = /** @type {Node} */ (n.nextSibling); out.push(n); } return out; };
  const dropRow = (/** @type {Row} */ row) => { row.stops.forEach((s) => s()); for (const n of nodesOf(row)) n.remove(); };
  // Built outside the effect on purpose: a closure made inside it keeps that run's `next` map (and so every row of that run, deleted ones too) alive for as long as the row lives.
  const makeRow = (item, i) => {
    const index = signal(i);
    const current = signal(item);
    // `$index` is the nearest row; `$i0`, `$i1` ... are the rows of the enclosing `xo-each`s, outermost first (names of nested array fields)
    let depth = 0;
    for (let s = scope; s; s = s.parent) if (s.vars?.$index) depth++;
    const itemScope = { value: () => current.value, parent: scope, vars: { $index: () => index.value, $n: () => index.value + 1, [`$i${depth}`]: () => index.value } };
    const stops = [];
    if (fragmentRows) {
      const frag = document.createDocumentFragment(), first = document.createComment('xo-row'), last = document.createComment('/xo-row');
      frag.append(first, .../** @type {HTMLTemplateElement} */ (tpl).content.cloneNode(true).childNodes, last);
      batch(() => { for (const n of [...frag.childNodes]) if (n !== first && n !== last) bindNode(n, itemScope, ctx, stops); });
      return { first, last, stops, index, current, frag };
    }
    const node = /** @type {Element} */ (tpl.cloneNode(true));
    batch(() => bindNode(node, itemScope, ctx, stops));
    return { first: node, last: node, stops, index, current };
  };
  disposers.push(effect(() => {
    const list = ctx.lookup(scope, path);
    const items = (Array.isArray(list) ? list : []).filter((it) => !isRef(it) || ctx.client.store.has(it)); // drop deleted entities
    // Do not subscribe this effect to row internals: bind rows untracked by their own effects.
    const next = new Map();
    // Rows that are gone leave first: otherwise each row after a deleted one finds a stranger in its place and is moved, so deleting one row of a thousand moved a thousand.
    const keys = items.map((item, i) => (isRef(item) ? item.$ref : `#${i}`)), keep = new Set(keys);
    for (const [key, row] of rows) if (!keep.has(key)) dropRow(row);
    /** @type {Node} */ let cursor = start;
    // New rows are inserted together (one DOM change, one record for every observer on the page) just before the next row that was already there
    /** @type {DocumentFragment | null} */ let pending = null;
    /** @type {Node} */ let anchor = start;
    const flush = () => { if (pending) anchor.after(pending); pending = null; };
    items.forEach((item, i) => {
      const key = keys[i];
      let row = rows.get(key) ?? next.get(key);
      const fresh = !row;
      if (!row) row = makeRow(item, i);
      else { // a reused row follows its new position and item; an entity is the same item while its key is the same (its fields are read from the store)
        const cur = row.current.peek();
        batch(() => { row.index.value = i; if (isRef(item) ? cur?.$ref !== key : cur !== item) row.current.value = item; });
      }
      next.set(key, row);
      if (fresh) { if (!pending) { pending = document.createDocumentFragment(); anchor = cursor; } pending.append(row.frag ?? row.first); } // a fresh row is one element, or the fragment of a template row
      else { flush(); if (cursor.nextSibling !== row.first) cursor.after(...nodesOf(row)); }
      row.frag = undefined;
      cursor = row.last;
    });
    flush();
    rows = next;
  }));
  disposers.push(() => { for (const row of rows.values()) dropRow(row); rows.clear(); });
}
