// @ts-check
/**
 * Actions: `xo-click` and `xo-submit` call an operation, with what they carry (`xo-body`, `xo-with`, `xo-optimistic`, `xo-selected`), the question first (`xo-confirm`),
 * the notice and the next page after (`xo-notice`, `xo-then`), and the events (`xo-done`, `xo-error`, `xo-invalid`).
 */
import { XoongError } from './client.js';
import { isRef, idOf } from './store.js';
import { parseInterpolation, evalParts } from './scope.js';
import { ownPage } from './safe-url.js';

/** The forms package registers its binder here: any `xo-submit` form whose operation has a request schema then uses the form model. */
let formEngine = /** @type {{ attach: Function } | null} */ (null);
/** @param {{ attach: Function }} engine */
export function setFormEngine(engine) { formEngine = engine; }

/** Ask before a destructive action (`xo-confirm="Delete {name}?"`). The default is the browser's confirm(); @xoong/ui replaces it with a native <dialog>. */
let confirmFn = /** @type {(message: string, context?: { kind: 'action' | 'leave', element?: Element, forms?: Element[] }) => boolean | Promise<boolean>} */ ((message) => (typeof globalThis.confirm === 'function' ? globalThis.confirm(message) : true));
/**
 * Replace the confirmation dialog (for `xo-confirm` and for leaving a page with unsaved changes) with your own: return, or resolve to, true to go on.
 * The second argument says what is being asked: `{ kind: 'action', element }` or `{ kind: 'leave', forms }`.
 * @param {(message: string, context?: { kind: 'action' | 'leave', element?: Element, forms?: Element[] }) => boolean | Promise<boolean>} fn
 */
export function setConfirm(fn) { confirmFn = fn; }
/** Ask the person a yes/no question with whatever confirm is installed. */
export const ask = (message, context) => Promise.resolve(confirmFn(message, context));

/** What a form's call returns when the form is invalid and nothing was sent. */
const INVALID = { invalid: true, errors: {} };

/**
 * A <form xo-submit> whose operation has a request schema gets the form model (ADR-0009): prefill, typed values, validation, dirty tracking.
 * It is attached when the form is bound, not at the first click, so fields are filled and completed before anyone touches the form.
 * @returns the engine, or null (a button, a form without a schema, or no forms package)
 */
function attachFormEngine(el, eventName, opRef, scope, ctx, disposers) {
  if (eventName !== 'submit' || !formEngine) return null;
  const { client, lookup } = ctx;
  let op0 = null;
  try { op0 = client.op(opRef); } catch { /* reported when the form is submitted */ }
  if (!op0?.bodySchema) return null;
  const bodyPath = el.getAttribute('xo-body');
  // An edit form (the operation has path parameters, is a PUT or PATCH, or xo-body names a record) starts from that record; a create form starts empty.
  const edits = !!bodyPath || /\{[^}]+\}/.test(op0.path) || op0.method === 'PUT' || op0.method === 'PATCH';
  const record = edits ? () => { const plain = client.store.denormalize(lookup(scope, bodyPath ?? '.')); return plain && typeof plain === 'object' ? plain : undefined; } : undefined;
  const engine = formEngine.attach(el, { schema: op0.bodySchema, record, hadRecord: edits });
  disposers.push(() => engine.detach());
  return engine;
}

/** One call of an action's operation, with the params and body taken from `sc` (the button's scope, or one selected row). */
async function callOnce(a, sc) {
  const { el, eventName, ref, op, engine, ctx } = a;
  const { client, lookup, host } = ctx;
  const params = {};
  for (const m of op.path.matchAll(/\{([^}]+)\}/g)) params[m[1]] = lookup(sc, m[1]);
  for (const q of op.query ?? []) { const v = lookup(sc, q); if (v !== undefined) params[q] = v; }
  let body;
  if (engine && op.body === true) { // the model validates, normalises and sends; an invalid form sends nothing
    const out = await engine.submit((b) => client.mutate(ref, params, b, { optimistic: optimisticOf(el, sc, ctx) }));
    if (!out.ok) { INVALID.errors = out.errors; return INVALID; }
    return out.result;
  }
  if (eventName === 'submit' && op.body === true) body = formBody(/** @type {HTMLFormElement} */ (el), op);
  else if (el.hasAttribute('xo-body')) body = client.store.denormalize(lookup(sc, el.getAttribute('xo-body')));
  const extra = withOf(el, sc, ctx, op);
  const idsField = el.getAttribute('xo-selected'); // "ids": one request carrying the ticked ids, instead of one request per row
  if (idsField) body = { ...(body ?? {}), ...extra, [idsField]: host.selectedRefs().map((r) => selectedId(client, r)) };
  else if (extra) body = { ...(body ?? {}), ...extra };
  if (op.stream) {
    const abort = host.beginStream();
    try { await host.consume(client.stream(ref, params, body, { signal: abort })); } catch (e) { if (abort.aborted) return undefined; throw e; } // view gone: stop quietly
    finally { if (!abort.aborted) client.invalidateAll(); } // the stream may have changed data that is on screen, even if it failed halfway
    return undefined;
  }
  return client.mutate(ref, params, body, { optimistic: optimisticOf(el, sc, ctx) });
}

/** What follows a call that worked: the form starts empty again, `xo-done`, the next page (`xo-then`) and the notice. `noticeText` was read before the selection was cleared. */
function afterSuccess(el, eventName, engine, result, noticeText, scope, ctx, emit) {
  if (!engine && eventName === 'submit' && !el.hasAttribute('xo-keep')) /** @type {HTMLFormElement} */ (el).reset?.(); // a sent form starts empty again
  emit('xo-done', result);
  const then = el.getAttribute('xo-then'); // go on to another page: `{field}` comes from the result (a created record), then from the item acted on
  if (then !== null) {
    const resultScope = { value: () => (Array.isArray(result) ? undefined : result), parent: scope };
    const path = evalParts(parseInterpolation(then) ?? [then], resultScope, ctx.lookup);
    if (!ownPage(path)) console.error(`xoong: xo-then goes to this site only, not to "${path}"`);
    else if (el.dispatchEvent(new CustomEvent('xo-go', { bubbles: true, cancelable: true, detail: { path } }))) location.assign(path); // <xo-router> handles it and cancels the default
  }
  if (noticeText) emit('xo-notice', { message: noticeText, kind: 'success' }); // shown by <xo-toast>
}

export function bindAction(el, eventName, opRef, scope, ctx, disposers) {
  const { client, lookup, host } = ctx;
  let busy = false;
  // The events come from the element that ran the action, so they bubble through a dialog or panel around it up to the view (and the page).
  // An element the result just removed (a deleted row) cannot bubble: the view reports for it.
  const emit = (name, detail) => (el.isConnected ? el : host).dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true, cancelable: true })); // xo-error can be prevented: the screen handled it
  const engine = attachFormEngine(el, eventName, opRef, scope, ctx, disposers);
  const handler = async (event) => {
    if (eventName === 'submit') event.preventDefault();
    if (busy) return;
    const confirmText = el.getAttribute('xo-confirm'); // ask first; {path} names the item ("Delete {title}?")
    if (confirmText !== null && !(await ask(evalParts(parseInterpolation(confirmText) ?? [confirmText], scope, lookup), { kind: 'action', element: el }))) return;
    busy = true;
    el.setAttribute('aria-busy', 'true');
    try {
      const call = { el, eventName, ref: opRef, op: client.op(opRef), engine, ctx };
      if (!engine) clearFieldErrors(el);
      else el.querySelectorAll?.('[data-xo-summary]').forEach((n) => n.remove()); // the last failure's summary: this is a new attempt
      // xo-selected: the same operation once for every ticked row (sequentially; the first failure stops the rest).
      const bulk = el.hasAttribute('xo-selected');
      const oneRequest = !!el.getAttribute('xo-selected');
      const targets = bulk && !oneRequest ? host.selectedRefs().map((r) => ({ value: () => r, parent: scope })) : [scope];
      if (!targets.length || (oneRequest && !host.selectedRefs().length)) return;
      const results = [];
      for (const sc of targets) results.push(await callOnce(call, sc));
      const notice = el.getAttribute('xo-notice'); // evaluated before the selection is cleared, so {$selectedCount} still counts
      const noticeText = notice === null ? null : evalParts(parseInterpolation(notice) ?? [notice], scope, lookup);
      if (bulk) host.clearSelection();
      if (results[0] === INVALID) { emit('xo-invalid', { errors: INVALID.errors }); return; } // nothing was sent; the form showed why
      afterSuccess(el, eventName, engine, bulk ? results : results[0], noticeText, scope, ctx, emit);
    } catch (e) {
      // API failures are expected flows (events + global onError). Anything else is a bug in the screen.
      if (!(e instanceof XoongError)) console.error(e);
      else if (engine) { if (!Object.keys(e.fields ?? {}).length) showFieldErrors(el, {}, e.detail ?? e.message); } // field messages are on the paths; others as a summary
      else showFieldErrors(el, e.fields, e.detail ?? e.message);
      emit('xo-error', e);
    } finally {
      busy = false;
      el.removeAttribute('aria-busy');
    }
  };
  el.addEventListener(eventName, handler);
  disposers.push(() => el.removeEventListener(eventName, handler));
  return engine;
}

/** The JSON body of a form. With `bodyFields` from the API document, values get their real types. */
function formBody(form, op) {
  const raw = new FormData(form);
  if (op.multipart) { // files stay files; the client sends it as multipart/form-data
    for (const [name, value] of [...raw]) if (typeof value !== 'string' && !value.name && !value.size) raw.delete(name); // no file chosen
    return raw;
  }
  const body = {};
  const types = new Map((op.bodyFields ?? []).map((f) => [f.name, f.type]));
  for (const [name, value] of raw) {
    if (typeof value !== 'string') continue;
    const type = types.get(name);
    if (type === 'integer' || type === 'number') { if (value !== '') body[name] = Number(value); }
    else if (type === 'boolean') body[name] = true; // an unchecked checkbox is not in FormData
    else if (type && value === '' && !op.bodyFields.find((f) => f.name === name)?.required) continue; // optional and empty: omit
    else body[name] = value;
  }
  for (const [name, type] of types) if (type === 'boolean' && !(name in body)) body[name] = false;
  return body;
}

function clearFieldErrors(form) {
  if (form.localName !== 'form') return;
  form.querySelectorAll('[data-xo-error]').forEach((n) => n.remove());
  form.querySelectorAll('[aria-invalid]').forEach((n) => { n.removeAttribute('aria-invalid'); n.removeAttribute('aria-describedby'); });
}

/** Mark each named field invalid and put the server's message next to it; with no field to blame, show it under the form. */
function showFieldErrors(form, fields = {}, summary = '') {
  if (form.localName !== 'form') return;
  const note = (message, role) => {
    const el = document.createElement('small');
    el.className = 'xo-error';
    el.dataset.xoError = '';
    el.textContent = message;
    if (role) el.setAttribute('role', role);
    return el;
  };
  let placed = 0;
  for (const [name, message] of Object.entries(fields)) {
    const input = [...form.elements].find((f) => f.name === name);
    if (!input) continue;
    const el = note(message);
    el.id = `xo-err-${name}-${Math.random().toString(36).slice(2, 7)}`;
    input.after(el);
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', el.id);
    placed++;
  }
  const unplaced = Object.entries(fields).filter(([name]) => ![...form.elements].some((f) => f.name === name));
  const summarize = (message) => { const n = note(message, 'alert'); n.dataset.xoSummary = ''; form.append(n); };
  if (!placed && summary) summarize(summary);
  else if (unplaced.length) summarize(unplaced.map(([name, message]) => `${name}: ${message}`).join('; ')); // no input for these
}

/** `xo-optimistic="status=disabled,note={text}"` -> [{ $ref, patch }] for the current item, or undefined. */
function optimisticOf(el, scope, ctx) {
  const spec = el.getAttribute('xo-optimistic');
  if (!spec) return undefined;
  const ref = scope.value();
  if (!isRef(ref)) { console.error('xoong: xo-optimistic needs a stored entity as the current item (put the button inside xo-each over entities)'); return undefined; }
  const patch = {};
  for (const pair of spec.split(',')) {
    const m = /^\s*([\w.-]+)\s*=\s*(.*?)\s*$/.exec(pair);
    if (m) patch[m[1]] = evalParts(parseInterpolation(m[2]) ?? [m[2]], scope, ctx.lookup);
  }
  return Object.keys(patch).length ? [{ $ref: ref.$ref, patch }] : undefined;
}

/** The id of a ticked row as the API knows it (a number stays a number; a composite id is joined), not the "User#5" store key. */
function selectedId(client, ref) {
  const key = ref.$ref;
  const def = client.store.defs[key.slice(0, key.indexOf('#'))];
  const record = client.store.read(key);
  return def && record ? idOf(def.id, record) ?? key.slice(key.indexOf('#') + 1) : key.slice(key.indexOf('#') + 1);
}

/** `xo-with="status=published,reason={why}"` -> { status: 'published', reason: ... }: fixed fields added to the request body. */
export function withOf(el, scope, ctx, op) {
  const spec = el.getAttribute('xo-with');
  if (!spec) return undefined;
  const types = new Map((op.bodyFields ?? []).map((f) => [f.name, f.type]));
  const out = {};
  for (const pair of spec.split(',')) {
    const m = /^\s*([\w.-]+)\s*=\s*(.*?)\s*$/.exec(pair);
    if (!m) continue;
    const text = evalParts(parseInterpolation(m[2]) ?? [m[2]], scope, ctx.lookup);
    const type = types.get(m[1]);
    out[m[1]] = type === 'integer' || type === 'number' ? Number(text) : type === 'boolean' ? text === 'true' : text;
  }
  return out;
}
