// @ts-check
/**
 * OpenAPI 3.x (JSON) -> xoong tables.
 * Produces:
 *   operations.json : { operations, entities }   (consumed by @xoong/data at runtime)
 *   api.d.ts        : TypeScript types for schemas and operations
 *   problems        : findings for `xoong doctor`
 */

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const MAX_DEPTH = 60; // schemas nest far less than this; deeper means a cycle
const refName = (ref) => {
  const seg = ref.slice(ref.lastIndexOf('/') + 1);
  try { return decodeURIComponent(seg).replace(/~1/g, '/').replace(/~0/g, '~'); } catch { return seg; }
};

/** Resolve a local "#/a/b" pointer in `doc`; undefined when it does not exist. */
function resolvePointer(doc, ref) {
  let node = doc;
  for (const raw of ref.slice(2).split('/')) {
    let seg = raw;
    try { seg = decodeURIComponent(raw); } catch { /* keep raw */ }
    seg = seg.replace(/~1/g, '/').replace(/~0/g, '~');
    if (node == null || typeof node !== 'object' || !Object.hasOwn(node, seg)) return undefined;
    node = node[seg];
  }
  return node;
}

/** Every distinct `$ref` string in the document (iterative: specs can be deeply nested). */
function collectRefs(doc) {
  const refs = new Set();
  const seen = new Set(); // YAML anchors make shared (even cyclic) objects: visit each once
  const stack = [doc];
  while (stack.length) {
    const n = stack.pop();
    if (seen.has(n)) continue;
    seen.add(n);
    if (Array.isArray(n)) { for (const x of n) if (x && typeof x === 'object') stack.push(x); continue; }
    for (const [k, v] of Object.entries(n)) {
      if (k === '$ref' && typeof v === 'string') refs.add(v);
      else if (v && typeof v === 'object') stack.push(v);
    }
  }
  return refs;
}

/**
 * @param {any} doc
 * @param {{ hints?: { idNames?: string[], schemas?: Record<string, { id?: string, entity?: string }>, unwrap?: string, idempotencyKeys?: Record<string, string> } }} [options]
 *   `hints` lets the frontend declare identity without editing the backend's document:
 *   { "idNames": ["id", "gid"],                     // any schema with one of these properties is an entity
 *     "schemas": { "SessionResponse": { "entity": "Session", "id": "session_id" } },
 *     "unwrap": "data",                              // responses shaped { code, message, data } are read as `data`
 *     "idempotencyKeys": { "sendMessage": "client_message_id" } }   // a fresh UUID is filled in per call
 */
export function analyze(doc, { hints } = {}) {
  if (doc && typeof doc === 'object' && String(doc.swagger ?? '').startsWith('2')) {
    throw new Error('xoong: Swagger 2.0 is not supported yet. Convert it first: npx swagger2openapi <file> --outfile openapi3.json');
  }
  if (!doc || typeof doc !== 'object' || !String(doc.openapi ?? '').startsWith('3')) {
    throw new Error('xoong: expected an OpenAPI 3.x document (field "openapi" starting with "3")');
  }
  const schemas = { ...(doc.components?.schemas ?? {}) }; // a copy: hints must not modify the caller's document
  for (const [name, h] of Object.entries(hints?.schemas ?? {})) {
    if (!schemas[name]) throw new Error(`xoong: hints refer to unknown schema "${name}"`);
    schemas[name] = { ...schemas[name], ...(h.id ? { 'x-xoong-id': h.id } : {}), ...(h.entity ? { 'x-xoong-entity': h.entity } : {}) };
  }
  /** @type {{level:'error'|'warn', code:string, where:string, message:string, fix:string}[]} */
  const problems = [];
  if (!doc.paths && !doc.webhooks) {
    problems.push({ level: 'error', code: 'XO100', where: '#/paths', message: 'the document has no "paths"', fix: 'Add a paths object (OpenAPI requires it unless the document only declares webhooks/components)' });
  }
  const missing = [];
  for (const ref of collectRefs(doc)) {
    if (!ref.startsWith('#/')) problems.push({ level: 'warn', code: 'XO151', where: ref, message: 'external $ref is not resolved by xoong', fix: 'Bundle the document so all references are local (for example with redocly bundle)' });
    else if (resolvePointer(doc, ref) === undefined) missing.push(ref);
  }
  for (const ref of missing) problems.push({ level: 'error', code: 'XO150', where: ref, message: `$ref points to something that does not exist`, fix: 'Define the target or remove the reference' });
  const resolve = (s) => (s?.$ref ? schemas[refName(s.$ref)] : s);

  // --- entity detection: component schemas with an identity property
  /** schema name -> id property; schema name -> entity name (several schemas may be one entity) */
  /** @type {Record<string, string>} */
  const idKeys = {};
  /** @type {Record<string, string>} */
  const entityOf = {};
  for (const [name, schema] of Object.entries(schemas)) {
    const props = collectProps(schema, schemas);
    const explicit = schema['x-xoong-id'];
    if (explicit) {
      if (props[explicit]) { idKeys[name] = explicit; entityOf[name] = schema['x-xoong-entity'] ?? name; }
      else problems.push({ level: 'error', code: 'XO101', where: `#/components/schemas/${name}`, message: `x-xoong-id "${explicit}" is not a property of ${name}`, fix: 'Name an existing property or remove x-xoong-id' });
    } else {
      // Conventional identity: `id`, or the first property named in hints.idNames (for example "gid" or "pk").
      const key = ['id', ...(hints?.idNames ?? [])].find((k) => props[k]);
      if (key) { idKeys[name] = key; entityOf[name] = schema['x-xoong-entity'] ?? name; }
    }
  }

  const isScalarSchema = (s) => !!s && !s.$ref && !s.properties && !s.allOf && !s.oneOf && !s.anyOf && (['string', 'integer', 'number', 'boolean', 'null'].includes(s.type) || (Array.isArray(s.type) && s.type.every((t) => ['string', 'integer', 'number', 'boolean', 'null'].includes(t))));
  const single = (p) => (p && 'const' in p ? p.const : p?.enum?.length === 1 ? p.enum[0] : undefined);
  /**
   * How to tell the members of a oneOf/anyOf apart: the OpenAPI `discriminator`, or a property that
   * every member declares with one fixed value (`type: "file"`, Stripe's `object: "customer"`).
   * Returns { key, values[] } aligned with `members`, or null.
   */
  const unionTag = (schema, members) => {
    const d = schema.discriminator;
    if (d?.propertyName) {
      const values = members.map((m) => {
        if (!m.$ref) return undefined;
        const mapped = Object.entries(d.mapping ?? {}).find(([, target]) => target === m.$ref || String(target).endsWith('/' + refName(m.$ref)));
        return mapped ? mapped[0] : refName(m.$ref);
      });
      return values.every((v) => v !== undefined) ? { key: d.propertyName, values } : null;
    }
    const propsOf = members.map((m) => collectProps(m, schemas));
    const fixed = (p, key) => single(p[key] && (p[key].$ref ? schemas[refName(p[key].$ref)] : p[key]));
    // 1) a property every member fixes to a different value
    for (const key of Object.keys(propsOf[0] ?? {})) {
      const values = propsOf.map((p) => fixed(p, key));
      if (values.every((v) => v !== undefined) && new Set(values).size === values.length) return { key, values };
    }
    // 2) a property that all but one member fixes (Stripe: `deleted: true` marks deleted_customer; plain customer lacks it)
    const keys = new Set(propsOf.flatMap((p) => Object.keys(p)));
    for (const key of keys) {
      const values = propsOf.map((p) => fixed(p, key));
      const untagged = values.map((v, i) => (v === undefined ? i : -1)).filter((i) => i >= 0);
      const tagged = values.filter((v) => v !== undefined);
      if (untagged.length === 1 && new Set(tagged).size === tagged.length) return { key, values, fallback: untagged[0] };
    }
    return null;
  };

  /** Names of the members of the first oneOf/anyOf of 2+ entities found in a response that xoong cannot tell apart (looking through refs, arrays and properties). */
  const unresolvedUnion = (schema, seen = new Set(), depth = 0) => {
    if (!schema || depth > 5) return undefined;
    if (schema.$ref) {
      const n = refName(schema.$ref);
      if (seen.has(n)) return undefined;
      return unresolvedUnion(schemas[n], new Set(seen).add(n), depth + 1);
    }
    const alt = (schema.oneOf ?? schema.anyOf)?.filter((s) => !isScalarSchema(s));
    const entities = alt?.filter((s) => s.$ref && idKeys[refName(s.$ref)]) ?? [];
    if (entities.length > 1 && !describe(schema)) return entities.map((s) => refName(s.$ref));
    for (const child of [schema.items, ...(schema.allOf ?? []), ...Object.values(schema.properties ?? {})]) {
      const found = unresolvedUnion(child, seen, depth + 1);
      if (found) return found;
    }
    return undefined;
  };

  /** Schema -> runtime descriptor (null when it contains no entities). */
  const describe = (schema, seen = new Set(), depth = 0) => {
    if (!schema || depth > MAX_DEPTH) return null; // depth cap: YAML aliases can make a schema contain itself
    if (schema.$ref) {
      const name = refName(schema.$ref);
      if (idKeys[name]) return { t: 'entity', name: entityOf[name] };
      if (seen.has(name)) return null;
      return describe(schemas[name], new Set(seen).add(name), depth + 1);
    }
    const alternatives = schema.oneOf ?? schema.anyOf;
    if (alternatives) {
      // Plain values (`string`, `null`) are ignored: Stripe-style "id or expanded object" is just the object.
      const real = alternatives.filter((s) => !isScalarSchema(s));
      if (real.length === 0) return null;
      if (real.length === 1) return describe(real[0], seen, depth + 1);
      // Several object shapes: usable only when a tag property tells them apart.
      const tag = unionTag(schema, real);
      if (!tag) return null;
      const map = {};
      real.forEach((s, i) => {
        const d = describe(s, seen, depth + 1);
        if (d && tag.values[i] !== undefined) map[tag.values[i]] = d;
      });
      const fallback = tag.fallback !== undefined ? describe(real[tag.fallback], seen, depth + 1) : null;
      if (!Object.keys(map).length && !fallback) return null;
      return { t: 'union', key: tag.key, map, ...(fallback ? { default: fallback } : {}) };
    }
    if (schema.allOf) {
      const props = {};
      for (const part of schema.allOf) {
        const d = describe(part, seen, depth + 1);
        if (d?.t === 'object') Object.assign(props, d.props);
        else if (d?.t === 'entity') return d;
      }
      return Object.keys(props).length ? { t: 'object', props } : null;
    }
    if (schema.type === 'array') {
      const items = describe(schema.items, seen, depth + 1);
      return items ? { t: 'array', items } : null;
    }
    if (schema.properties) {
      const props = {};
      for (const [k, v] of Object.entries(schema.properties)) {
        const d = describe(v, seen, depth + 1);
        if (d) props[k] = d;
      }
      return Object.keys(props).length ? { t: 'object', props } : null;
    }
    return null;
  };

  const entities = {};
  for (const name of Object.keys(idKeys)) {
    const entity = entityOf[name];
    const props = { ...(entities[entity]?.props ?? {}) };
    for (const [k, v] of Object.entries(collectProps(schemas[name], schemas))) {
      const d = describe(v);
      if (d) props[k] = d;
    }
    if (entities[entity] && entities[entity].id !== idKeys[name]) {
      problems.push({ level: 'error', code: 'XO102', where: `#/components/schemas/${name}`, message: `entity "${entity}" has conflicting id properties ("${entities[entity].id}" and "${idKeys[name]}")`, fix: 'Use the same id property for every schema mapped to one entity' });
      continue;
    }
    entities[entity] = { id: idKeys[name], ...(Object.keys(props).length ? { props } : {}) };
  }

  // --- operations
  const operations = {};
  const used = new Set();
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const method of METHODS) {
      const o = item[method];
      if (!o) continue;
      let id = o.operationId;
      if (!id) {
        id = `${method}${path.replace(/[{}]/g, '').split(/[/\-_]+/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join('')}`;
        problems.push({ level: 'warn', code: 'XO110', where: `${method.toUpperCase()} ${path}`, message: 'operation has no operationId', fix: `Add operationId (xoong would use "${id}")` });
      }
      if (used.has(id)) {
        problems.push({ level: 'error', code: 'XO111', where: `${method.toUpperCase()} ${path}`, message: `duplicate operationId "${id}"`, fix: 'Make operationIds unique' });
        continue;
      }
      used.add(id);
      const merged = new Map();
      for (const raw of [...(item.parameters ?? []), ...(o.parameters ?? [])]) {
        const p = raw?.$ref ? resolvePointer(doc, raw.$ref) : raw;
        if (p?.name && p.in) merged.set(`${p.in}:${p.name}`, p); // operation-level overrides path-level
      }
      const params = [...merged.values()];
      const pathParams = params.filter((p) => p.in === 'path');
      const declared = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
      for (const name of declared) if (!pathParams.some((p) => p.name === name)) {
        problems.push({ level: 'warn', code: 'XO112', where: `${method.toUpperCase()} ${path}`, message: `path parameter "${name}" is not documented`, fix: 'Declare it under parameters with in: path' });
      }
      const okCode = Object.keys(o.responses ?? {}).find((c) => /^2\d\d$/.test(c));
      const okContent = okCode ? resolve(o.responses[okCode])?.content : undefined;
      const stream = !!okContent?.['text/event-stream'] && !okContent['application/json'];
      let okSchema = okContent?.['application/json']?.schema;
      let unwrap;
      if (hints?.unwrap && okSchema && collectProps(resolve(okSchema), schemas)[hints.unwrap]) {
        unwrap = hints.unwrap; // { code, message, data } envelopes: the screen sees `data`
        okSchema = collectProps(resolve(okSchema), schemas)[unwrap];
      }
      const reqContent = o.requestBody?.content ?? {};
      const multipart = !reqContent['application/json'] && !!reqContent['multipart/form-data'];
      const bodySchema = (reqContent['application/json'] ?? (multipart ? reqContent['multipart/form-data'] : undefined))?.schema;
      const uuid = hints?.idempotencyKeys?.[id];
      if (uuid && !(bodySchema && collectProps(resolve(bodySchema), schemas)[uuid])) {
        problems.push({ level: 'error', code: 'XO170', where: `${method.toUpperCase()} ${path}`, message: `hint idempotencyKeys.${id} names "${uuid}", which is not a field of the request body`, fix: 'Name an existing body property or remove the hint' });
      }
      const hasBody = !!o.requestBody;
      const response = describe(okSchema);
      if (method === 'get' && okCode && !okSchema && okCode !== '204' && !stream) {
        problems.push({ level: 'warn', code: 'XO120', where: `GET ${path}`, message: 'success response has no application/json schema', fix: 'Describe the response schema so types and caching can be generated' });
      }
      const union = unresolvedUnion(okSchema);
      if (union) {
        const names = union.slice(0, 4).join(' | ') + (union.length > 4 ? ' | ...' : '');
        problems.push({ level: 'warn', code: 'XO160', where: `${method.toUpperCase()} ${path}`, message: `the response contains a union of entities (${names}) with no way to tell them apart, so they are not stored in the shared entity store`, fix: 'Give the members a property with one fixed value each (for example type: "file") or an OpenAPI discriminator' });
      }
      const hasError = Object.keys(o.responses ?? {}).some((c) => /^[45]/.test(c) || c === 'default');
      if (!hasError) problems.push({ level: 'warn', code: 'XO130', where: `${method.toUpperCase()} ${path}`, message: 'no error responses documented', fix: 'Document 4xx/5xx or default with application/problem+json' });
      operations[id] = {
        id, method: method.toUpperCase(), path,
        ...(params.some((p) => p.in === 'query') ? { query: params.filter((p) => p.in === 'query').map((p) => p.name) } : {}),
        ...(hasBody ? { body: true } : {}),
        ...(multipart ? { multipart: true } : {}),
        ...(uuid ? { uuid: [uuid] } : {}),
        ...(unwrap ? { unwrap } : {}),
        ...(stream ? { stream: true } : {}),
        ...(bodyFieldsOf(bodySchema, schemas) ? { bodyFields: bodyFieldsOf(bodySchema, schemas) } : {}),
        ...(response ? { response } : {}),
      };
      operations[id]._types = { params, okSchema, bodySchema };
    }
  }

  for (const [name, schema] of Object.entries(schemas)) {
    const candidate = !idKeys[name] && schema.type === 'object' && !/Request$/.test(name) ? identityCandidate(name, schema, schemas, hints?.idNames ?? []) : undefined;
    if (candidate) {
      problems.push({ level: 'warn', code: 'XO140', where: `#/components/schemas/${name}`, message: `${name} has "${candidate}" but is not treated as an entity, so it is stored inline and not shared between screens`, fix: `If instances repeat across responses, add a hint { "schemas": { "${name}": { "id": "${candidate}" } } } (or "x-xoong-id" in the document); otherwise ignore` });
    }
  }
  return { operations, entities, schemas, problems };
}

/**
 * The flat, primitive fields of a request body, for generated forms (`<xo-form>`) and typed form values.
 * Nested objects and arrays are left out: a form for them is hand-written.
 * @returns {{ name: string, type: string, required?: true, format?: string, enum?: any[], maxLength?: number, title?: string }[] | undefined}
 */
function bodyFieldsOf(schema, schemas) {
  const root = schema?.$ref ? schemas[refName(schema.$ref)] : schema;
  if (!root || root.type !== 'object' && !root.properties && !root.allOf) return undefined;
  const required = new Set([...(root.required ?? []), ...(root.allOf ?? []).flatMap((p) => (p.$ref ? schemas[refName(p.$ref)] : p)?.required ?? [])]);
  const out = [];
  for (const [name, raw] of Object.entries(collectProps(root, schemas))) {
    const prop = raw?.$ref ? schemas[refName(raw.$ref)] : raw;
    if (!prop || !['string', 'integer', 'number', 'boolean'].includes(prop.type) || prop.readOnly) continue;
    const file = prop.type === 'string' && prop.format === 'binary';
    out.push({
      name, type: file ? 'file' : prop.type,
      ...(required.has(name) ? { required: true } : {}),
      ...(prop.format && !file ? { format: prop.format } : {}),
      ...(prop.enum ? { enum: prop.enum } : {}),
      ...(prop.maxLength ? { maxLength: prop.maxLength } : {}),
      ...(prop.title ? { title: prop.title } : {}),
    });
  }
  return out.length ? out : undefined;
}
function collectProps(schema, schemas, seen = new Set()) {
  if (!schema) return {};
  if (schema.$ref) {
    const name = refName(schema.$ref);
    if (seen.has(name)) return {}; // circular allOf
    return collectProps(schemas[name], schemas, new Set(seen).add(name));
  }
  let props = { ...(schema.properties ?? {}) };
  for (const part of schema.allOf ?? []) props = { ...collectProps(part, schemas, seen), ...props };
  return props;
}
/**
 * A property that looks like the schema's own identity, excluding plain `id` (handled elsewhere):
 * a conventional name (uuid, guid, gid, uid, pk) or `<stem>_id` / `<stem>Id` where the stem occurs in
 * the schema name (session_id in SessionResponse). Foreign keys to other things (task_id in PendingAction) are ignored.
 */
function identityCandidate(name, schema, schemas, taken = []) {
  const flat = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return Object.keys(collectProps(schema, schemas)).find((k) => {
    if (k === 'id' || taken.includes(k)) return false;
    if (/^(uuid|guid|gid|uid|pk)$/i.test(k)) return true;
    const m = /^(.+?)(?:_id|Id)$/.exec(k);
    return !!m && flat.includes(m[1].toLowerCase().replace(/[^a-z0-9]/g, ''));
  });
}

// ---------------------------------------------------------------- TypeScript

const ident = (s) => (/^[A-Za-z_$][\w$]*$/.test(s) ? s : JSON.stringify(s));

/** Words that cannot (or must not) be used as a generated type name. */
const RESERVED = new Set(('break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static implements interface package private protected public await async type any unknown never object string number boolean symbol bigint undefined Record Array Operations Partial Readonly Promise').split(' '));

/** A schema name as a valid TypeScript type name (Dto.User -> Dto_User, import -> import_). */
export function typeName(name) {
  let t = name.replace(/[^A-Za-z0-9_$]/g, '_');
  if (/^[0-9]/.test(t)) t = '_' + t;
  return RESERVED.has(t) ? t + '_' : t;
}

/** Unique TypeScript names for every schema (two schemas never share a name). */
export function typeNames(schemas) {
  const used = new Set();
  const map = new Map();
  for (const name of Object.keys(schemas)) {
    let t = typeName(name);
    while (used.has(t)) t += '_';
    used.add(t);
    map.set(name, t);
  }
  return map;
}

/** JSON-Schema-ish -> TypeScript type text. `names` maps schema names to type names (refs to unknown schemas become `unknown`). */
export function tsType(schema, depth = 0, names = null, hops = 0) {
  if (!schema || hops > MAX_DEPTH) return 'unknown'; // hops counts every nesting step (arrays and unions too), so a cycle ends
  if (schema.$ref) {
    const n = refName(schema.$ref);
    if (names) return names.get(n) ?? 'unknown';
    return typeName(n);
  }
  const nullable = schema.nullable ? ' | null' : '';
  if ('const' in schema) return JSON.stringify(schema.const) + nullable;
  if (schema.enum) return (schema.enum.length ? schema.enum.map((v) => JSON.stringify(v)).join(' | ') : 'never') + nullable;
  if (schema.allOf) return schema.allOf.map((s) => tsType(s, depth, names, hops + 1)).join(' & ') + nullable;
  if (schema.oneOf || schema.anyOf) return (schema.oneOf ?? schema.anyOf).map((s) => tsType(s, depth, names, hops + 1)).join(' | ') + nullable;
  const type = Array.isArray(schema.type) ? schema.type : [schema.type];
  const parts = type.map((t) => {
    switch (t) {
      case 'string': return 'string';
      case 'integer': case 'number': return 'number';
      case 'boolean': return 'boolean';
      case 'null': return 'null';
      case 'array': return `Array<${tsType(schema.items, depth, names, hops + 1)}>`;
      case 'object': case undefined: {
        const props = Object.entries(schema.properties ?? {});
        if (!props.length) return schema.additionalProperties && schema.additionalProperties !== true ? `Record<string, ${tsType(schema.additionalProperties, depth, names, hops + 1)}>` : t === 'object' ? 'Record<string, unknown>' : 'unknown';
        const pad = '  '.repeat(depth + 1);
        const req = new Set(schema.required ?? []);
        return `{\n${props.map(([k, v]) => `${pad}${ident(k)}${req.has(k) ? '' : '?'}: ${tsType(v, depth + 1, names, hops + 1)};`).join('\n')}\n${'  '.repeat(depth)}}`;
      }
      default: return 'unknown';
    }
  });
  return parts.join(' | ') + nullable;
}

/** @param {ReturnType<typeof analyze>} a */
export function generateDts(a) {
  const out = ['// Generated by `xoong sync`. Do not edit.\n'];
  const names = typeNames(a.schemas);
  for (const [name, schema] of Object.entries(a.schemas)) out.push(`export type ${names.get(name)} = ${tsType(schema, 0, names)};\n`);
  out.push('export interface Operations {');
  for (const o of Object.values(a.operations)) {
    const t = o._types;
    const seen = new Set();
    const params = t.params.filter((p) => (p.in === 'path' || p.in === 'query') && !seen.has(p.name) && seen.add(p.name));
    const paramsT = params.length ? `{ ${params.map((p) => `${ident(p.name)}${p.in === 'path' || p.required ? '' : '?'}: ${tsType(p.schema, 0, names)}`).join('; ')} }` : 'Record<string, never>';
    out.push(`  ${ident(o.id)}: { method: ${JSON.stringify(o.method)}; path: ${JSON.stringify(o.path)}; params: ${paramsT}; body: ${t.bodySchema ? tsType(t.bodySchema, 2, names) : 'never'}; response: ${t.okSchema ? tsType(t.okSchema, 2, names) : 'void'} };`);
  }
  out.push('}\n');
  return out.join('\n');
}

/** Strip build-only data before writing operations.json. */
export function runtimeTable(a) {
  const operations = {};
  for (const [id, { _types, ...rest }] of Object.entries(a.operations)) operations[id] = rest;
  return { version: 1, operations, entities: a.entities };
}
