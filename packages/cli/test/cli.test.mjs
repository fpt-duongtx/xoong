import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { analyze, sync, doctor, generateDts } from '../src/index.js';
const generateDtsSync = generateDts;

const fixture = new URL('./fixture.json', import.meta.url).pathname;
const cli = new URL('../src/cli.js', import.meta.url).pathname;
const run = promisify(execFile);

test('entities, descriptors and operations are derived from the document', async () => {
  const a = analyze(JSON.parse(await readFile(fixture, 'utf8')));
  assert.deepEqual(Object.keys(a.entities).sort(), ['Order', 'User']);
  assert.deepEqual(a.entities.Order, { id: 'id', props: { customer: { t: 'entity', name: 'User', replace: true } } });
  assert.deepEqual(a.operations.listUsers.response, { t: 'array', items: { t: 'entity', name: 'User', replace: true } });
  assert.deepEqual(a.operations.listUsers.query, ['page']);
  assert.equal(a.operations.createUser.body, true);
  assert.equal(a.operations.getUser.method, 'GET');
  const generated = a.operations.getOrders; // operationId generated for GET /orders
  assert.ok(generated, 'generated operationId');
  assert.deepEqual(generated.response, { t: 'object', props: { items: { t: 'array', items: { t: 'entity', name: 'Order', replace: true } } } });
});

test('doctor reports actionable findings', async () => {
  const { text, errors } = await doctor(fixture);
  assert.equal(errors, 0);
  assert.match(text, /XO110 GET \/orders[\s\S]*operationId/);
  assert.match(text, /XO140 #\/components\/schemas\/Audit/);
  assert.match(text, /XO120 GET \/stats/);
});

test('sync writes operations.json and a usable api.d.ts', async () => {
  const out = await mkdtemp(join(tmpdir(), 'xoong-'));
  await sync(fixture, { out });
  const table = JSON.parse(await readFile(join(out, 'operations.json'), 'utf8'));
  assert.equal(table.operations.listUsers._types, undefined);
  const dts = await readFile(join(out, 'api.d.ts'), 'utf8');
  assert.match(dts, /export type User = \{[\s\S]*id: number;[\s\S]*role\?: "admin" \| "user";[\s\S]*note\?: string \| null;/);
  assert.match(dts, /getUser: \{ method: "GET"; path: "\/users\/\{id\}"; params: \{ id: number \}/);
  assert.match(dts, /createUser:[\s\S]*body: NewUser; response: User/);
});

test('CLI: exit codes and messages', async () => {
  const out = await mkdtemp(join(tmpdir(), 'xoong-'));
  const ok = await run('node', [cli, 'sync', fixture, '--out', out]);
  assert.match(ok.stdout, /synced 6 operations, 2 entities/);
  await assert.rejects(run('node', [cli, 'sync', '/nope.json']), (e) => /ENOENT/.test(e.stderr) && e.code === 1);
  const help = await run('node', [cli]);
  assert.match(help.stdout, /sync <openapi/);
});

test('non-OpenAPI input is rejected clearly; Swagger 2.0 says how to convert', () => {
  assert.throws(() => analyze({ foo: 1 }), /OpenAPI 3/);
  assert.throws(() => analyze({ swagger: '2.0' }), /swagger2openapi/);
});

test('schema names that are not TS identifiers produce compilable names', async () => {
  const { typeName, generateDts, analyze: an } = await import('../src/openapi.js');
  assert.equal(typeName('Dto.User'), 'Dto_User');
  assert.equal(typeName('Page-User'), 'Page_User');
  assert.equal(typeName('2fa'), '_2fa');
  assert.equal(typeName('Operations'), 'Operations_');
  const a = an({ openapi: '3.0.0', paths: { '/x': { get: { operationId: 'getX', responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Dto.User' } } } } } } } },
    components: { schemas: { 'Dto.User': { type: 'object', properties: { id: { type: 'integer' } } } } } });
  const dts = generateDts(a);
  assert.match(dts, /export type Dto_User = /);
  assert.match(dts, /response: Dto_User/);
});

test('circular allOf does not overflow the stack', () => {
  const doc = { openapi: '3.0.0', paths: {}, components: { schemas: {
    A: { allOf: [{ $ref: '#/components/schemas/B' }] },
    B: { allOf: [{ $ref: '#/components/schemas/A' }] },
  } } };
  assert.doesNotThrow(() => analyze(doc));
});

test('OpenAPI 3.1 const becomes a literal type', () => {
  const a = analyze({ openapi: '3.1.0', paths: {}, components: { schemas: { Done: { type: 'object', required: ['status'], properties: { status: { type: 'string', const: 'ended' } } } } } });
  assert.match(generateDtsSync(a), /status: "ended"/);
});

test('hints map several schemas to one entity without editing the document', () => {
  const doc = JSON.parse(JSON.stringify({ openapi: '3.1.0', paths: { '/s/{sid}': { get: { operationId: 'getS', responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/SessionResponse' } } } } } } } },
    components: { schemas: {
      SessionResponse: { type: 'object', properties: { session_id: { type: 'string' }, turn: { type: 'integer' }, tasks: { type: 'array', items: { $ref: '#/components/schemas/TaskView' } } } },
      ChatResponse: { type: 'object', properties: { session_id: { type: 'string' }, reply: { type: 'string' } } },
      TaskView: { type: 'object', properties: { task_id: { type: 'string' } } },
    } } }));
  const hints = { schemas: { SessionResponse: { entity: 'Session', id: 'session_id' }, ChatResponse: { entity: 'Session', id: 'session_id' }, TaskView: { id: 'task_id' } } };
  const a = analyze(doc, { hints });
  assert.deepEqual(Object.keys(a.entities).sort(), ['Session', 'TaskView']);
  assert.deepEqual(a.entities.Session, { id: 'session_id', props: { tasks: { t: 'array', items: { t: 'entity', name: 'TaskView', replace: true } } } });
  assert.deepEqual(a.operations.getS.response, { t: 'entity', name: 'Session' });
  assert.throws(() => analyze({ ...doc }, { hints: { schemas: { Nope: { id: 'x' } } } }), /unknown schema "Nope"/);
});

test('doctor suggests identity candidates and does not flag plain `code` fields', () => {
  const a = analyze({ openapi: '3.1.0', paths: {}, components: { schemas: {
    ErrorDetail: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
    TaskView: { type: 'object', properties: { task_id: { type: 'string' } } },
  } } });
  const where = a.problems.filter((p) => p.code === 'XO140').map((p) => p.where);
  assert.deepEqual(where, ['#/components/schemas/TaskView']);
  assert.match(a.problems.find((p) => p.code === 'XO140').fix, /"id": "task_id"/);
});

const minimal = (extra = {}) => ({ openapi: '3.0.3', info: { title: 't', version: '1' }, paths: {}, ...extra });

test('broken documents are reported as errors, not silently accepted', () => {
  const noPaths = analyze({ openapi: '3.0.3', info: { title: 't', version: '1' } });
  assert.ok(noPaths.problems.some((p) => p.code === 'XO100' && p.level === 'error'));
  const dangling = analyze(minimal({ paths: { '/x': { get: { operationId: 'x', responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Nope' } } } } } } } } }));
  const e = dangling.problems.find((p) => p.code === 'XO150');
  assert.equal(e.level, 'error');
  assert.equal(e.where, '#/components/schemas/Nope');
  assert.match(generateDts(dangling), /response: unknown/); // still compilable
});

test('external refs warn; escaped pointers resolve', () => {
  const a = analyze(minimal({ components: { schemas: { 'A/B': { type: 'object', properties: { x: { type: 'string' } } }, C: { $ref: '#/components/schemas/A~1B' }, D: { $ref: 'other.yaml#/X' } } } }));
  assert.ok(a.problems.some((p) => p.code === 'XO151' && p.level === 'warn'));
  assert.ok(!a.problems.some((p) => p.code === 'XO150'));
});

test('generated types: reserved words, built-in names and collisions get distinct valid names', () => {
  const schemas = { import: { type: 'object', properties: { a: { type: 'string' } } }, Record: { type: 'string' }, Array: { type: 'string' },
    'Dto.User': { type: 'string' }, Dto_User: { type: 'number' }, Operations: { type: 'string' } };
  const dts = generateDts({ schemas, operations: {} });
  const names = [...dts.matchAll(/export type (\w+) =/g)].map((m) => m[1]);
  assert.equal(new Set(names).size, 6);
  assert.deepEqual(names.sort(), ['Array_', 'Dto_User', 'Dto_User_', 'Operations_', 'Record_', 'import_']);
});

test('duplicate parameters (path-level and operation-level) appear once; operation-level wins', () => {
  const a = analyze(minimal({ paths: { '/p/{id}': {
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, { name: 'q', in: 'query', schema: { type: 'string' } }],
    get: { operationId: 'getP', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }, { name: 'q', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'ok' } } } } } }));
  const dts = generateDts(a);
  assert.match(dts, /params: \{ id: number; q\?: string \}/);
});

test('identity heuristics: conventional names and own-stem ids; foreign keys are ignored', () => {
  const a = analyze(minimal({ components: { schemas: {
    Asana: { type: 'object', properties: { gid: { type: 'string' } } },
    Authentik: { type: 'object', properties: { pk: { type: 'integer' } } },
    SessionResponse: { type: 'object', properties: { session_id: { type: 'string' } } },
    PendingAction: { type: 'object', properties: { task_id: { type: 'string' } } },
  } } }));
  const where = a.problems.filter((p) => p.code === 'XO140').map((p) => p.where.split('/').pop()).sort();
  assert.deepEqual(where, ['Asana', 'Authentik', 'SessionResponse']);
});

test('YAML documents are read the same as JSON', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'xoong-'));
  const { writeFile } = await import('node:fs/promises');
  const yamlPath = join(dir, 'spec.yaml');
  await writeFile(yamlPath, 'openapi: 3.0.3\ninfo: {title: t, version: "1"}\npaths:\n  /a:\n    get:\n      operationId: getA\n      responses:\n        "200": {description: ok}\n        default: {description: err}\n');
  const { text } = await doctor(yamlPath);
  assert.match(text, /1 operations, 0 entities, 0 errors/);
});

test('doctor groups repeated warnings and prints errors in full; --all lists everything', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'xoong-'));
  const { writeFile } = await import('node:fs/promises');
  const paths = {};
  for (let i = 0; i < 12; i++) paths[`/r${i}`] = { get: { operationId: `r${i}`, responses: { 200: { description: 'ok' } } } };
  const spec = join(dir, 's.json');
  await writeFile(spec, JSON.stringify(minimal({ paths })));
  const grouped = await doctor(spec);
  assert.match(grouped.text, /and 7 more XO130/);
  assert.equal((grouped.text.match(/^warn XO130/gm) ?? []).length, 5);
  const all = await doctor(spec, { all: true });
  assert.equal((all.text.match(/^warn XO130/gm) ?? []).length, 12);
});

test('CLI: sync exits non-zero and prints errors for a broken document', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'xoong-'));
  const { writeFile } = await import('node:fs/promises');
  const spec = join(dir, 'broken.json');
  await writeFile(spec, JSON.stringify({ openapi: '3.0.3', info: { title: 't', version: '1' } }));
  await assert.rejects(run('node', [cli, 'sync', spec, '--out', join(dir, 'o')]), (e) => e.code === 1 && /XO100/.test(e.stderr));
});

test('hints.idNames makes every schema with that property an entity (gid, pk, ...)', () => {
  const doc = minimal({ components: { schemas: {
    Task: { type: 'object', properties: { gid: { type: 'string' }, name: { type: 'string' } } },
    User: { type: 'object', properties: { gid: { type: 'string' } } },
    Tag: { type: 'object', properties: { id: { type: 'string' } } },
    Plain: { type: 'object', properties: { name: { type: 'string' } } },
  } } });
  const a = analyze(doc, { hints: { idNames: ['gid'] } });
  assert.deepEqual(Object.keys(a.entities).sort(), ['Tag', 'Task', 'User']);
  assert.equal(a.entities.Task.id, 'gid');
  assert.equal(a.entities.Tag.id, 'id');
  assert.ok(!a.problems.some((p) => p.code === 'XO140')); // no longer suggested: already handled
});

test('anyOf [X, null] is described as X; unions of several entities are reported, not guessed', () => {
  const doc = minimal({
    paths: {
      '/v': { post: { operationId: 'verify', responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Verify' } } } }, default: { description: 'e' } } } },
      '/items': { get: { operationId: 'items', responses: { 200: { content: { 'application/json': { schema: { type: 'array', items: { oneOf: [{ $ref: '#/components/schemas/File' }, { $ref: '#/components/schemas/Folder' }] } } } } }, default: { description: 'e' } } } },
    },
    components: { schemas: {
      Verify: { type: 'object', properties: { chat: { anyOf: [{ $ref: '#/components/schemas/Chat' }, { type: 'null' }] }, ok: { type: 'boolean' } } },
      Chat: { type: 'object', properties: { id: { type: 'string' } } },
      File: { type: 'object', properties: { id: { type: 'string' } } },
      Folder: { type: 'object', properties: { id: { type: 'string' } } },
    } },
  });
  const a = analyze(doc);
  assert.deepEqual(a.operations.verify.response, { t: 'object', props: { chat: { t: 'entity', name: 'Chat', replace: true } } });
  assert.equal(a.operations.items.response, undefined);
  assert.ok(a.problems.some((p) => p.code === 'XO160' && p.where === 'GET /items'));
});

const unionDoc = (schemas, responseSchema) => minimal({
  paths: { '/x': { get: { operationId: 'getX', responses: { 200: { content: { 'application/json': { schema: responseSchema } } }, default: { description: 'e' } } } } },
  components: { schemas },
});
const ref = (n) => ({ $ref: `#/components/schemas/${n}` });

test('expandable fields (id string or object) describe the object', () => {
  const a = analyze(unionDoc({
    Customer: { type: 'object', properties: { id: { type: 'string' }, object: { type: 'string', enum: ['customer'] } } },
    Charge: { type: 'object', properties: { id: { type: 'string' }, customer: { anyOf: [{ type: 'string' }, ref('Customer')] } } },
  }, ref('Charge')));
  assert.deepEqual(a.entities.Charge.props, { customer: { t: 'entity', name: 'Customer', replace: true } });
  assert.ok(!a.problems.some((p) => p.code === 'XO160'));
});

test('unions are resolved by a discriminator (with mapping) or by an auto-detected tag property', () => {
  const members = {
    File: { type: 'object', properties: { id: { type: 'string' }, type: { type: 'string', enum: ['file'] } } },
    Folder: { type: 'object', properties: { id: { type: 'string' }, type: { type: 'string', const: 'folder' } } },
  };
  const auto = analyze(unionDoc(members, { type: 'array', items: { oneOf: [ref('File'), ref('Folder')] } }));
  assert.deepEqual(auto.operations.getX.response, { t: 'array', items: { t: 'union', key: 'type', map: { file: { t: 'entity', name: 'File', replace: true }, folder: { t: 'entity', name: 'Folder', replace: true } } } });
  assert.ok(!auto.problems.some((p) => p.code === 'XO160'));

  const plain = { File: { type: 'object', properties: { id: { type: 'string' } } }, Folder: { type: 'object', properties: { id: { type: 'string' } } } };
  const mapped = analyze(unionDoc(plain, { oneOf: [ref('File'), ref('Folder')], discriminator: { propertyName: 'kind', mapping: { f: '#/components/schemas/File', d: '#/components/schemas/Folder' } } }));
  assert.deepEqual(mapped.operations.getX.response.map, { f: { t: 'entity', name: 'File', replace: true }, d: { t: 'entity', name: 'Folder', replace: true } });
  const implicit = analyze(unionDoc(plain, { oneOf: [ref('File'), ref('Folder')], discriminator: { propertyName: 'kind' } }));
  assert.deepEqual(Object.keys(implicit.operations.getX.response.map), ['File', 'Folder']);
});

test('a union that cannot be told apart is reported, not guessed', () => {
  const plain = { File: { type: 'object', properties: { id: { type: 'string' } } }, Folder: { type: 'object', properties: { id: { type: 'string' } } } };
  const a = analyze(unionDoc(plain, { oneOf: [ref('File'), ref('Folder')] }));
  assert.equal(a.operations.getX.response, undefined);
  assert.ok(a.problems.some((p) => p.code === 'XO160'));
});

test('"X | deleted_X" unions (a flag fixed on one member only) resolve with a default member', () => {
  const a = analyze(unionDoc({
    customer: { type: 'object', properties: { id: { type: 'string' }, object: { enum: ['customer'] } } },
    deleted_customer: { type: 'object', properties: { id: { type: 'string' }, object: { enum: ['customer'] }, deleted: { type: 'boolean', enum: [true] } } },
  }, { anyOf: [ref('customer'), ref('deleted_customer')] }));
  assert.deepEqual(a.operations.getX.response, { t: 'union', key: 'deleted', map: { true: { t: 'entity', name: 'deleted_customer', replace: true } }, default: { t: 'entity', name: 'customer', replace: true } });
  assert.ok(!a.problems.some((p) => p.code === 'XO160'));
});

test('analyze() does not modify the caller\'s document when hints are applied', () => {
  const doc = minimal({ components: { schemas: { Task: { type: 'object', properties: { task_id: { type: 'string' } } } } } });
  const before = JSON.stringify(doc);
  const a = analyze(doc, { hints: { schemas: { Task: { id: 'task_id' } } } });
  assert.deepEqual(Object.keys(a.entities), ['Task']);
  assert.equal(JSON.stringify(doc), before);
});

test('shared and cyclic objects (YAML anchors) are walked once and do not hang', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'xoong-yaml-'));
  const { writeFile } = await import('node:fs/promises');
  const spec = join(dir, 'anchors.yaml');
  await writeFile(spec, `openapi: 3.0.3
info: {title: t, version: "1"}
paths:
  /a:
    get:
      operationId: getA
      responses:
        "200": &ok {description: ok, content: {application/json: {schema: {$ref: "#/components/schemas/Node"}}}}
        default: *ok
components:
  schemas:
    Node: &node
      type: object
      properties:
        id: {type: string}
        child: *node
`);
  const { text } = await doctor(spec);
  assert.match(text, /1 operations, 1 entities, 0 errors/);
});

test('sync describes the simple fields of a request body for generated forms', async () => {
  const doc = { openapi: '3.0.3', info: { title: 't', version: '1' }, paths: { '/pets': { post: {
    operationId: 'createPet',
    requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/NewPet' } } } },
    responses: { default: { description: 'e' } } } } },
  components: { schemas: { NewPet: { type: 'object', required: ['name'], properties: {
    name: { type: 'string', maxLength: 30, title: 'Pet name' },
    age: { type: 'integer' }, vaccinated: { type: 'boolean' }, kind: { type: 'string', enum: ['cat', 'dog'] },
    born: { type: 'string', format: 'date' }, id: { type: 'integer', readOnly: true },
    owner: { type: 'object', properties: { x: { type: 'string' } } }, tags: { type: 'array', items: { type: 'string' } } } } } } };
  const { operations } = analyze(doc);
  assert.deepEqual(operations.createPet.bodyFields, [
    { name: 'name', type: 'string', required: true, maxLength: 30, title: 'Pet name' },
    { name: 'age', type: 'integer' }, { name: 'vaccinated', type: 'boolean' },
    { name: 'kind', type: 'string', enum: ['cat', 'dog'] }, { name: 'born', type: 'string', format: 'date' },
  ]); // read-only, nested objects and arrays are not form fields
});

test('operations without a plain object body have no bodyFields', () => {
  const doc = { openapi: '3.0.3', info: { title: 't', version: '1' }, paths: { '/x': { post: {
    operationId: 'x', requestBody: { content: { 'application/json': { schema: { type: 'array', items: { type: 'string' } } } } },
    responses: { default: { description: 'e' } } } } } };
  assert.equal(analyze(doc).operations.x.bodyFields, undefined);
});

test('hints: unwrap, idempotency keys; multipart and event-stream operations are detected', () => {
  const env = (data) => ({ type: 'object', properties: { code: { type: 'integer' }, data } });
  const json = (schema) => ({ content: { 'application/json': { schema } } });
  const doc = { openapi: '3.0.3', info: { title: 't', version: '1' }, paths: {
    '/pets': { get: { operationId: 'listPets', responses: { 200: { description: 'ok', ...json(env({ type: 'array', items: { $ref: '#/components/schemas/Pet' } })) }, default: { description: 'e' } } } },
    '/pets/{id}/photo': { post: { operationId: 'uploadPhoto', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: { content: { 'multipart/form-data': { schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' }, caption: { type: 'string' } } } } } },
      responses: { 204: { description: 'ok' }, default: { description: 'e' } } } },
    '/chat': { post: { operationId: 'chat', requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { client_message_id: { type: 'string' }, text: { type: 'string' } } } } } },
      responses: { 200: { description: 'ok', content: { 'text/event-stream': { schema: { type: 'string' } } } }, default: { description: 'e' } } } },
  }, components: { schemas: { Pet: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' } } } } } };
  const { operations, problems } = analyze(doc, { hints: { unwrap: 'data', idempotencyKeys: { chat: 'client_message_id' } } });
  assert.equal(operations.listPets.unwrap, 'data');
  assert.deepEqual(operations.listPets.response, { t: 'array', items: { t: 'entity', name: 'Pet', replace: true } }); // the inner schema, not the envelope
  assert.equal(operations.uploadPhoto.multipart, true);
  assert.deepEqual(operations.uploadPhoto.bodyFields, [{ name: 'file', type: 'file', required: true }, { name: 'caption', type: 'string' }]);
  assert.equal(operations.chat.stream, true);
  assert.deepEqual(operations.chat.uuid, ['client_message_id']);
  assert.equal(problems.some((p) => p.code === 'XO170' || p.code === 'XO120'), false);
  const bad = analyze(doc, { hints: { idempotencyKeys: { chat: 'nope' } } });
  assert.equal(bad.problems.find((p) => p.code === 'XO170').level, 'error');
});

test('sync marks an entity\'s own schema as replace, shared and partial schemas as merge', () => {
  const obj = (extra = {}) => ({ type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' } }, ...extra });
  const doc = { openapi: '3.0.3', info: { title: 't', version: '1' }, paths: {
    '/a': { get: { operationId: 'a', responses: { 200: { description: 'ok', content: { 'application/json': { schema: { $ref: '#/components/schemas/Full' } } } }, default: { description: 'e' } } } },
    '/b': { get: { operationId: 'b', responses: { 200: { description: 'ok', content: { 'application/json': { schema: { $ref: '#/components/schemas/Summary' } } } }, default: { description: 'e' } } } },
    '/c': { get: { operationId: 'c', responses: { 200: { description: 'ok', content: { 'application/json': { schema: { $ref: '#/components/schemas/Part' } } } }, default: { description: 'e' } } } },
  }, components: { schemas: { Full: obj(), Summary: obj(), Part: obj({ 'x-xoong-partial': true }) } } };
  const { operations } = analyze(doc, { hints: { schemas: { Summary: { entity: 'Full' } } } });
  assert.deepEqual(operations.a.response, { t: 'entity', name: 'Full', replace: true });
  assert.deepEqual(operations.b.response, { t: 'entity', name: 'Full' });
  assert.deepEqual(operations.c.response, { t: 'entity', name: 'Part' });
});

test('composite ids from hints, and untagged unions resolved by a unique required property', () => {
  const obj = (props, required) => ({ type: 'object', required, properties: Object.fromEntries(props.map((p) => [p, { type: 'string' }])) });
  const json = (schema) => ({ description: 'ok', content: { 'application/json': { schema } } });
  const doc = { openapi: '3.0.3', info: { title: 't', version: '1' }, paths: {
    '/pods': { get: { operationId: 'pods', responses: { 200: json({ type: 'array', items: { $ref: '#/components/schemas/Pod' } }), default: { description: 'e' } } } },
    '/items': { get: { operationId: 'items', responses: { 200: json({ type: 'array', items: { oneOf: [{ $ref: '#/components/schemas/Issue' }, { $ref: '#/components/schemas/Pull' }] } }), default: { description: 'e' } } } },
    '/amb': { get: { operationId: 'amb', responses: { 200: json({ oneOf: [{ $ref: '#/components/schemas/Issue' }, { $ref: '#/components/schemas/Twin' }] }), default: { description: 'e' } } } },
  }, components: { schemas: {
    Pod: obj(['namespace', 'name'], ['namespace', 'name']),
    Issue: obj(['id', 'labels'], ['id', 'labels']), Pull: obj(['id', 'pull_request'], ['id', 'pull_request']), Twin: obj(['id', 'labels'], ['id']),
  } } };
  const a = analyze(doc, { hints: { schemas: { Pod: { id: ['namespace', 'name'] } } } });
  assert.deepEqual(a.entities.Pod.id, ['namespace', 'name']);
  assert.deepEqual(a.operations.items.response.items, { t: 'union', has: [['labels', { t: 'entity', name: 'Issue', replace: true }], ['pull_request', { t: 'entity', name: 'Pull', replace: true }]] });
  assert.equal(a.operations.amb.response, undefined); // no member can be recognised: stays unresolved
  assert.ok(a.problems.some((p) => p.code === 'XO160'));
  const bad = analyze(doc, { hints: { schemas: { Pod: { id: ['namespace', 'nope'] } } } });
  assert.equal(bad.problems.find((p) => p.code === 'XO101').level, 'error');
});

test('xoong render prerenders a page through @xoong/ssr', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'xoong-render-'));
  const { createServer } = await import('node:http');
  const api = createServer((req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify([{ id: 1, name: 'Ada' }])); });
  await new Promise((r) => api.listen(0, '127.0.0.1', r));
  try {
    const ops = join(dir, 'operations.json');
    await sync(fixture, { out: dir });
    const page = join(dir, 'page.html');
    await (await import('node:fs/promises')).writeFile(page, '<!doctype html><html><body><xo-view get="/users"><b xo-each=".">{name}</b></xo-view></body></html>');
    const out = join(dir, 'out.html');
    const { stdout } = await run(process.execPath, [new URL('../src/cli.js', import.meta.url).pathname, 'render', page, '--api', `http://127.0.0.1:${api.address().port}`, '--operations', ops, '--out', out]);
    assert.match(stdout, /rendered/);
    assert.match(await readFile(out, 'utf8'), /<b[^>]*>Ada<\/b>/);
  } finally { api.close(); }
}, 30000);
