import { describe, it, expect } from 'vitest';
import { analyze } from '../src/index.js';
import { bodySchemaOf } from '../src/body-schema.js';

const json = (schema) => ({ content: { 'application/json': { schema } } });
const doc = (schemas, bodyRef = 'Input') => ({ openapi: '3.0.3', info: { title: 't', version: '1' },
  paths: { '/x': { post: { operationId: 'create', requestBody: json({ $ref: `#/components/schemas/${bodyRef}` }), responses: { default: { description: 'e' } } } } },
  components: { schemas } });
const bodySchema = (schemas, hints, ref) => analyze(doc(schemas, ref), { hints }).operations.create.bodySchema;

describe('bodySchema in operations.json', () => {
  it('describes primitives with their constraints, nested objects, arrays and required lists', () => {
    const s = bodySchema({ Input: { type: 'object', required: ['slug', 'title'], properties: {
      slug: { type: 'string', pattern: '^[a-z]+$', minLength: 3, maxLength: 12, description: 'URL part' },
      title: { type: 'object', required: ['en'], properties: { en: { type: 'string' }, vi: { type: 'string' } } },
      rating: { type: 'integer', minimum: 1, maximum: 5, default: 3 },
      price: { type: 'number', minimum: 0, exclusiveMinimum: true, multipleOf: 0.5 },
      email: { type: 'string', format: 'email' },
      kind: { type: 'string', enum: ['a', 'b'] },
      tags: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5, uniqueItems: true },
      createdAt: { type: 'string', readOnly: true },
    } } });
    expect(s.t).toBe('object');
    expect(s.required).toEqual(['slug', 'title']);
    expect(s.props.slug).toEqual({ t: 'string', pattern: '^[a-z]+$', minLength: 3, maxLength: 12, description: 'URL part' });
    expect(s.props.title).toEqual({ t: 'object', required: ['en'], props: { en: { t: 'string' }, vi: { t: 'string' } } });
    expect(s.props.rating).toEqual({ t: 'integer', minimum: 1, maximum: 5, default: 3 });
    expect(s.props.price).toEqual({ t: 'number', exclusiveMinimum: 0, multipleOf: 0.5 }); // OpenAPI 3.0 boolean form converted
    expect(s.props.tags).toEqual({ t: 'array', items: { t: 'string' }, minItems: 1, maxItems: 5, uniqueItems: true });
    expect(s.props.createdAt).toEqual({ t: 'string', readOnly: true });
    expect(s.props.kind.enum).toEqual(['a', 'b']);
  });

  it('follows $ref and allOf, and understands nullable in 3.0 and 3.1 style and anyOf with null', () => {
    const s = bodySchema({
      Base: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
      Localized: { type: 'object', properties: { en: { type: 'string' } } },
      Input: { allOf: [{ $ref: '#/components/schemas/Base' }, { type: 'object', required: ['name'], properties: { name: { type: 'string', nullable: true }, note: { type: ['string', 'null'] }, loc: { anyOf: [{ $ref: '#/components/schemas/Localized' }, { type: 'null' }] } } }] },
    });
    expect(s.required.sort()).toEqual(['id', 'name']);
    expect(s.props.id.t).toBe('integer');
    expect(s.props.name).toEqual({ t: 'string', nullable: true });
    expect(s.props.note).toEqual({ t: 'string', nullable: true });
    expect(s.props.loc).toEqual({ t: 'object', props: { en: { t: 'string' } }, nullable: true });
  });

  it('a union is told apart by a discriminator (with mapping) or by a property every member fixes', () => {
    const members = { Text: { type: 'object', required: ['type', 'body'], properties: { type: { type: 'string', enum: ['text'] }, body: { type: 'string' } } }, Image: { type: 'object', required: ['type', 'url'], properties: { type: { type: 'string', enum: ['image'] }, url: { type: 'string', format: 'uri' } } } };
    const byTag = bodySchema({ ...members, Input: { type: 'object', properties: { blocks: { type: 'array', items: { oneOf: [{ $ref: '#/components/schemas/Text' }, { $ref: '#/components/schemas/Image' }] } } } } });
    const u = byTag.props.blocks.items;
    expect(u.t).toBe('union');
    expect(u.key).toBe('type');
    expect(Object.keys(u.map)).toEqual(['text', 'image']);
    expect(u.map.image.props.url.format).toBe('uri');
    const mapped = bodySchema({ ...members, Input: { type: 'object', properties: { b: { oneOf: [{ $ref: '#/components/schemas/Text' }, { $ref: '#/components/schemas/Image' }], discriminator: { propertyName: 'type', mapping: { t: '#/components/schemas/Text', i: '#/components/schemas/Image' } } } } } });
    expect(Object.keys(mapped.props.b.map)).toEqual(['t', 'i']);
  });

  it('what cannot be described stays any (free-form objects, ambiguous unions); cycles are cut', () => {
    const s = bodySchema({
      Node: { type: 'object', properties: { next: { $ref: '#/components/schemas/Node' }, v: { type: 'string' } } },
      Input: { type: 'object', properties: { free: { type: 'object', additionalProperties: true }, amb: { oneOf: [{ type: 'object', properties: { a: { type: 'string' } } }, { type: 'object', properties: { b: { type: 'string' } } }] }, tree: { $ref: '#/components/schemas/Node' } } },
    });
    expect(s.props.free.t).toBe('any');
    expect(s.props.amb.t).toBe('any');
    let depth = 0;
    for (let n = s.props.tree; n?.t === 'object'; n = n.props.next) depth++;
    expect(depth).toBeGreaterThan(2);
    expect(depth).toBeLessThan(15); // cut, not infinite
  });

  it('is only written for JSON object bodies (not arrays, not multipart)', () => {
    const arr = analyze({ openapi: '3.0.3', info: { title: 't', version: '1' }, paths: { '/x': { post: { operationId: 'create', requestBody: json({ type: 'array', items: { type: 'string' } }), responses: { default: { description: 'e' } } } } } });
    expect(arr.operations.create.bodySchema).toBeUndefined();
    expect(bodySchemaOf({ type: 'string' }, {})).toBeUndefined();
  });

  it('hints: field presentation keys become node fields, unknown keys are passed through in `hints`, schema hints reach the object node', () => {
    const s = bodySchema({ Input: { type: 'object', properties: { slug: { type: 'string' }, title: { $ref: '#/components/schemas/Localized' }, cover: { type: 'string' } } }, Localized: { type: 'object', properties: { en: { type: 'string' }, vi: { type: 'string' } } } }, {
      schemas: { Localized: { pruneEmpty: true, emptyAs: 'null', localized: true, locales: ['en', 'vi'] } },
      fields: {
        'Input.slug': { label: 'Slug', hint: 'Lowercase', placeholder: 'my-slug', order: 20, group: 'SEO', from: 'title.en' },
        'Input.cover': { widget: 'rl-image-field', recommendedSize: '1200x630', hidden: true, readOnly: true },
      },
    });
    expect(s.props.slug).toEqual({ t: 'string', title: 'Slug', description: 'Lowercase', placeholder: 'my-slug', order: 20, group: 'SEO', hints: { from: 'title.en' } });
    expect(s.props.cover).toEqual({ t: 'string', widget: 'rl-image-field', hidden: true, readOnly: true, hints: { recommendedSize: '1200x630' } });
    expect(s.props.title.pruneEmpty).toBe(true);
    expect(s.props.title.emptyAs).toBe('null');
    expect(s.props.title.hints).toEqual({ localized: true, locales: ['en', 'vi'] });
  });

  it('x-xoong-widget on the schema is read as the widget', () => {
    const s = bodySchema({ Input: { type: 'object', properties: { body: { type: 'string', 'x-xoong-widget': 'richtext' } } } });
    expect(s.props.body.widget).toBe('richtext');
  });
});
