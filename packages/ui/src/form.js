// @ts-check
/**
 * <xo-form op="updateArticle" submit="Save"></xo-form>: the markup of a form, written for you from the operation's request schema
 * (`bodySchema` in operations.json). The same binder as for a hand-written `<form xo-submit>` does the rest (ADR-0009): prefill, validation,
 * dirty tracking, errors, payload. Nothing here is a second code path: it only emits the markup you would have written.
 *
 *  - simple fields: one labelled control; enums are selects, booleans checkboxes, formats choose the input type;
 *  - nested objects: a fieldset; arrays of values or objects: rows with add, remove, up and down buttons;
 *  - unions (oneOf with a tag): one "Add <variant>" button per variant, and each row shows the fields of its variant;
 *  - hints (`xoong.hints.json` / the schema): `label`, `hint`, `placeholder`, `widget` (textarea, password, url, email, color, date, datetime,
 *    or the tag of any custom element that extends XoControl), `order`, `readOnly`, `hidden` (kept in the model, not drawn), `group` (a fieldset
 *    with a legend). `title` / `description` of the schema are the label and the hint.
 * Without a `bodySchema` (a multipart body) the flat `bodyFields` are used as before.
 */
import { defineTemplate } from '@xoong/data/view';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const label = (name) => /^[a-z]{2}(-[A-Za-z]{2})?$/.test(name) ? String(name).replace(/^[a-z]{2}/, (c) => c.toUpperCase()) : String(name).replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
const TYPES = { email: 'email', password: 'password', date: 'date', 'date-time': 'datetime-local', uri: 'url', url: 'url' }; // the flat generator (bodyFields only)
const TYPE_OF_WIDGET = { password: 'password', url: 'url', email: 'email', color: 'color', date: 'date', datetime: 'datetime-local', time: 'time' };
const PRIMITIVE = new Set(['string', 'integer', 'number', 'boolean']);

/** Fields in display order: by `order`, then as declared. Hidden ones are not drawn. */
function ordered(props) {
  return Object.entries(props ?? {})
    .map(([name, node], i) => ({ name, node, i }))
    .filter(({ node }) => !node.hidden && !node.readOnly)
    .sort((a, b) => (a.node.order ?? 1e9) - (b.node.order ?? 1e9) || a.i - b.i);
}

/** One simple control with its label, hint and widget. */
function control(node, name, text) {
  const attrs = `name="${esc(name)}"${node.readOnly ? ' readonly' : ''}`;
  const widget = node.widget;
  let input;
  if (widget && widget.includes('-')) input = `<${esc(widget)} ${attrs}></${esc(widget)}>`; // a custom XoControl: the binder gives it its schema node, hints and the form model
  else if (widget === 'textarea') input = `<textarea ${attrs}></textarea>`;
  else if (node.enum || widget === 'select') input = `<select ${attrs}></select>`;
  else if (node.t === 'boolean') input = `<input type="checkbox" ${attrs}>`;
  else input = `<input${TYPE_OF_WIDGET[widget] ? ` type="${TYPE_OF_WIDGET[widget]}"` : ''} ${attrs}>`;
  const hint = node.description ? `<small class="xo-hint">${esc(node.description)}</small>` : '';
  const caption = `<span>${esc(node.title ?? text)}</span>`;
  return `<label class="xo-field">${node.t === 'boolean' ? `${input}${caption}` : `${caption}${input}`}${hint}</label>`;
}

/** The fields of an object node, grouped by `group`. `rowPath(name)` gives the name a child gets. */
function fields(node, path, depth, skip = []) {
  const groups = new Map();
  for (const f of ordered(node.props)) {
    if (skip.includes(f.name)) continue;
    const key = f.node.group ?? '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  return [...groups].map(([group, list]) => {
    const html = list.map((f) => field(f.node, path ? `${path}.${f.name}` : f.name, f.name, depth)).join('');
    return group ? `<fieldset class="xo-group"><legend>${esc(group)}</legend>${html}</fieldset>` : html;
  }).join('');
}

/** The heading of an array row: its number and, for unions, the variant. */
const rowTitle = (text) => `<span class="xo-row-title"><span class="xo-row-no">{$n}.</span>${text ? ` <strong>${esc(text)}</strong>` : ''}</span>`;

/** Buttons of an array row. */
const rowButtons = (path) => `<span class="xo-row-actions"><span class="xo-handle" xo-drag="${path}" aria-hidden="true">⋮⋮</span><button type="button" xo-move="${path}:up" aria-label="Move up" xo-t="aria-label:xoong.form.moveUp">↑</button><button type="button" xo-move="${path}:down" aria-label="Move down" xo-t="aria-label:xoong.form.moveDown">↓</button><button type="button" xo-remove="${path}" aria-label="Remove" xo-t="aria-label:xoong.form.remove">×</button></span>`;

function field(node, path, name, depth) {
  const text = label(name);
  if (node.widget?.includes('-') && !PRIMITIVE.has(node.t)) return control(node, path, text); // a custom control owns a whole array, object or union (tags, a block picker)
  if (PRIMITIVE.has(node.t)) return control(node, path, text);
  if (node.t === 'object') return `<fieldset class="xo-object"><legend>${esc(node.title ?? text)}</legend>${fields(node, path, depth)}</fieldset>`;
  if (node.t === 'array') return array(node, path, text, depth);
  if (node.t === 'union') return `<fieldset class="xo-object"><legend>${esc(node.title ?? text)}</legend>${variants(node, path, depth)}</fieldset>`;
  return ''; // `any`: not drawn
}

/** A union that is a plain property: choose the variant, then show its fields. */
function variants(node, path, depth) {
  const key = node.key;
  const options = Object.keys(node.map).map((v) => `<option value="${esc(v)}">${esc(label(v))}</option>`).join('');
  return `<label class="xo-field"><span>${esc(label(key))}</span><select name="${esc(path)}.${esc(key)}"><option value=""></option>${options}</select></label>`
    + Object.entries(node.map).map(([v, n]) => `<div xo-if="${esc(path)}.${esc(key)}=${esc(v)}">${fields(n, path, depth, [key])}</div>`).join('');
}

/** An array: a row per item with its controls and buttons, and add buttons below. */
function array(node, path, text, depth) {
  const item = node.items;
  const at = `{$i${depth}}`; // the row index in names; the generator knows the nesting depth, so inner arrays can name outer rows
  const rowPath = `${path}[${at}]`;
  let row;
  let adds;
  if (item.t === 'union') {
    row = Object.entries(item.map).map(([v, n]) => `<div class="xo-variant" xo-if="type=${esc(v)}">${rowTitle(n.title ?? label(v))}${fields(n, rowPath, depth + 1, [item.key])}</div>`).join('');
    adds = Object.keys(item.map).map((v) => `<button type="button" xo-add="${esc(path)}" xo-with="${esc(item.key)}=${esc(v)}">Add ${esc(label(item.map[v].title ?? v))}</button>`).join('');
  } else {
    row = PRIMITIVE.has(item.t) ? control({ ...item, title: item.title ?? `${text} item` }, rowPath, text) : item.t === 'object' ? rowTitle(item.title ?? '') + fields(item, rowPath, depth + 1) : '';
    adds = `<button type="button" xo-add="${esc(path)}" xo-t="xoong.form.add">Add</button>`;
  }
  return `<fieldset class="xo-array"><legend>${esc(node.title ?? text)}</legend>${node.description ? `<small class="xo-hint">${esc(node.description)}</small>` : ''}`
    + `<div class="xo-row" xo-each="${esc(path)}">${row}${rowButtons(rowPath)}</div><div class="xo-array-add">${adds}</div></fieldset>`;
}

/** What a `<xo-form op>` hands to the `<form xo-submit>` it draws: `<xo-form op="createPerson" xo-notice="Saved" xo-then="/people">`. */
const FORWARDED = ['xo-then', 'xo-notice', 'xo-confirm', 'xo-confirm-title', 'xo-confirm-ok', 'xo-confirm-cancel', 'xo-confirm-kind', 'xo-guard', 'xo-keep', 'xo-with'];

defineTemplate('xo-form', (el, { client }) => {
  const ref = el.getAttribute('op') ?? '';
  const op = client.op(ref); // unknown operations throw with the closest valid name
  const form = document.createElement('form');
  form.setAttribute('xo-submit', ref);
  form.className = 'xo-form';
  for (const name of FORWARDED) if (el.hasAttribute(name)) form.setAttribute(name, el.getAttribute(name) ?? ''); // the modifiers of the action go to the form that runs it
  if (op.bodySchema) { // the schema-driven generator: nested objects, arrays, unions, hints
    const submit = el.getAttribute('submit');
    form.innerHTML = fields(op.bodySchema, '', 0) + (submit ? `<button class="xo-submit">${esc(submit)}</button>` : '<button class="xo-submit" xo-t="xoong.form.save">Save</button>');
    return form;
  }
  const flat = op.bodyFields ?? [];
  const missing = (op.bodySkipped ?? []).filter((s) => s.required);
  if (missing.length) console.warn(`xoong: <xo-form op="${ref}"> cannot generate the required field(s) ${missing.map((m) => `${m.name} (${m.type})`).join(', ')}: the server will refuse this form. Write those fields by hand or wait for nested form support.`);
  if (!flat.length) console.error(`xoong: <xo-form op="${ref}">: the request body has no simple fields to generate (see docs/admin.md)`);
  for (const f of flat) {
    const wrap = document.createElement('label');
    wrap.className = 'xo-field';
    const text = document.createElement('span');
    text.textContent = f.title ?? label(f.name);
    let input;
    if (f.enum) {
      input = document.createElement('select');
      for (const v of f.required ? f.enum : ['', ...f.enum]) {
        const option = document.createElement('option');
        option.value = option.textContent = String(v);
        input.append(option);
      }
    } else {
      input = document.createElement('input');
      input.type = f.type === 'file' ? 'file' : f.type === 'boolean' ? 'checkbox' : f.type === 'integer' || f.type === 'number' ? 'number' : TYPES[f.format] ?? 'text';
      if (f.type === 'number') input.step = 'any';
      if (f.maxLength) input.maxLength = f.maxLength;
      if (input.type === 'text' || input.type === 'email') input.autocomplete = 'off';
    }
    input.name = f.name;
    if (f.required && f.type !== 'boolean') input.required = true;
    if (f.type === 'boolean') wrap.append(input, text); else wrap.append(text, input);
    form.append(wrap);
  }
  const button = document.createElement('button');
  button.className = 'xo-submit';
  button.textContent = el.getAttribute('submit') || 'Save';
  form.append(button);
  return form;
});
