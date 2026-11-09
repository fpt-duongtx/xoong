// A generated OpenAPI 3.0 document with `resources` resources and five operations each (list, create, get, update, delete): 500 operations by default.
// It exists because no large real API description ships with this repository; it is labelled "generated" wherever it is used.
export function generateSpec(resources = 100) {
  const paths = {}, schemas = {};
  const err = { default: { description: 'error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } };
  schemas.Error = { type: 'object', required: ['error'], properties: { error: { type: 'object', required: ['code', 'message'], properties: { code: { type: 'string' }, message: { type: 'string' } } } } };
  for (let i = 0; i < resources; i++) {
    const R = `Item${i}`, p = `/items${i}`;
    schemas[R] = { type: 'object', required: ['id', 'name', 'status'], properties: { id: { type: 'integer' }, name: { type: 'string', maxLength: 80 }, email: { type: 'string', format: 'email' }, status: { type: 'string', enum: ['active', 'disabled'] }, createdAt: { type: 'string', format: 'date-time' }, tags: { type: 'array', items: { type: 'string' } } } };
    schemas[`New${R}`] = { type: 'object', required: ['name'], properties: { name: { type: 'string', maxLength: 80 }, email: { type: 'string', format: 'email' }, status: { type: 'string', enum: ['active', 'disabled'] } } };
    schemas[`${R}Page`] = { type: 'object', required: ['items', 'total'], properties: { items: { type: 'array', items: { $ref: `#/components/schemas/${R}` } }, total: { type: 'integer' } } };
    const ref = (n) => ({ content: { 'application/json': { schema: { $ref: `#/components/schemas/${n}` } } } });
    const id = { name: 'id', in: 'path', required: true, schema: { type: 'integer' } };
    paths[p] = {
      get: { operationId: `list${R}`, parameters: ['q', 'sort'].map((n) => ({ name: n, in: 'query', schema: { type: 'string' } })).concat(['limit', 'offset'].map((n) => ({ name: n, in: 'query', schema: { type: 'integer' } }))), responses: { 200: { description: 'ok', ...ref(`${R}Page`) }, ...err } },
      post: { operationId: `create${R}`, requestBody: { required: true, ...ref(`New${R}`) }, responses: { 201: { description: 'created', ...ref(R) }, ...err } },
    };
    paths[`${p}/{id}`] = {
      parameters: [id],
      get: { operationId: `get${R}`, responses: { 200: { description: 'ok', ...ref(R) }, ...err } },
      put: { operationId: `update${R}`, requestBody: { required: true, ...ref(`New${R}`) }, responses: { 200: { description: 'ok', ...ref(R) }, ...err } },
      delete: { operationId: `delete${R}`, responses: { 204: { description: 'deleted' }, ...err } },
    };
  }
  return { openapi: '3.0.3', info: { title: `Generated, ${resources * 5} operations`, version: '1.0.0' }, paths, components: { schemas } };
}
