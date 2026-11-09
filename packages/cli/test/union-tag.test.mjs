// A oneOf with a `discriminator` and no `mapping`: when the members fix the tag themselves (`kind: { enum: ['card'] }`), the wire value is "card",
// not the schema name "Card". The union is keyed by what the member fixes; an explicit mapping still wins; a member that fixes nothing keeps its schema name.
import { describe, it, expect } from 'vitest';
import { analyze } from '../src/index.js';
import { createForm } from '../../forms/src/form-model.js';

const ref = (n) => ({ $ref: `#/components/schemas/${n}` });
const json = (schema) => ({ content: { 'application/json': { schema } } });
const doc = (schemas, union) => ({ openapi: '3.0.3', info: { title: 't', version: '1' },
  paths: {
    '/users': { post: { operationId: 'createUser', requestBody: json(ref('UserInput')), responses: { 201: { description: 'ok' }, default: { description: 'e' } } } },
    '/pay': { get: { operationId: 'getPayment', responses: { 200: { description: 'ok', content: json(union).content }, default: { description: 'e' } } } },
  },
  components: { schemas: { ...schemas, UserInput: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, payment: union } } } } });
const pinned = {
  Card: { type: 'object', required: ['kind', 'last4'], properties: { id: { type: 'string' }, kind: { type: 'string', enum: ['card'] }, last4: { type: 'string' } } },
  Bank: { type: 'object', required: ['kind', 'iban'], properties: { id: { type: 'string' }, kind: { type: 'string', enum: ['bank'] }, iban: { type: 'string' } } },
};
const body = (schemas, union) => analyze(doc(schemas, union)).operations.createUser.bodySchema.props.payment;
const response = (schemas, union) => analyze(doc(schemas, union)).operations.getPayment.response;

describe('oneOf + discriminator without mapping', () => {
  const union = { oneOf: [ref('Card'), ref('Bank')], discriminator: { propertyName: 'kind' } };

  it('the request body is keyed by the values the members fix, not by the schema names', () => {
    const u = body(pinned, union);
    expect(u.t).toBe('union');
    expect(u.key).toBe('kind');
    expect(Object.keys(u.map)).toEqual(['card', 'bank']);
    expect(u.map.card.props.last4).toEqual({ t: 'string' });
    expect(u.map.bank.required).toEqual(['kind', 'iban']);
  });

  it('a form draft with kind "card" picks that member, validates, and keeps the member in the body', async () => {
    const schema = analyze(doc(pinned, union)).operations.createUser.bodySchema;
    const form = createForm({ schema, value: { name: 'Ada', payment: { kind: 'card', last4: '1234' } } });
    expect(await form.validate()).toEqual({});
    expect(form.body()).toEqual({ name: 'Ada', payment: { kind: 'card', last4: '1234' } });
    const bank = createForm({ schema, value: { name: 'Ada', payment: { kind: 'bank', iban: 'DE00' } } });
    expect(await bank.validate()).toEqual({});
    expect(bank.body().payment).toEqual({ kind: 'bank', iban: 'DE00' });
    const wrong = createForm({ schema, value: { name: 'Ada', payment: { kind: 'Card', last4: '1234' } } }); // the schema name is not a wire value
    expect(Object.keys(await wrong.validate())).toEqual(['payment.kind']);
  });

  it('const pins the tag too, also through a $ref to the property', () => {
    const u = body({
      Card: { type: 'object', properties: { kind: { const: 'card' }, last4: { type: 'string' } } },
      Bank: { type: 'object', properties: { kind: ref('BankKind'), iban: { type: 'string' } } },
      BankKind: { type: 'string', enum: ['bank'] },
    }, union);
    expect(Object.keys(u.map)).toEqual(['card', 'bank']);
  });

  it('an explicit mapping still wins over what the members fix', () => {
    const u = body(pinned, { oneOf: [ref('Card'), ref('Bank')], discriminator: { propertyName: 'kind', mapping: { c: '#/components/schemas/Card', b: '#/components/schemas/Bank' } } });
    expect(Object.keys(u.map)).toEqual(['c', 'b']);
  });

  it('a member that fixes nothing keeps its schema name (a mapping for only one member leaves the other to the rule)', () => {
    const loose = { ...pinned, Bank: { type: 'object', properties: { kind: { type: 'string' }, iban: { type: 'string' } } } };
    expect(Object.keys(body(loose, union).map)).toEqual(['card', 'Bank']);
    const none = { Card: { type: 'object', properties: { kind: { type: 'string' } } }, Bank: { type: 'object', properties: { kind: { type: 'string' } } } };
    expect(Object.keys(body(none, union).map)).toEqual(['Card', 'Bank']);
    expect(Object.keys(body(pinned, { oneOf: [ref('Card'), ref('Bank')], discriminator: { propertyName: 'kind', mapping: { c: '#/components/schemas/Card' } } }).map)).toEqual(['c', 'bank']);
  });

  it('two members that fix the same value stay apart, named after their schemas', () => {
    const same = { Card: pinned.Card, Debit: { ...pinned.Card, properties: { ...pinned.Card.properties, pin: { type: 'string' } } } };
    const u = body(same, { oneOf: [ref('Card'), ref('Debit')], discriminator: { propertyName: 'kind' } });
    expect(Object.keys(u.map)).toEqual(['Card', 'Debit']);
  });

  it('inline members still name themselves by the value they fix', () => {
    const u = body({}, { oneOf: [pinned.Card, pinned.Bank], discriminator: { propertyName: 'kind' } });
    expect(Object.keys(u.map)).toEqual(['card', 'bank']);
  });

  it('a response union of entities is keyed the same way, so a record with kind "card" is recognised', () => {
    const r = response(pinned, union);
    expect(r).toEqual({ t: 'union', key: 'kind', map: { card: { t: 'entity', name: 'Card', replace: true }, bank: { t: 'entity', name: 'Bank', replace: true } } });
    const plain = { Card: { type: 'object', properties: { id: { type: 'string' } } }, Bank: { type: 'object', properties: { id: { type: 'string' } } } };
    expect(Object.keys(response(plain, union).map)).toEqual(['Card', 'Bank']); // nothing fixed: the schema names, as the OpenAPI standard says
    expect(Object.keys(response(pinned, { ...union, discriminator: { propertyName: 'kind', mapping: { c: '#/components/schemas/Card', b: '#/components/schemas/Bank' } } }).map)).toEqual(['c', 'b']);
  });
});
