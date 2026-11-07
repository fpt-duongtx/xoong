// @ts-check
/**
 * The request schema model behind forms (ADR-0009). Pure functions, no DOM, no signals: everything here is testable in plain Node.
 *
 * A schema node is the JSON that `xoong sync` writes into `operations.json` as `bodySchema`:
 *   { t: 'string', format?, enum?, minLength?, maxLength?, pattern?, nullable?, readOnly?, default?, title?, description?, widget? }
 *   { t: 'integer' | 'number', minimum?, maximum?, exclusiveMinimum?, exclusiveMaximum?, multipleOf?, ... }
 *   { t: 'boolean' }
 *   { t: 'object', props: { name: node }, required?: string[] }
 *   { t: 'array', items: node, minItems?, maxItems?, uniqueItems? }
 *   { t: 'union', key: 'type', map: { value: node } }        a oneOf told apart by a property
 *   { t: 'any' }                                              anything we cannot describe: accepted as it is
 */

/** @typedef {{ t: string, [k: string]: any }} Node */

// ---- paths ----------------------------------------------------------------------------------------------------------------

/** "items[2].title" and "items.2.title" are the same path: ['items', 2, 'title']. */
export function parsePath(path) {
  const parts = [];
  for (const raw of String(path).replace(/\[(\d+)\]/g, '.$1').split('.')) {
    if (raw === '') continue;
    parts.push(/^\d+$/.test(raw) ? Number(raw) : raw);
  }
  return parts;
}

/** The canonical string of a path: ['items', 2, 'title'] -> "items[2].title". */
export function pathKey(parts) {
  return parts.map((p, i) => (typeof p === 'number' ? `[${p}]` : i ? `.${p}` : p)).join('');
}

/** Read a value at a path (undefined when any step is missing). */
export function getAt(value, parts) {
  let v = value;
  for (const p of parts) { if (v == null || typeof v !== 'object') return undefined; v = v[p]; }
  return v;
}

/** A copy of `value` with `next` written at the path (creating objects and arrays on the way; `undefined` deletes the key). */
export function setAt(value, parts, next) {
  if (!parts.length) return next;
  const [head, ...rest] = parts;
  const base = value != null && typeof value === 'object' ? value : typeof head === 'number' ? [] : {};
  const copy = Array.isArray(base) ? [...base] : { ...base };
  const child = setAt(copy[head], rest, next);
  if (child === undefined && !rest.length) { if (Array.isArray(copy)) copy[/** @type {number} */ (head)] = undefined; else delete copy[head]; } else copy[head] = child;
  return copy;
}

// ---- walking the schema ------------------------------------------------------------------------------------------------------

/**
 * The schema node for a path, or undefined. For a union the variant is chosen from `value` (the record at that level).
 * @param {Node | undefined} node @param {(string|number)[]} parts @param {any} [value]
 */
export function nodeAt(node, parts, value) {
  let cur = node;
  let val = value;
  for (const p of parts) {
    cur = variant(cur, val);
    if (!cur) return undefined;
    if (cur.t === 'object') cur = cur.props?.[p];
    else if (cur.t === 'array' && typeof p === 'number') cur = cur.items;
    else return undefined;
    val = val != null && typeof val === 'object' ? val[p] : undefined;
  }
  return cur;
}

/** The concrete node of a union for a value (or the node itself). */
export function variant(node, value) {
  if (!node || node.t !== 'union') return node;
  const tag = value != null && typeof value === 'object' ? value[node.key] : undefined;
  return tag !== undefined ? node.map?.[tag] : undefined;
}

// ---- values ---------------------------------------------------------------------------------------------------------------

/**
 * A control's raw value (a string, or a boolean for a checkbox) as the typed value the schema wants.
 * Empty text is "nothing entered": null for a nullable field, otherwise undefined (the key is left out).
 * @param {Node | undefined} node @param {any} raw
 */
export function coerce(node, raw) {
  if (!node) return raw;
  if (node.t === 'boolean') return raw === true || raw === 'true' || raw === 'on';
  if (raw === '' || raw === undefined || raw === null) return node.nullable || raw === null ? null : undefined;
  if (node.t === 'integer' || node.t === 'number') { const n = Number(raw); return Number.isNaN(n) ? raw : n; } // a bad number stays text and fails validation
  return raw;
}

/** The value a new record starts from: explicit defaults, and `{}` for required nested objects. */
export function defaults(node) {
  if (!node) return undefined;
  if (node.default !== undefined) return structuredClone(node.default);
  if (node.t === 'object') {
    const out = {};
    for (const [k, child] of Object.entries(node.props ?? {})) {
      const d = defaults(child);
      if (d !== undefined && (child.default !== undefined || (node.required ?? []).includes(k))) out[k] = d;
    }
    return out;
  }
  if (node.t === 'array' && (node.minItems ?? 0) > 0) return [];
  return undefined;
}

// ---- messages -------------------------------------------------------------------------------------------------------------

/** The default (English) messages. Replace any of them, for any language, with `setMessages({ required: () => '...' })`. */
const catalogue = {
  required: () => 'Please fill in this field.',
  type: ({ type }) => (type === 'integer' ? 'Enter a whole number.' : type === 'number' ? 'Enter a number.' : 'This value is not valid.'),
  minimum: ({ min }) => `Must be at least ${min}.`,
  maximum: ({ max }) => `Must be at most ${max}.`,
  exclusiveMinimum: ({ min }) => `Must be greater than ${min}.`,
  exclusiveMaximum: ({ max }) => `Must be less than ${max}.`,
  multipleOf: ({ step }) => `Must be a multiple of ${step}.`,
  minLength: ({ min }) => `Use at least ${min} characters.`,
  maxLength: ({ max }) => `Use at most ${max} characters.`,
  pattern: () => 'This does not match the expected format.',
  format: ({ format }) => ({ email: 'Enter a valid email address.', uri: 'Enter a valid URL.', url: 'Enter a valid URL.', uuid: 'Enter a valid ID.', date: 'Enter a valid date.', 'date-time': 'Enter a valid date and time.' }[format] ?? 'This value is not valid.'),
  enum: () => 'Choose one of the listed values.',
  minItems: ({ min }) => `Add at least ${min}.`,
  maxItems: ({ max }) => `Add at most ${max}.`,
  uniqueItems: () => 'Items must be different from each other.',
  variant: () => 'Choose a type.',
};
/** @type {Record<string, (params: any) => string>} */
let messages = { ...catalogue };

/** Replace some messages (for another language, or your own wording). Each receives its parameters, for example `{ min: 3 }`. */
export function setMessages(partial) { messages = { ...messages, ...partial }; }
/** Back to the built-in English messages. */
export function resetMessages() { messages = { ...catalogue }; }
/** The message for a rule code. */
export function message(code, params = {}) { return (messages[code] ?? catalogue.type)(params); }

// ---- validation -----------------------------------------------------------------------------------------------------------

const FORMATS = {
  email: (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),
  uri: (s) => { try { new URL(s); return true; } catch { return false; } },
  url: (s) => { try { new URL(s); return true; } catch { return false; } },
  uuid: (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s),
  date: (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)),
  'date-time': (s) => /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s) && !Number.isNaN(Date.parse(s)),
};

const isEmpty = (v) => v === undefined || v === null || v === '';

/**
 * The first rule a single value breaks, as a message, or '' when it is fine. `required` is decided by the parent (see validate).
 * @param {Node} node @param {any} value
 */
export function checkValue(node, value) {
  if (value === undefined || value === null) return '';
  switch (node.t) {
    case 'string': {
      if (typeof value !== 'string') return message('type', { type: 'string' });
      if (node.enum && !node.enum.includes(value)) return message('enum');
      if (node.minLength != null && value.length < node.minLength) return message('minLength', { min: node.minLength });
      if (node.maxLength != null && value.length > node.maxLength) return message('maxLength', { max: node.maxLength });
      if (node.pattern) { try { if (!new RegExp(node.pattern, 'u').test(value)) return message('pattern', { pattern: node.pattern }); } catch { /* a pattern JavaScript cannot read: do not block the form */ } }
      if (node.format && FORMATS[node.format] && !FORMATS[node.format](value)) return message('format', { format: node.format });
      return '';
    }
    case 'integer':
    case 'number': {
      if (typeof value !== 'number' || Number.isNaN(value) || (node.t === 'integer' && !Number.isInteger(value))) return message('type', { type: node.t });
      if (node.enum && !node.enum.includes(value)) return message('enum');
      if (node.minimum != null && value < node.minimum) return message('minimum', { min: node.minimum });
      if (node.maximum != null && value > node.maximum) return message('maximum', { max: node.maximum });
      if (node.exclusiveMinimum != null && value <= node.exclusiveMinimum) return message('exclusiveMinimum', { min: node.exclusiveMinimum });
      if (node.exclusiveMaximum != null && value >= node.exclusiveMaximum) return message('exclusiveMaximum', { max: node.exclusiveMaximum });
      if (node.multipleOf) { const q = value / node.multipleOf; if (Math.abs(q - Math.round(q)) > 1e-9) return message('multipleOf', { step: node.multipleOf }); }
      return '';
    }
    default:
      return '';
  }
}

/**
 * Every error in a record, by canonical path: { 'title.en': 'message', 'tags[1]': 'message' }. Empty object when valid.
 * Read-only properties are not checked (the server owns them). Unknown properties are accepted.
 * @param {Node | undefined} node @param {any} value @param {(string|number)[]} [at]
 * @returns {Record<string, string>}
 */
export function validate(node, value, at = []) {
  /** @type {Record<string, string>} */
  const errors = {};
  walk(node, value, at, errors);
  return errors;
}

function walk(node, value, at, errors) {
  if (!node || node.readOnly) return;
  const key = pathKey(at);
  if (node.t === 'union') {
    const picked = variant(node, value);
    if (!picked) { if (value != null) errors[pathKey([...at, node.key])] = message('variant'); return; }
    walk(picked, value, at, errors);
    return;
  }
  if (node.t === 'object') {
    if (value == null) return;
    if (typeof value !== 'object' || Array.isArray(value)) { errors[key] = message('type', { type: 'object' }); return; }
    for (const [name, child] of Object.entries(node.props ?? {})) {
      const v = value[name];
      if ((node.required ?? []).includes(name) && !child.readOnly && isEmpty(v)) {
        if (v === null && child.nullable) continue; // an explicit null is a value for a nullable field
        errors[pathKey([...at, name])] = message('required');
        continue;
      }
      walk(child, v, [...at, name], errors);
    }
    return;
  }
  if (node.t === 'array') {
    if (value == null) return;
    if (!Array.isArray(value)) { errors[key] = message('type', { type: 'array' }); return; }
    if (node.minItems != null && value.length < node.minItems) errors[key] = message('minItems', { min: node.minItems });
    else if (node.maxItems != null && value.length > node.maxItems) errors[key] = message('maxItems', { max: node.maxItems });
    else if (node.uniqueItems && new Set(value.map((x) => JSON.stringify(x))).size !== value.length) errors[key] = message('uniqueItems');
    value.forEach((item, i) => walk(node.items, item, [...at, i], errors));
    return;
  }
  const problem = checkValue(node, value);
  if (problem) errors[key] = problem;
}

/** Is a path required? (Its parent object lists it as required.) */
export function isRequired(root, parts, value) {
  if (!parts.length) return false;
  const parent = nodeAt(root, parts.slice(0, -1), value);
  const p = variant(parent, getAt(value, parts.slice(0, -1)));
  return !!p && p.t === 'object' && (p.required ?? []).includes(parts.at(-1));
}
