// A native reset (a `<button type="reset">`, `form.reset()`) empties the controls: the model must go back to its baseline with them,
// and the controls show the baseline again (otherwise Save sends the old values from a blank screen).
// The browser resets the controls AFTER the `reset` event, happy-dom before it: the tests below empty the controls after the event
// themselves to behave like a browser (the real-Chromium order is covered by native-reset.test.mjs).
import { describe, it, expect, afterEach } from 'vitest';
import { mount, mockApi } from '@xoong/test';
import '@xoong/forms';

const str = (extra = {}) => ({ t: 'string', ...extra });
const schema = { t: 'object', required: ['name'], props: { name: str({ minLength: 2 }), email: str(), agree: { t: 'boolean' }, kind: str({ enum: ['a', 'b'] }) } };
const table = {
  version: 1, entities: { User: { id: 'id' } },
  operations: {
    getUser: { id: 'getUser', method: 'GET', path: '/users/{id}', response: { t: 'entity', name: 'User' } },
    updateUser: { id: 'updateUser', method: 'PUT', path: '/users/{id}', body: true, response: { t: 'entity', name: 'User' }, bodySchema: schema },
    createUser: { id: 'createUser', method: 'POST', path: '/users', body: true, response: { t: 'entity', name: 'User' }, bodySchema: schema },
  },
};
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
let screen;
afterEach(() => screen?.unmount());
const FIELDS = '<input name="name"><input name="email"><input type="checkbox" name="agree"><select name="kind"></select><button type="reset">Reset</button><button>Save</button>';
const type = async (sel, v) => { const el = screen.$(sel); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); await screen.settle(); };
/** What a browser does when the reset button is pressed: the event first, the controls emptied after it. */
const nativeReset = async (form) => {
  const event = new Event('reset', { bubbles: true, cancelable: true });
  form.dispatchEvent(event);
  if (!event.defaultPrevented) for (const el of form.elements) { if (el.type === 'checkbox') el.checked = false; else if (el.tagName !== 'BUTTON') el.value = ''; }
  await tick(5);
  await screen.settle();
};

describe('native reset', () => {
  it('an edit form goes back to the record: the controls show it, the model is pristine, and Save sends the record, not the old draft', async () => {
    const api = mockApi(table, { getUser: () => ({ id: 1, name: 'Ada', email: 'a@x.io', agree: true, kind: 'b' }), updateUser: ({ body }) => ({ id: 1, ...body }) });
    screen = await mount(`<xo-view get="getUser" p-id="1"><form xo-submit="updateUser">${FIELDS}</form></xo-view>`, { api });
    await type('[name=name]', 'Grace');
    await type('[name=email]', 'g@x.io');
    screen.$('[name=agree]').checked = false; screen.$('[name=agree]').dispatchEvent(new Event('change', { bubbles: true }));
    const form = screen.$('form');
    expect(form.model.dirty).toBe(true);
    await nativeReset(form);
    expect([screen.$('[name=name]').value, screen.$('[name=email]').value, screen.$('[name=agree]').checked, screen.$('[name=kind]').value]).toEqual(['Ada', 'a@x.io', true, 'b']);
    expect([form.model.dirty, form.model.get('name')]).toEqual([false, 'Ada']);
    await screen.submit('form');
    expect(api.callsOf('updateUser')[0].body).toEqual({ name: 'Ada', email: 'a@x.io', agree: true, kind: 'b' });
  });

  it('a create form goes back to empty, untouched, without errors; Save then reports what is missing instead of sending the old draft', async () => {
    const api = mockApi(table, { createUser: ({ body }) => ({ id: 9, ...body }) });
    screen = await mount(`<xo-view><form xo-submit="createUser">${FIELDS}</form></xo-view>`, { api });
    await type('[name=name]', 'Grace');
    screen.$('[name=name]').dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await type('[name=email]', 'g@x.io');
    await nativeReset(screen.$('form'));
    expect([screen.$('[name=name]').value, screen.$('[name=email]').value, screen.$('form').model.dirty]).toEqual(['', '', false]);
    expect(screen.$('[data-xo-error]')).toBeNull();
    await screen.submit('form');
    expect(api.callsOf('createUser')).toHaveLength(0);
    expect(screen.text('[data-xo-error]')).toBe('Please fill in this field.');
  });

  it('form.reset() from code does the same', async () => {
    const api = mockApi(table, { getUser: () => ({ id: 1, name: 'Ada', email: 'a@x.io' }) });
    screen = await mount(`<xo-view get="getUser" p-id="1"><form xo-submit="updateUser">${FIELDS}</form></xo-view>`, { api });
    await type('[name=name]', 'Grace');
    screen.$('form').reset();
    await tick(5);
    expect([screen.$('[name=name]').value, screen.$('form').model.dirty]).toEqual(['Ada', false]);
  });

  it('a reset somebody cancels (preventDefault) changes nothing', async () => {
    const api = mockApi(table, { getUser: () => ({ id: 1, name: 'Ada', email: 'a@x.io' }) });
    screen = await mount(`<xo-view get="getUser" p-id="1"><form xo-submit="updateUser">${FIELDS}</form></xo-view>`, { api });
    screen.$('form').addEventListener('reset', (e) => e.preventDefault());
    await type('[name=name]', 'Grace');
    await nativeReset(screen.$('form'));
    expect([screen.$('[name=name]').value, screen.$('form').model.get('name'), screen.$('form').model.dirty]).toEqual(['Grace', 'Grace', true]);
  });
});
