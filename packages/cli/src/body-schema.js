// @ts-check
/**
 * OpenAPI request schema -> the compact node tree that forms use at runtime (`bodySchema` in operations.json; see
 * packages/data/src/schema.js for the node shapes and docs/decisions/0009-forms-from-the-api-schema.md).
 */

const refName = (r) => r.slice(r.lastIndexOf('/') + 1);
const PRIMITIVE = new Set(['string', 'integer', 'number', 'boolean']);
const MAX_DEPTH = 10;

/**
 * @param {any} schema the request body schema (maybe a $ref)
 * @param {Record<string, any>} schemas components.schemas
 * @param {{ fields?: Record<string, { label?: string, hint?: string, placeholder?: string, widget?: string, order?: number, readOnly?: boolean }> }} [hints]
 *   `fields`: presentation hints keyed "SchemaName.property" for specs that cannot be edited
 * @returns {any | undefined} an object node, or undefined when the body is not an object
 */
export function bodySchemaOf(schema, schemas, hints) {
  const n = convert(schema, schemas, hints, 0, undefined);
  return n && n.t === 'object' ? n : undefined;
}

/** Follow $ref chains; returns the schema and the name of the last named schema met. */
function deref(s, schemas, owner) {
  let name = owner;
  for (let i = 0; s?.$ref && i < 20; i++) { name = refName(s.$ref); s = schemas[name]; }
  return { s, name };
}

/** allOf: the union of properties and required lists, other keywords from the parts and the schema itself. */
function flatten(schema, schemas, owner, depth) {
  const { s, name } = deref(schema, schemas, owner);
  if (!s?.allOf) return { s, name };
  const merged = { ...s, properties: { ...(s.properties ?? {}) }, required: [...(s.required ?? [])] };
  delete merged.allOf;
  for (const part of s.allOf) {
    const f = depth < MAX_DEPTH ? flatten(part, schemas, name, depth + 1).s : undefined;
    if (!f) continue;
    for (const [k, v] of Object.entries(f)) if (k !== 'properties' && k !== 'required' && merged[k] === undefined) merged[k] = v;
    merged.properties = { ...(f.properties ?? {}), ...merged.properties };
    merged.required = [...new Set([...merged.required, ...(f.required ?? [])])];
  }
  return { s: merged, name };
}

function convert(schema, schemas, hints, depth, owner) {
  if (depth > MAX_DEPTH) return { t: 'any' };
  const { s, name } = flatten(schema, schemas, owner, depth);
  if (!s || typeof s !== 'object') return { t: 'any' };

  // oneOf / anyOf: [X, null] is a nullable X; several objects need a tag to be told apart
  const alternatives = s.oneOf ?? s.anyOf;
  if (alternatives) {
    const real = alternatives.filter((a) => deref(a, schemas).s?.type !== 'null');
    const nullable = real.length !== alternatives.length;
    if (real.length === 1) return decorate({ ...convert(real[0], schemas, hints, depth + 1, name), ...(nullable ? { nullable: true } : {}) }, s);
    const union = unionOf(s, real, schemas, hints, depth, name);
    return union ? decorate({ ...union, ...(nullable ? { nullable: true } : {}) }, s) : { t: 'any' };
  }

  let type = s.type;
  let nullable = s.nullable === true;
  if (Array.isArray(type)) { nullable = type.includes('null'); type = type.find((t) => t !== 'null'); }
  if (!type) type = s.properties ? 'object' : s.items ? 'array' : s.enum ? typeof s.enum[0] === 'number' ? 'number' : 'string' : undefined;

  /** @type {any} */ let node;
  if (type === 'object') {
    const props = {};
    for (const [prop, child] of Object.entries(s.properties ?? {})) {
      const n = convert(child, schemas, hints, depth + 1, name);
      props[prop] = applyHints(n, name ? hints?.fields?.[`${name}.${prop}`] : undefined);
    }
    if (!Object.keys(props).length) return { t: 'any', ...(nullable ? { nullable: true } : {}) }; // a free-form object (additionalProperties only)
    node = { t: 'object', props, ...(s.required?.length ? { required: [...s.required] } : {}) };
    if (name && hints?.schemas?.[name]) { // hints for a whole schema: pruneEmpty, emptyAs, and anything else a widget of that schema wants
      const { id: _id, entity: _entity, ...rest } = hints.schemas[name];
      node = applyHints(node, rest);
    }
  } else if (type === 'array') {
    node = { t: 'array', items: convert(s.items ?? {}, schemas, hints, depth + 1, name),
      ...(s.minItems != null ? { minItems: s.minItems } : {}), ...(s.maxItems != null ? { maxItems: s.maxItems } : {}), ...(s.uniqueItems ? { uniqueItems: true } : {}) };
  } else if (PRIMITIVE.has(type)) {
    node = { t: type };
    for (const k of ['format', 'enum', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf']) if (s[k] !== undefined) node[k] = s[k];
    if (type === 'string' && s.format === 'binary') node.format = 'binary';
    // OpenAPI 3.0 writes exclusiveMinimum as a boolean next to minimum
    if (s.exclusiveMinimum === true) { node.exclusiveMinimum = s.minimum; delete node.minimum; }
    if (s.exclusiveMaximum === true) { node.exclusiveMaximum = s.maximum; delete node.maximum; }
    if (node.exclusiveMinimum === false) delete node.exclusiveMinimum;
    if (node.exclusiveMaximum === false) delete node.exclusiveMaximum;
  } else {
    return { t: 'any' };
  }
  if (nullable) node.nullable = true;
  return decorate(node, s);
}

/** Presentation and server-owned flags that any node may carry. */
function decorate(node, s) {
  if (s.readOnly) node.readOnly = true;
  if (s.default !== undefined) node.default = s.default;
  if (s.title) node.title = s.title;
  if (s.description) node.description = s.description;
  if (s['x-xoong-widget']) node.widget = s['x-xoong-widget'];
  return node;
}

const KNOWN_HINTS = new Set(['label', 'hint', 'placeholder', 'widget', 'order', 'readOnly', 'hidden', 'group', 'emptyAs', 'pruneEmpty']);

/**
 * Hints from xoong.hints.json. `label` and `hint` become the node's title and description; the other keys xoong acts on keep their names;
 * every other key is passed through untouched in `node.hints`, for custom widgets (an open registry, ADR-0009).
 */
function applyHints(node, h) {
  if (!h) return node;
  const out = { ...node };
  if (h.label !== undefined) out.title = h.label;
  if (h.hint !== undefined) out.description = h.hint;
  for (const k of ['placeholder', 'widget', 'order', 'readOnly', 'hidden', 'group', 'emptyAs', 'pruneEmpty']) if (h[k] !== undefined) out[k] = h[k];
  const extra = Object.fromEntries(Object.entries(h).filter(([k]) => !KNOWN_HINTS.has(k)));
  if (Object.keys(extra).length) out.hints = { ...(out.hints ?? {}), ...extra };
  return out;
}

/** A union told apart by the discriminator, or by a property every member fixes to one value. */
function unionOf(s, members, schemas, hints, depth, owner) {
  const d = s.discriminator;
  const resolved = members.map((m) => flatten(m, schemas, owner, depth + 1));
  let key = d?.propertyName;
  /** @type {(string|number|boolean)[] | undefined} */ let values;
  if (key) {
    values = members.map((m) => {
      if (!m.$ref) return undefined;
      const mapped = Object.entries(d.mapping ?? {}).find(([, target]) => target === m.$ref || String(target).endsWith('/' + refName(m.$ref)));
      return mapped ? mapped[0] : refName(m.$ref);
    });
  } else {
    const single = (p) => (p && 'const' in p ? p.const : p?.enum?.length === 1 ? p.enum[0] : undefined);
    const keys = Object.keys(resolved[0]?.s?.properties ?? {});
    for (const k of keys) {
      const vs = resolved.map((r) => single(deref(r.s?.properties?.[k], schemas).s));
      if (vs.every((v) => v !== undefined) && new Set(vs).size === vs.length) { key = k; values = vs; break; }
    }
  }
  if (!key || !values || values.some((v) => v === undefined)) return undefined;
  const map = {};
  members.forEach((m, i) => { map[String(values[i])] = convert(m, schemas, hints, depth + 1, owner); });
  return { t: 'union', key, map };
}
