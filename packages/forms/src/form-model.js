// @ts-check
/**
 * The form model (ADR-0009): a typed draft of a record, the baseline it came from, and derived state per path. No DOM here: the
 * binder in form-dom.js connects it to a <form>, and tests drive it directly.
 *
 *   const form = createForm({ schema, value: record, rules: { slug: (v, { record }) => taken(v) ? 'Already used' : '' } });
 *   form.set('title.en', 'Hello');          // a control's raw value, coerced by the schema
 *   form.field('title.en').error            // reactive: read it inside an effect or a template
 *   form.dirty, form.valid, form.errors['title.vi'], form.touched['title.vi'], form.filled['title.vi']
 *   await form.submit((body) => client.mutate('updateArticle', { id }, body));
 *
 * Per-path state lives in one signal per path that has been asked for, updated only when its own value changes, so an edit in one
 * field wakes the readers of that field (and its ancestors), not the other few hundred.
 */
import { signal, batch } from '@xoong/core/signals';
import { parsePath, pathKey, getAt, setAt, nodeAt, variant, coerce, defaults, validate } from './schema.js';

/** @typedef {import('./schema.js').Node} Node */

const clone = (v) => (v === undefined ? undefined : structuredClone(v));
/** Equality for "dirty": null and absent are the same (a cleared optional field is not a change from a record that never had it). */
const strip = (v) => {
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) if (x !== null && x !== undefined) o[k] = strip(x); return o; }
  return v;
};
const same = (a, b) => JSON.stringify(strip(a)) === JSON.stringify(strip(b));
const nothing = (v) => v === undefined || v === null || v === '';

/**
 * What is sent, and what "dirty" compares: the draft reduced to the request schema.
 *  - only properties of the schema are kept (ids, timestamps and other server-owned fields of the record drop out; read-only too);
 *  - an empty value follows `emptyAs` ("omit" by default, or "null"); an explicit null is kept for a nullable field;
 *  - `pruneEmpty` on an object removes its empty members, and an object left empty follows its own `emptyAs`;
 *  - a node of type `any` is kept as it is.
 * @param {Node | undefined} node @param {any} v
 */
export function normalize(node, v) {
  if (!node || node.t === 'any') return v;
  if (v === undefined) return undefined;
  const asEmpty = () => (node.emptyAs === 'null' ? null : undefined);
  if (v === null) return node.nullable ? null : asEmpty();
  if (node.t === 'union') { const picked = variant(node, v); return picked ? normalize(picked, v) : undefined; }
  if (node.t === 'object') {
    if (typeof v !== 'object' || Array.isArray(v)) return v;
    const out = {};
    for (const [k, child] of Object.entries(node.props ?? {})) {
      if (child.readOnly) continue;
      const n = normalize(child, v[k]);
      if (n !== undefined && !(node.pruneEmpty && (n === null ? !child.nullable : nothing(n) || (typeof n === 'object' && !Array.isArray(n) && !Object.keys(n).length)))) out[k] = n;
    }
    if (node.pruneEmpty && !Object.keys(out).length) return node.nullable && node.emptyAs !== 'omit' ? null : asEmpty();
    return out;
  }
  if (node.t === 'array') return Array.isArray(v) ? v.map((item) => normalize(node.items, item)) : v;
  if (v === '') return asEmpty();
  return v;
}

/** Is there something in the value after normalisation? (A filled-in field, for "missing translation" markers.) */
function isFilled(node, v) {
  const n = normalize(node, v);
  if (n === undefined || n === null || n === '') return false;
  if (Array.isArray(n)) return n.length > 0;
  if (typeof n === 'object') return Object.keys(n).length > 0;
  return true;
}

/**
 * @param {{ schema?: Node, value?: any, rules?: Record<string, Function>, serialize?: (draft: any, body: any) => any }} [options]
 *   `schema`: the request body node; `value`: the record to edit (the baseline); `rules`: custom rules by path; `serialize`: the escape hatch.
 */
export function createForm({ schema, value, rules = {}, serialize: serializeFn } = {}) {
  let baseline = clone(value ?? defaults(schema) ?? {});
  let draft = clone(baseline);
  /** @type {Record<string, string>} */ let errors = {};
  /** @type {Record<string, string>} */ let serverErrors = {};
  /** @type {Record<string, string>} */ let asyncErrors = {};
  const asyncToken = new Map();
  const touchedSet = new Set();
  /** @type {Map<string, { parts: (string|number)[], value: any, error: any, touched: any, dirty: any, filled: any }>} */
  const fields = new Map();
  const state = { value: signal(draft), dirty: signal(false), valid: signal(true), submitting: signal(false), pending: signal(0), stale: signal(false) };
  let currentRules = rules;

  // ---- rules ----------------------------------------------------------------------------------------------------------------

  /** The concrete paths a rule key applies to; `items[].title` covers every item. */
  function expand(key) {
    if (key === '*') return [[]];
    let out = [[]];
    for (const seg of key.replace(/\[\]/g, '.[]').split('.').filter(Boolean)) {
      const next = [];
      for (const base of out) {
        if (seg === '[]') { const arr = getAt(draft, base); if (Array.isArray(arr)) arr.forEach((_, i) => next.push([...base, i])); } else next.push([...base, ...parsePath(seg)]);
      }
      out = next;
    }
    return out;
  }

  /** Rule keys known to return promises (learned the first time they run): they are re-run only for the path that changed, never on every publish. */
  const asyncRules = new Set();

  /**
   * Run the custom rules. Synchronous ones always (they are cheap); asynchronous ones only for the paths in `only` (or all of them for
   * `'all'`), because running them again is a network call. Returns the synchronous messages; promises are collected in `collect`.
   * @param {Set<string> | 'all' | undefined} only @param {Promise<any>[]} [collect]
   */
  function runRules(only, collect) {
    /** @type {Record<string, string>} */ const sync = {};
    for (const [key, fn] of Object.entries(currentRules)) {
      for (const parts of expand(key)) {
        const k = pathKey(parts);
        if (asyncRules.has(key) && !(only === 'all' || (only && (key === '*' || only.has(k))))) continue;
        let result;
        try { result = key === '*' ? fn(draft) : fn(getAt(draft, parts), { record: draft, path: k, form }); } catch (e) { result = String(e?.message ?? e); }
        if (result && typeof result.then === 'function') { asyncRules.add(key); const p = settle(k, key === '*', result); collect?.push(p); }
        else if (key === '*') { if (result && typeof result === 'object') Object.assign(sync, result); } else if (result) sync[k] = String(result);
      }
    }
    return sync;
  }

  /** An async rule: the field is pending until it answers; an answer for an older value is ignored. */
  function settle(k, tree, promise) {
    const token = (asyncToken.get(k) ?? 0) + 1;
    asyncToken.set(k, token);
    state.pending.value += 1;
    return promise.then((r) => {
      if (asyncToken.get(k) !== token) return;
      if (tree && r && typeof r === 'object') Object.assign(asyncErrors, r);
      else if (r) asyncErrors[k] = String(r); else delete asyncErrors[k];
    }, (e) => { if (asyncToken.get(k) === token) asyncErrors[k] = String(e?.message ?? e); })
      .finally(() => { state.pending.value -= 1; publish(runRules(undefined)); });
  }

  // ---- derived state --------------------------------------------------------------------------------------------------------

  /** Schema errors first, then custom rules, then async answers, then what the server said. */
  function compute(syncRules) {
    return { ...serverErrors, ...asyncErrors, ...syncRules, ...validate(schema, draft) };
  }

  function dirtyAt(parts) {
    const node = nodeAt(schema, parts, draft);
    return !same(normalize(node, getAt(draft, parts)), normalize(node, getAt(baseline, parts)));
  }

  /** Recompute everything derived and push it to the signals whose value actually changed. */
  function publish(syncRules = runRules(undefined)) {
    errors = compute(syncRules);
    batch(() => {
      state.value.value = draft;
      state.dirty.value = !same(normalize(schema, draft), normalize(schema, baseline));
      state.valid.value = !Object.keys(errors).length && state.pending.peek() === 0;
      for (const [k, f] of fields) {
        f.value.value = getAt(draft, f.parts);
        f.error.value = errors[k] ?? '';
        f.touched.value = touchedSet.has(k);
        f.dirty.value = dirtyAt(f.parts);
        f.filled.value = isFilled(nodeAt(schema, f.parts, draft), getAt(draft, f.parts));
      }
    });
  }

  /** @param {string | (string|number)[]} path */
  function field(path) {
    const parts = typeof path === 'string' ? parsePath(path) : path;
    const k = pathKey(parts);
    let f = fields.get(k);
    if (!f) {
      const node = nodeAt(schema, parts, draft);
      f = { parts, value: signal(getAt(draft, parts)), error: signal(errors[k] ?? ''), touched: signal(touchedSet.has(k)), dirty: signal(dirtyAt(parts)), filled: signal(isFilled(node, getAt(draft, parts))) };
      fields.set(k, f);
    }
    const s = f;
    return {
      path: k,
      get node() { return nodeAt(schema, parts, draft); },
      get value() { return s.value.value; },
      get error() { return s.error.value; },
      get touched() { return s.touched.value; },
      get dirty() { return s.dirty.value; },
      get filled() { return s.filled.value; },
      get valid() { return s.error.value === ''; },
    };
  }

  /** `form.errors['title.vi']` style readers: each read tracks only that path. */
  const view = (prop, listKeys) => new Proxy({}, {
    get: (_, key) => (typeof key === 'string' && !key.startsWith('$') && key !== 'then' && key !== 'toJSON' ? field(key)[prop] : undefined),
    has: (_, key) => typeof key === 'string' && !!field(key)[prop],
    ownKeys: () => (listKeys ? listKeys() : []),
    getOwnPropertyDescriptor: (_, key) => (typeof key === 'string' && listKeys?.().includes(key) ? { enumerable: true, configurable: true, value: field(key)[prop] } : undefined),
  });

  // ---- the model -------------------------------------------------------------------------------------------------------------

  const form = {
    /** The record being edited, as a signal-backed value: `form.value` (read inside an effect to track it). */
    get value() { return state.value.value; },
    get baseline() { return baseline; },
    get dirty() { return state.dirty.value; },
    get valid() { return state.valid.value; },
    get submitting() { return state.submitting.value; },
    get pending() { return state.pending.value > 0; },
    /** True when the record changed underneath a dirty form (a live update): the draft is kept. */
    get stale() { return state.stale.value; },
    get rules() { return currentRules; },
    set rules(r) { currentRules = r ?? {}; publish(); },
    get serialize() { return serializeFn; },
    set serialize(fn) { serializeFn = fn; },
    field,
    errors: view('error', () => (state.value.value, Object.keys(errors))),
    touched: view('touched', () => [...touchedSet]),
    filled: view('filled', undefined),
    dirtyAt: view('dirty', undefined),

    /** Read the draft at a path. */
    get(path) { return getAt(draft, parsePath(path)); },

    /** A control's raw value (string or boolean) written into the draft, coerced to the schema's type; clears the server error of that path. */
    set(path, raw, { coerced = false } = {}) {
      const parts = parsePath(path);
      const k = pathKey(parts);
      const next = coerced ? raw : coerce(nodeAt(schema, parts, draft), raw);
      draft = setAt(draft, parts, next);
      delete serverErrors[k];
      delete asyncErrors[k];
      publish(runRules(new Set([k])));
      return next;
    },

    touch(path) { touchedSet.add(pathKey(parsePath(path))); publish(); },
    /** Mark every field and every field with an error as touched (what submit does, so all errors show). */
    touchAll() { for (const k of fields.keys()) touchedSet.add(k); for (const k of Object.keys(errors)) touchedSet.add(k); publish(); },

    /** Server field errors, by path ({ 'title.en': 'taken' }); each clears when that field is edited. */
    setServerErrors(map) { serverErrors = Object.fromEntries(Object.entries(map ?? {}).map(([k, v]) => [pathKey(parsePath(k)), v])); publish(); },

    /** Back to the baseline, untouched. */
    reset() { draft = clone(baseline); touchedSet.clear(); serverErrors = {}; asyncErrors = {}; state.stale.value = false; publish(); },
    /** The saved record becomes the baseline (after a successful save). The draft is replaced when a record is given. */
    markPristine(record) { if (record !== undefined) { baseline = clone(record); draft = clone(record); } else baseline = clone(draft); state.stale.value = false; publish(); },
    /** The record changed in the store: a pristine form follows it, a dirty one keeps the draft and becomes stale. */
    refresh(record) {
      if (same(record, baseline)) return;
      if (!state.dirty.peek()) { baseline = clone(record); draft = clone(record); publish(); } else state.stale.value = true;
    },

    /** The body that would be sent now. */
    body() {
      const body = normalize(schema, draft);
      return serializeFn ? serializeFn(draft, body) : body;
    },

    /** Run everything, wait for async rules, and return all errors by path (empty when valid). */
    async validate() {
      const collected = [];
      publish(runRules('all', collected));
      await Promise.allSettled(collected);
      publish();
      return { ...errors };
    },

    /**
     * Submit: touch everything, validate (async rules included), and when valid call `send(body)`. A thrown error with `fields` is shown on
     * those paths. Resolves `{ ok: true, result }` or `{ ok: false, errors, first }` (the first invalid path, in schema order).
     */
    async submit(send, { after } = {}) {
      form.touchAll();
      const found = await form.validate();
      const paths = Object.keys(found);
      if (paths.length) return { ok: false, errors: found, first: paths[0] };
      state.submitting.value = true;
      try {
        const result = await send(form.body());
        if (after) after(result); else form.markPristine(result && typeof result === 'object' && !Array.isArray(result) ? result : undefined);
        return { ok: true, result };
      } catch (e) {
        if (e && typeof e === 'object' && /** @type {any} */ (e).fields) form.setServerErrors(/** @type {any} */ (e).fields);
        throw e;
      } finally { state.submitting.value = false; }
    },
  };

  publish(runRules('all'));
  return form;
}
