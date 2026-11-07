// @ts-check
/**
 * Swagger 2.0 -> OpenAPI 3.0 for what xoong reads: paths, parameters, request bodies, responses, schemas.
 * Not a general converter (security schemes, examples, callbacks and `x-` extensions other than on schemas are dropped);
 * for those use `npx swagger2openapi`. Pure function: returns a new document, never modifies the input.
 */

const JSON_MIME = 'application/json';

/** A Swagger 2 `type: file` schema is a binary string in OpenAPI 3. */
const fileSchema = (schema) => (schema?.type === 'file' ? { type: 'string', format: 'binary' } : schema);

/** Rewrite "#/definitions/X" (and parameters/responses) references into their OpenAPI 3 homes. */
function rewriteRefs(node) {
  if (Array.isArray(node)) return node.map(rewriteRefs);
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === '$ref' && typeof v === 'string') out[k] = v.replace('#/definitions/', '#/components/schemas/').replace('#/parameters/', '#/components/parameters/').replace('#/responses/', '#/components/responses/');
    else if (k === 'x-nullable') { if (v) out.nullable = true; } else out[k] = rewriteRefs(v);
  }
  return out;
}

/** A Swagger 2 non-body parameter carries its schema inline: move it under `schema`. */
function parameter3(p, doc) {
  if (p.$ref) return rewriteRefs(p);
  const { name, in: where, description, required, ...rest } = p;
  const schema = {};
  for (const k of ['type', 'format', 'items', 'enum', 'default', 'minimum', 'maximum', 'minLength', 'maxLength', 'pattern']) if (k in rest) schema[k] = rest[k];
  // Swagger 2 `collectionFormat`: csv (the default) is "a=1,2", multi is "a=1&a=2".
  const style = schema.type === 'array' && (where === 'query' || where === 'header' || where === 'path')
    ? (rest.collectionFormat === 'multi' ? { style: 'form', explode: true } : rest.collectionFormat === 'ssv' ? { style: 'spaceDelimited', explode: false } : rest.collectionFormat === 'pipes' ? { style: 'pipeDelimited', explode: false } : { style: where === 'query' ? 'form' : 'simple', explode: false })
    : {};
  return { name, in: where, ...(description ? { description } : {}), ...(required || where === 'path' ? { required: true } : {}), ...style, schema: rewriteRefs(schema) };
}

/** @param {any} doc a Swagger 2.0 document @returns {any} */
export function swagger2ToOpenApi3(doc) {
  const globalConsumes = doc.consumes ?? [JSON_MIME];
  const globalProduces = doc.produces ?? [JSON_MIME];
  const resolveParam = (p) => (p.$ref ? doc.parameters?.[p.$ref.split('/').pop()] ?? p : p);
  const paths = {};
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    const out = {};
    const shared = (item.parameters ?? []).map(resolveParam);
    for (const [method, op] of Object.entries(item)) {
      if (!['get', 'put', 'post', 'delete', 'options', 'head', 'patch'].includes(method)) continue;
      const params = [...shared.filter((p) => !(op.parameters ?? []).some((o) => resolveParam(o).name === p.name && resolveParam(o).in === p.in)), ...(op.parameters ?? []).map(resolveParam)];
      const body = params.find((p) => p.in === 'body');
      const form = params.filter((p) => p.in === 'formData');
      const consumes = op.consumes ?? globalConsumes;
      const produces = op.produces ?? globalProduces;
      const o = { ...(op.operationId ? { operationId: op.operationId } : {}), ...(op.summary ? { summary: op.summary } : {}), ...(op.tags ? { tags: op.tags } : {}) };
      const plain = params.filter((p) => p.in !== 'body' && p.in !== 'formData').map((p) => parameter3(p, doc));
      if (plain.length) o.parameters = plain;
      if (body) {
        o.requestBody = { ...(body.required ? { required: true } : {}), content: Object.fromEntries((consumes.length ? consumes : [JSON_MIME]).map((m) => [m, { schema: rewriteRefs(body.schema) }])) };
      } else if (form.length) {
        const multipart = consumes.includes('multipart/form-data') || form.some((f) => f.type === 'file');
        const properties = Object.fromEntries(form.map((f) => [f.name, f.type === 'file' ? { type: 'string', format: 'binary' } : rewriteRefs(Object.fromEntries(['type', 'format', 'enum', 'items', 'default', 'minimum', 'maximum', 'minLength', 'maxLength', 'pattern'].filter((k) => k in f).map((k) => [k, f[k]])))]));
        const required = form.filter((f) => f.required).map((f) => f.name);
        o.requestBody = { content: { [multipart ? 'multipart/form-data' : 'application/x-www-form-urlencoded']: { schema: { type: 'object', properties, ...(required.length ? { required } : {}) } } } };
      }
      o.responses = {};
      for (const [code, r] of Object.entries(op.responses ?? {})) {
        if (r.$ref) { o.responses[code] = rewriteRefs(r); continue; }
        const res = { description: r.description ?? '' };
        if (r.schema) res.content = Object.fromEntries((produces.length ? produces : [JSON_MIME]).map((m) => [m, { schema: rewriteRefs(fileSchema(r.schema)) }]));
        o.responses[code] = res;
      }
      out[method] = o;
    }
    paths[path] = out;
  }
  const responses = Object.fromEntries(Object.entries(doc.responses ?? {}).map(([k, r]) => [k, { description: r.description ?? '', ...(r.schema ? { content: { [JSON_MIME]: { schema: rewriteRefs(r.schema) } } } : {}) }]));
  return {
    openapi: '3.0.3',
    info: doc.info ?? { title: 'API', version: '0' },
    ...(doc.host ? { servers: [{ url: `${(doc.schemes ?? ['https'])[0]}://${doc.host}${doc.basePath ?? ''}` }] } : doc.basePath ? { servers: [{ url: doc.basePath }] } : {}),
    paths,
    components: {
      schemas: rewriteRefs(doc.definitions ?? {}),
      ...(Object.keys(responses).length ? { responses } : {}),
      ...(doc.parameters ? { parameters: Object.fromEntries(Object.entries(doc.parameters).filter(([, p]) => p.in !== 'body').map(([k, p]) => [k, parameter3(p, doc)])) } : {}),
    },
  };
}
