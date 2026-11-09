// xoong.hints.json is typed by hand, and a typo in it used to do nothing without a word (`xoong sync` and `xoong doctor` say so now).
import { describe, it, expect } from 'vitest';
import { analyze, doctor } from '../src/index.js';
import { HINT_KEYS } from '../src/openapi.js';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const doc = { openapi: '3.0.3', info: { title: 't', version: '1' }, paths: {
  '/people': { post: { operationId: 'createPerson', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Person' } } } }, responses: { default: { description: 'e' } } } },
} , components: { schemas: { Person: { type: 'object', properties: { gid: { type: 'string' }, name: { type: 'string' }, clientId: { type: 'string' } } } } } };
const codes = (hints) => analyze(doc, { hints }).problems.filter((p) => /^XO17[12]$/.test(p.code));

describe('hints are validated', () => {
  it('XO171: a key that is not a hint, with the closest one', () => {
    const [p] = codes({ idName: ['gid'] });
    expect(p).toMatchObject({ level: 'warn', code: 'XO171', where: 'hints.idName' });
    expect(p.message).toContain('closest: "idNames"');
    expect(p.fix).toBe('Use "idNames"');
    expect(codes({ zzzzzzzz: 1 })[0].fix).toBe(`Use one of ${HINT_KEYS.join(', ')}`);
  });

  it('every documented key is accepted', () => {
    expect(HINT_KEYS).toEqual(['idNames', 'schemas', 'unwrap', 'idempotencyKeys', 'fields']);
    expect(codes({ idNames: ['gid'], schemas: { Person: { id: 'gid' } }, unwrap: 'data', idempotencyKeys: { createPerson: 'clientId' }, fields: { 'Person.name': { label: 'Full name' } } })).toEqual([]);
    expect(codes(undefined)).toEqual([]);
  });

  it('XO172: a fields key must be "Schema.property" of the document', () => {
    expect(codes({ fields: { 'Nobody.name': { label: 'x' } } })[0]).toMatchObject({ code: 'XO172', where: 'hints.fields.Nobody.name', message: 'the schema "Nobody" does not exist' });
    const prop = codes({ fields: { 'Person.nmae': { label: 'x' } } })[0];
    expect(prop.message).toBe('"Person" has no property "nmae"');
    expect(prop.fix).toBe('Use "Person.name"');
    expect(codes({ fields: { Person: { label: 'x' } } })[0].message).toContain('is not "Schema.property"');
    expect(codes({ fields: { 'Person.name.en': { label: 'x' } } })).toEqual([]); // a nested path starts at a property that exists
  });

  it('XO172: idempotencyKeys must name an operation of the document', () => {
    const [p] = codes({ idempotencyKeys: { createPersn: 'clientId' } });
    expect(p).toMatchObject({ code: 'XO172', where: 'hints.idempotencyKeys.createPersn' });
    expect(p.fix).toBe('Use "createPerson"');
  });

  it('doctor prints them, with the fix', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'xoong-hints-'));
    await writeFile(join(dir, 'api.json'), JSON.stringify(doc));
    await writeFile(join(dir, 'hints.json'), JSON.stringify({ idName: ['gid'] }));
    const { text, errors } = await doctor(join(dir, 'api.json'), { hints: join(dir, 'hints.json') });
    expect(errors).toBe(0);
    expect(text).toMatch(/warn XO171 hints\.idName[\s\S]*fix: Use "idNames"/);
  });
});
