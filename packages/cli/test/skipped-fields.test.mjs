import { describe, it, expect } from 'vitest';
import assert from 'node:assert/strict';
import { analyze } from '../src/index.js';
import { checkHtml } from '../src/check.js';

const obj = (props, required = []) => ({ type: 'object', required, properties: props });
const doc = { openapi: '3.0.3', info: { title: 't', version: '1' }, paths: {
  '/articles': { post: { operationId: 'createArticle',
    requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/NewArticle' } } } },
    responses: { default: { description: 'e' } } } },
}, components: { schemas: {
  NewArticle: obj({
    slug: { type: 'string' },
    title: obj({ en: { type: 'string' }, vi: { type: 'string' } }, ['en']), // required nested object
    tags: { type: 'array', items: { type: 'string' } },
    blocks: { oneOf: [{ type: 'object', properties: { type: { const: 'a' } } }] },
    createdAt: { type: 'string', readOnly: true },
  }, ['slug', 'title']),
} } };

describe('required body fields that a generated form cannot produce', () => {
  it('sync lists nested objects, arrays and unions (not read-only fields) with their required flag', () => {
    const { operations } = analyze(doc);
    assert.deepEqual(operations.createArticle.bodySkipped, [
      { name: 'title', type: 'object', required: true },
      { name: 'tags', type: 'array' },
      { name: 'blocks', type: 'union' },
    ]);
    assert.deepEqual(operations.createArticle.bodyFields.map((f) => f.name), ['slug']);
  });

  it('xoong check warns (XO255) only when there is no request schema to generate nested fields from, and stays quiet when only optional ones are skipped', () => {
    const { operations } = analyze(doc);
    expect(checkHtml('<xo-form op="createArticle"></xo-form>', { operations })).toEqual([]); // a request schema exists: nested fields are drawn
    const noSchema = { createArticle: { ...operations.createArticle, bodySchema: undefined } }; // as for a multipart body
    const f = checkHtml('<xo-form op="createArticle"></xo-form>', { operations: noSchema });
    expect(f.map((x) => x.code)).toEqual(['XO255']);
    expect(f[0].level).toBe('warn');
    expect(f[0].message).toContain('title (object)');
    const table = { operations };
    const optionalOnly = analyze({ ...doc, components: { schemas: { NewArticle: obj({ slug: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, ['slug']) } } });
    expect(checkHtml('<xo-form op="createArticle"></xo-form>', { operations: optionalOnly.operations })).toEqual([]);
  });
});
