import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createClient } from '../src/index.js';
import { api, fakeFetch, json } from './helpers.mjs';

/** The `fields` and `detail` of the XoongError a 422 with this body produces. */
async function fail(body, status = 422) {
  const c = createClient({ api, fetch: fakeFetch({ 'POST /users': () => json(status, body) }), retry: 0 });
  return c.mutate('createUser', {}, {}).then(() => assert.fail('should reject'), (e) => ({ fields: e.fields, detail: e.detail }));
}

test('422 bodies of other back-ends put their messages on the fields', async () => {
  // Laravel and Rails: { message, errors: { field: [messages] } }; several messages for a field are shown together
  const laravel = await fail({ message: 'The given data was invalid.', errors: { email: ['The email has already been taken.'], 'address.zip': ['Too short.', 'Digits only.'] } });
  assert.deepEqual(laravel.fields, { email: 'The email has already been taken.', 'address.zip': 'Too short. Digits only.' });
  assert.equal(laravel.detail, 'The given data was invalid.');
  assert.deepEqual((await fail({ errors: { email: 'has already been taken' } })).fields, { email: 'has already been taken' }); // a plain string as the message
  // Django REST framework: { field: [messages] }, nested serializers and lists by position; non_field_errors is the summary
  const drf = await fail({ email: ['Enter a valid email address.'], address: { zip: ['Required.'] }, items: [{}, { name: ['Required.'] }], non_field_errors: ['Passwords differ.'] });
  assert.deepEqual(drf.fields, { email: 'Enter a valid email address.', 'address.zip': 'Required.', 'items.1.name': 'Required.' });
  assert.equal(drf.detail, 'Passwords differ.');
  // Spring: errors (or fieldErrors) as a list of { field, defaultMessage | message }
  assert.deepEqual((await fail({ timestamp: 'x', status: 400, error: 'Bad Request', errors: [{ field: 'email', defaultMessage: 'must be a well-formed email address', code: 'Email' }] }, 400)).fields, { email: 'must be a well-formed email address' });
  assert.deepEqual((await fail({ fieldErrors: [{ field: 'name', message: 'must not be blank' }] })).fields, { name: 'must not be blank' });
  // Zod flatten: { fieldErrors: { field: [messages] } }
  assert.deepEqual((await fail({ formErrors: [], fieldErrors: { email: ['Invalid'] } })).fields, { email: 'Invalid' });
  // JSON:API: errors with source.pointer into data/attributes
  assert.deepEqual((await fail({ errors: [{ status: '422', source: { pointer: '/data/attributes/email' }, detail: 'is taken' }, { source: { pointer: '/data/attributes/address/zip' }, title: 'x', detail: 'too short' }] })).fields, { email: 'is taken', 'address.zip': 'too short' });
});

test('the shapes that worked keep working, and a body that is not a field map adds no fields', async () => {
  assert.deepEqual((await fail({ detail: [{ loc: ['body', 'address', 'zip'], msg: 'too short' }] })).fields, { 'address.zip': 'too short' });
  assert.deepEqual((await fail({ error: { code: 'invalid', message: 'bad', fields: { email: 'taken' } } })).fields, { email: 'taken' });
  assert.deepEqual((await fail({ errors: [{ pointer: '#/name', detail: 'required' }, { field: 'age', message: 'too low' }] })).fields, { name: 'required', age: 'too low' });
  // RFC 9457 with extension members, an envelope, text: nothing here is a field
  assert.deepEqual((await fail({ type: 'about:blank', title: 'Invalid', status: 422, detail: 'name required', instance: '/users', balance: { current: 30 }, tags: ['a'] })).fields, {});
  assert.deepEqual((await fail({ title: 'nope' })).fields, {});
  assert.deepEqual((await fail(['a', 'b'])).fields, {});
  assert.deepEqual((await fail(null)).fields, {});
  // an explicit shape wins over the guess about a bare { field: [messages] } body
  assert.deepEqual((await fail({ errors: { email: ['a'] }, name: ['b'] })).fields, { email: 'a' });
});
