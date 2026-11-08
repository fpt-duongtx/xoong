// @ts-check
/**
 * `html` tagged template with fine-grained reactive bindings (Light DOM, no VDOM).
 *
 *   html`<h3 class=${() => cls.value}>${() => name.value}</h3>
 *        <button @click=${() => save()}>Save</button>`
 *
 * Binding rules (the whole language):
 *   child position : function => reactive, value => static; arrays, nodes and
 *                    nested `html` results are supported.
 *   name=${v}      : attribute; function => reactive. null/false removes it.
 *   ?name=${v}     : boolean attribute.
 *   .name=${v}     : DOM property (use lowercase-insensitive names; original case is kept).
 *   @event=${fn}   : event listener.
 * An attribute value must be exactly one expression (no mixing text and `${}`).
 */
import { effect, untracked } from './signals.js';

const MARK = '__xo_';
const cache = new WeakMap();

export class TemplateResult {
  /** @param {TemplateStringsArray} strings @param {unknown[]} values */
  constructor(strings, values) {
    this.strings = strings;
    this.values = values;
  }
}

/**
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 */
export const html = (strings, ...values) => new TemplateResult(strings, values);

/** Parse once per call site. */
function compile(strings) {
  let compiled = cache.get(strings);
  if (compiled) return compiled;
  let out = '';
  let cur = strings[0];
  /** @type {({kind:'child'}|{kind:'attr', name:string, prefix:string})[]} */
  const parts = [];
  for (let i = 0; i < strings.length - 1; i++) {
    out += cur;
    cur = strings[i + 1];
    if (out.lastIndexOf('<') > out.lastIndexOf('>')) {
      const m = /([@.?]?)([^\s"'<>=/@.?]+)=(["']?)$/.exec(out);
      if (!m) throw new Error('xoong html: an expression inside a tag must be a whole attribute value, e.g. class=${...}');
      out = out.slice(0, m.index) + `${m[2].toLowerCase()}="${MARK}${i}"`;
      if (m[3] && cur.startsWith(m[3])) cur = cur.slice(1); // drop the closing quote that wrapped the expression
      parts.push({ kind: 'attr', name: m[2], prefix: m[1] });
    } else {
      out += `<!--${MARK}${i}-->`;
      parts.push({ kind: 'child' });
    }
  }
  out += cur;
  const template = document.createElement('template');
  template.innerHTML = out;
  compiled = { template, parts };
  cache.set(strings, compiled);
  return compiled;
}

/**
 * Render a template result into `container`. Returns a dispose function.
 * @param {TemplateResult} result
 * @param {Element | DocumentFragment} container
 * @returns {() => void}
 */
export function render(result, container) {
  const disposers = [];
  const frag = instantiate(result, disposers);
  container.replaceChildren(frag);
  return () => disposers.splice(0).forEach((d) => d());
}

function instantiate(result, disposers) {
  const { template, parts } = compile(result.strings);
  const frag = /** @type {DocumentFragment} */ (template.content.cloneNode(true));
  const walker = document.createTreeWalker(frag, NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_ELEMENT);
  /** @type {Comment[]} */ const comments = [];
  /** @type {Element[]} */ const elements = [];
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (n.nodeType === 8) {
      if (/** @type {Comment} */ (n).data.startsWith(MARK)) comments.push(/** @type {Comment} */ (n));
    } else {
      elements.push(/** @type {Element} */ (n));
    }
  }
  for (const c of comments) {
    const i = Number(c.data.slice(MARK.length));
    bindChild(c, result.values[i], disposers);
  }
  for (const el of elements) {
    for (const attr of [...el.attributes]) {
      if (!attr.value.startsWith(MARK)) continue;
      const i = Number(attr.value.slice(MARK.length));
      const part = /** @type {any} */ (parts[i]);
      el.removeAttribute(attr.name);
      bindAttr(el, part, result.values[i], disposers);
    }
  }
  return frag;
}

function bindAttr(el, part, value, disposers) {
  const { prefix, name } = part;
  if (prefix === '@') {
    el.addEventListener(name, /** @type {EventListener} */ (value));
    disposers.push(() => el.removeEventListener(name, /** @type {EventListener} */ (value)));
    return;
  }
  const apply = (v) => {
    if (name.startsWith('style:')) el.style[v == null || v === false ? 'removeProperty' : 'setProperty'](name.slice(6), v); // style:--x=${v}: the CSS object model, so a strict CSP (no style="") allows it
    else if (prefix === '.') el[name] = v;
    else if (prefix === '?') el.toggleAttribute(name, !!v);
    else if (v == null || v === false) el.removeAttribute(name);
    else el.setAttribute(name, v === true ? '' : String(v));
  };
  if (typeof value === 'function') disposers.push(effect(() => { const v = value(); untracked(() => apply(v)); })); // only `value` is tracked: what a child element reads while it connects must not subscribe this binding
  else apply(value);
}

function bindChild(marker, value, disposers) {
  const end = document.createComment('/xo');
  marker.after(end);
  marker.data = 'xo';
  let inner = [];
  const clear = () => {
    inner.splice(0).forEach((d) => d());
    while (marker.nextSibling && marker.nextSibling !== end) marker.nextSibling.remove();
  };
  const put = (v) => {
    clear();
    const frag = document.createDocumentFragment();
    appendValue(frag, v, inner);
    end.before(frag);
  };
  if (typeof value === 'function') disposers.push(effect(() => { const v = value(); untracked(() => put(v)); })); // same: inserting content connects child elements
  else put(value);
  disposers.push(clear);
}

function appendValue(frag, v, disposers) {
  if (v == null || v === false || v === true) return;
  if (v instanceof TemplateResult) frag.append(instantiate(v, disposers));
  else if (v instanceof Node) frag.append(v);
  else if (Array.isArray(v)) v.forEach((x) => appendValue(frag, x, disposers));
  else frag.append(document.createTextNode(String(v)));
}
