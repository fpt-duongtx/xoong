// @ts-check
/**
 * The binder (ADR-0009): attaches a form model to a <form> element. Controls are found by their `name` path; the model is the
 * single source of truth and the DOM is a view of it.
 *
 *   DOM -> model   one delegated `input` / `change` listener per form (a form of 800 fields has two listeners, not 800)
 *   model -> DOM   one small effect per control: its value, its error, and attributes completed from the schema
 *   errors         shown on blur (touched) and on submit; `aria-invalid`, `aria-describedby`, a message element; the model decides,
 *                  never the browser (the form gets `novalidate`, so a hidden invalid control cannot block submit)
 *
 * Used by `xo-submit` (packages/data/src/view.js) for every operation that has a request schema.
 */
import { effect } from '@xoong/core/signals';
import { createForm } from './form-model.js';
import { parsePath, nodeAt, isRequired, defaults } from './schema.js';

/** @typedef {import('./schema.js').Node} Node */

const CONTROL = 'input,select,textarea';

/** Is it a custom control (an `XoControl`, or any form-associated element with a value)? */
const isCustom = (el) => el.localName.includes('-') && /** @type {any} */ (el.constructor).formAssociated === true;
const isControl = (el) => (el.matches?.(CONTROL) && el.type !== 'submit' && el.type !== 'button' && el.type !== 'reset' && el.type !== 'file') || isCustom(el);

/** ISO UTC string -> value of an <input type="datetime-local"> (local time, minutes). */
export function isoToLocal(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
/** Value of a datetime-local input (local time) -> ISO UTC string. */
export function localToIso(local) {
  const d = new Date(local);
  return local === '' || Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/** The text a control shows for a model value. */
const show = (v) => (v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/**
 * @param {HTMLFormElement} form
 * @param {{ schema: Node, record?: () => any, hadRecord?: boolean }} options
 *   `record`: the record being edited (called inside an effect, so a live update refreshes the model); none for a create form.
 */
export function attach(form, { schema, record, hadRecord = !!record }) {
  form.setAttribute('novalidate', ''); // the model validates; the browser must not block on controls it cannot focus
  const model = createForm({ schema, value: record?.() });
  /** @type {Map<Element, { name: string, stops: (() => void)[] }>} */
  const bound = new Map();
  let writing = /** @type {Element | null} */ (null);
  let errorSeq = 0;

  // ---- controls ---------------------------------------------------------------------------------------------------------

  /** Fill in only what the author left out; an attribute in the HTML always wins. */
  function complete(el, node, name) {
    const set = (attr, value) => { if (value !== undefined && value !== null && value !== false && !el.hasAttribute(attr)) el.setAttribute(attr, value === true ? '' : String(value)); };
    if (!node) return;
    if (el.tagName === 'INPUT') {
      if (!el.hasAttribute('type')) {
        const t = node.t === 'boolean' ? 'checkbox' : node.t === 'integer' || node.t === 'number' ? 'number'
          : node.format === 'email' ? 'email' : node.format === 'uri' || node.format === 'url' ? 'url' : node.format === 'password' ? 'password'
            : node.format === 'date' ? 'date' : node.format === 'date-time' ? 'datetime-local' : 'text';
        el.setAttribute('type', t);
      }
      if (node.t === 'integer') set('step', 1); else if (node.t === 'number') set('step', node.multipleOf ?? 'any');
      set('min', node.minimum ?? (node.exclusiveMinimum !== undefined ? node.exclusiveMinimum : undefined));
      set('max', node.maximum ?? (node.exclusiveMaximum !== undefined ? node.exclusiveMaximum : undefined));
    }
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      set('minlength', node.minLength); set('maxlength', node.maxLength);
      if (node.pattern && el.tagName === 'INPUT') set('pattern', node.pattern);
      set('placeholder', node.placeholder);
    }
    if (el.tagName === 'SELECT' && node.enum && !el.options.length) {
      const option = (text) => { const o = document.createElement('option'); o.value = o.textContent = text; return o; };
      if (!isRequired(schema, parsePath(name), model.value)) el.append(option(''));
      for (const v of node.enum) el.append(option(String(v)));
    }
    if (node.readOnly) set('readonly', true);
    if (isRequired(schema, parsePath(name), model.value) && node.t !== 'boolean') set('required', true);
    if (isCustom(el)) { // an open registry of widgets: any XoControl gets its schema node, its hints and the form model
      const hints = { ...(node.hints ?? {}), label: node.title, hint: node.description, placeholder: node.placeholder, order: node.order, group: node.group };
      Object.assign(el, { schema: node, hints, xoForm: model });
    }
  }

  function bind(el) {
    const name = el.getAttribute('name');
    if (!name) return;
    const prev = bound.get(el);
    if (prev) { if (prev.name === name) return; unbind(el); }
    const parts = parsePath(name);
    const node = nodeAt(schema, parts, model.value);
    complete(el, node, name);
    const field = model.field(name);
    const stops = [];
    // model -> DOM
    stops.push(effect(() => {
      const v = field.value;
      if (writing === el) return; // this control is where the change came from: do not rewrite what the person is typing
      write(el, v, nodeAt(schema, parts, model.value));
    }));
    // errors -> DOM, only once the field has been visited (or submit touched everything)
    stops.push(effect(() => showError(el, field.touched ? field.error : '')));
    bound.set(el, { name, stops });
  }

  function unbind(el) {
    const b = bound.get(el);
    if (!b) return;
    b.stops.forEach((s) => s());
    bound.delete(el);
    showError(el, '');
  }

  /** Model value -> control. */
  function write(el, v, node) {
    if (isCustom(el)) { if (JSON.stringify(el.value) !== JSON.stringify(v ?? '')) el.setValue(v ?? ''); return; }
    if (el.type === 'checkbox') { el.checked = v === true; return; }
    if (el.type === 'radio') { el.checked = show(v) === el.value; return; }
    if (el.tagName === 'SELECT' && el.multiple) { const set = new Set(Array.isArray(v) ? v.map(String) : []); for (const o of el.options) o.selected = set.has(o.value); return; }
    const text = el.type === 'datetime-local' ? (typeof v === 'string' ? isoToLocal(v) : '') : show(v);
    if (el.value !== text) el.value = text;
    void node;
  }

  /** The message of a field, as the browser's own validity, `aria-invalid` and a visible note. */
  function showError(el, message) {
    const note = /** @type {any} */ (el)._xoNote;
    if (!message) {
      note?.remove();
      /** @type {any} */ (el)._xoNote = undefined;
      el.removeAttribute?.('aria-invalid');
      const ids = (el.getAttribute?.('aria-describedby') ?? '').split(' ').filter((i) => i && i !== note?.id);
      if (ids.length) el.setAttribute('aria-describedby', ids.join(' ')); else el.removeAttribute?.('aria-describedby');
      el.setCustomValidity?.('');
      return;
    }
    let n = note;
    if (!n) {
      n = document.createElement('small');
      n.className = 'xo-error';
      n.dataset.xoError = '';
      n.id = `xo-err-${++errorSeq}-${Math.random().toString(36).slice(2, 6)}`;
      el.after(n);
      /** @type {any} */ (el)._xoNote = n;
      el.setAttribute('aria-describedby', [el.getAttribute('aria-describedby'), n.id].filter(Boolean).join(' '));
    }
    n.textContent = message;
    el.setAttribute('aria-invalid', 'true');
    el.setCustomValidity?.(message);
  }

  // ---- DOM -> model ---------------------------------------------------------------------------------------------------------

  const target = (e) => /** @type {Element | null} */ (e.target)?.closest?.('[name]');

  function onInput(e) {
    const el = target(e);
    if (!el || !isControl(el)) return;
    const name = el.getAttribute('name') ?? '';
    writing = el;
    try {
      if (isCustom(el)) model.set(name, /** @type {any} */ (el).value, { coerced: true });
      else if (el.type === 'checkbox') model.set(name, /** @type {HTMLInputElement} */ (el).checked);
      else if (el.type === 'radio') { if (/** @type {HTMLInputElement} */ (el).checked) model.set(name, /** @type {HTMLInputElement} */ (el).value); }
      else if (el.tagName === 'SELECT' && /** @type {HTMLSelectElement} */ (el).multiple) model.set(name, [...(/** @type {HTMLSelectElement} */ (el)).selectedOptions].map((o) => o.value), { coerced: true });
      else if (el.type === 'datetime-local') model.set(name, localToIso(/** @type {HTMLInputElement} */ (el).value), { coerced: false });
      else model.set(name, /** @type {HTMLInputElement} */ (el).value);
    } finally { writing = null; }
  }

  function onBlur(e) {
    const el = target(e);
    if (el && isControl(el) && el.getAttribute('name')) model.touch(/** @type {string} */ (el.getAttribute('name')));
  }

  form.addEventListener('input', onInput);
  form.addEventListener('change', onInput);
  form.addEventListener('focusout', onBlur);

  // Controls that appear later (xo-each rows, a revealed tab) and controls whose name changes (reordered rows).
  const scan = (root) => {
    for (const el of root.querySelectorAll?.('[name]') ?? []) if (isControl(el)) bind(el);
    if (root.matches?.('[name]') && isControl(root)) bind(root);
  };
  scan(form);
  const observer = typeof MutationObserver !== 'undefined' ? new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'attributes') { const el = /** @type {Element} */ (r.target); if (isControl(el)) { const b = bound.get(el); if (b && b.name !== el.getAttribute('name')) bind(el); else if (!b) bind(el); } continue; }
      for (const n of r.removedNodes) if (n.nodeType === 1) { for (const el of [...bound.keys()]) if (!form.contains(el)) unbind(el); }
      for (const n of r.addedNodes) if (n.nodeType === 1) scan(/** @type {Element} */ (n));
    }
  }) : null;
  observer?.observe(form, { childList: true, subtree: true, attributes: true, attributeFilter: ['name'] });

  // A dirty form announces itself (a router asks before the page is left), and says when it is clean again.
  const stopDirty = effect(() => form.dispatchEvent(new CustomEvent('xo-dirty', { bubbles: true, detail: { dirty: model.dirty } })));

  // ---- the record underneath: a live update refreshes a pristine form, a dirty one keeps its draft ----------------------------
  const stopRecord = record ? effect(() => { const r = record(); if (r !== undefined) model.refresh(r); }) : () => {};

  // ---- submit ------------------------------------------------------------------------------------------------------------------

  const controlFor = (path) => [...bound.entries()].find(([, b]) => parsePath(b.name).join('\u0000') === parsePath(path).join('\u0000'))?.[0];

  /** The first invalid path in the order controls appear on the page (hidden or not rendered ones come after, in model order). */
  function firstInvalid(errors) {
    const paths = Object.keys(errors);
    const ordered = [...form.querySelectorAll('[name]')].map((el) => el.getAttribute('name') ?? '').filter(Boolean);
    return ordered.find((n) => paths.some((p) => parsePath(p).join('\u0000') === parsePath(n).join('\u0000'))) ?? paths[0];
  }

  /**
   * The submit pipeline: touch all, validate, and when invalid ask the app to reveal the field (`xo-reveal`, cancelable) before focusing it.
   * @param {(body: any) => Promise<any>} send
   */
  async function submit(send) {
    const outcome = await model.submit(send, { after: hadRecord ? undefined : (form.hasAttribute('xo-keep') ? () => model.markPristine() : () => model.markPristine(defaults(schema) ?? {})) });
    if (outcome.ok) return outcome;
    const path = firstInvalid(outcome.errors);
    const ev = new CustomEvent('xo-reveal', { detail: { path }, bubbles: true, cancelable: true });
    const handled = !form.dispatchEvent(ev); // the app answers by switching a tab or selecting a block
    if (handled) await new Promise((r) => setTimeout(r, 30)); // let that render
    const el = controlFor(path);
    if (el) (/** @type {any} */ (el).focusTarget ?? el).focus?.();
    return { ...outcome, first: path };
  }

  function detach() {
    form.removeEventListener('input', onInput);
    form.removeEventListener('change', onInput);
    form.removeEventListener('focusout', onBlur);
    observer?.disconnect();
    stopRecord();
    stopDirty();
    form.dispatchEvent(new CustomEvent('xo-dirty', { bubbles: true, detail: { dirty: false } }));
    for (const el of [...bound.keys()]) unbind(el);
  }

  // `form.rules` and `form.serialize` are set on the element, as the docs say
  Object.defineProperties(form, {
    rules: { get: () => model.rules, set: (r) => { model.rules = r; }, configurable: true },
    serialize: { get: () => model.serialize, set: (fn) => { model.serialize = fn; }, configurable: true },
    model: { value: model, configurable: true },
  });

  return { model, submit, detach, rescan: () => scan(form) };
}
