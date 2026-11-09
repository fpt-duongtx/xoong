import { it, expect, afterEach } from 'vitest';
import { mount, mockApi, respond } from '@xoong/test';

const table = {
  version: 1,
  entities: { User: { id: 'id' } },
  operations: { createUser: { id: 'createUser', method: 'POST', path: '/users', body: true, response: { t: 'entity', name: 'User' } } },
};
let screen;
afterEach(() => screen?.unmount());

it('a Laravel-style 422 marks the field it names, with no summary line', async () => {
  const api = mockApi(table, { createUser: () => respond(422, { message: 'The given data was invalid.', errors: { email: ['The email has already been taken.'] } }) });
  screen = await mount('<xo-view><form xo-submit="createUser"><input name="name"><input name="email"><button>go</button></form></xo-view>', { api });
  screen.$('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await screen.settle();
  expect(screen.text('[name=email] + .xo-error')).toBe('The email has already been taken.');
  expect(screen.$('[name=email]').getAttribute('aria-invalid')).toBe('true');
  expect(screen.$('[data-xo-summary]')).toBeNull();
  expect(screen.errors[0].fields).toEqual({ email: 'The email has already been taken.' });
});
