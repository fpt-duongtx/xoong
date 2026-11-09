// Several checkboxes with one `name` over an array node bind to membership in the array (a checked box = its value is in the list).
import { describe, it, expect, afterEach } from 'vitest';
import { mount, mockApi } from '@xoong/test';
import '@xoong/forms';

const str = (extra = {}) => ({ t: 'string', ...extra });
const schema = {
  t: 'object', required: ['name', 'roles'],
  props: {
    name: str(),
    roles: { t: 'array', minItems: 1, items: str({ enum: ['admin', 'editor', 'viewer'] }) },
    levels: { t: 'array', items: { t: 'integer', enum: [1, 2, 3] } },
    agree: { t: 'boolean' },
  },
};
const table = {
  version: 1, entities: { User: { id: 'id' } },
  operations: {
    getUser: { id: 'getUser', method: 'GET', path: '/users/{id}', response: { t: 'entity', name: 'User' } },
    updateUser: { id: 'updateUser', method: 'PUT', path: '/users/{id}', body: true, response: { t: 'entity', name: 'User' }, bodySchema: schema },
    createUser: { id: 'createUser', method: 'POST', path: '/users', body: true, response: { t: 'entity', name: 'User' }, bodySchema: schema },
  },
};
const GROUP = `<input name="name"><label><input type="checkbox" name="roles" value="admin"></label><label><input type="checkbox" name="roles" value="editor"></label><label><input type="checkbox" name="roles" value="viewer"></label>
  <input type="checkbox" name="levels" value="1"><input type="checkbox" name="levels" value="2"><input type="checkbox" name="agree"><button>Save</button>`;
let screen;
afterEach(() => screen?.unmount());
const boxes = (name) => screen.$$(`[name=${name}]`);
const toggle = async (name, i) => { boxes(name)[i].click(); await screen.settle(); };
const checked = (name) => boxes(name).map((b) => b.checked);

describe('a group of checkboxes sharing a name', () => {
  it('shows the array of the record: a box is checked when its value is in it', async () => {
    const api = mockApi(table, { getUser: () => ({ id: 1, name: 'Ada', roles: ['editor', 'viewer'], levels: [2] }) });
    screen = await mount(`<xo-view get="getUser" p-id="1"><form xo-submit="updateUser">${GROUP}</form></xo-view>`, { api });
    expect(checked('roles')).toEqual([false, true, true]);
    expect(checked('levels')).toEqual([false, true]); // "2" (the box) is 2 (the item)
    expect(screen.$('form').model.dirty).toBe(false);
  });

  it('clicking adds and removes the value; the model holds an array (typed by the item schema), not a boolean, and the form is valid', async () => {
    const api = mockApi(table, { getUser: () => ({ id: 1, name: 'Ada', roles: ['admin'] }), updateUser: ({ body }) => ({ id: 1, ...body }) });
    screen = await mount(`<xo-view get="getUser" p-id="1"><form xo-submit="updateUser">${GROUP}</form></xo-view>`, { api });
    const model = screen.$('form').model;
    await toggle('roles', 1);
    expect(model.get('roles')).toEqual(['admin', 'editor']);
    await toggle('roles', 0);
    expect(model.get('roles')).toEqual(['editor']);
    expect(model.dirty).toBe(true);
    await toggle('levels', 1); await toggle('levels', 0);
    expect(model.get('levels')).toEqual([2, 1]); // integers, in the order they were ticked
    await toggle('roles', 0); await toggle('roles', 1);
    expect(model.get('roles')).toEqual(['admin']);
    await screen.submit('form');
    expect(api.callsOf('updateUser')[0].body).toEqual({ name: 'Ada', roles: ['admin'], levels: [2, 1] });
    expect(screen.$('[data-xo-error]')).toBeNull();
  });

  it('an unchecked group fails the schema (minItems) on the array, not with "This value is not valid."', async () => {
    const api = mockApi(table, { createUser: ({ body }) => ({ id: 2, ...body }) });
    screen = await mount(`<xo-view><form xo-submit="createUser">${GROUP}</form></xo-view>`, { api });
    screen.$('[name=name]').value = 'Zed'; screen.$('[name=name]').dispatchEvent(new Event('input', { bubbles: true }));
    await screen.submit('form');
    expect(api.callsOf('createUser')).toHaveLength(0);
    expect(screen.texts('[data-xo-error]').every((t) => t !== 'This value is not valid.')).toBe(true);
    expect(screen.$('form').model.errors.roles).toBeTruthy();
    await toggle('roles', 2);
    await screen.submit('form');
    expect(api.callsOf('createUser')[0].body).toEqual({ name: 'Zed', roles: ['viewer'] });
  });

  it('follows the model: set() and a refreshed record tick and untick the boxes; the boxes are not marked required', async () => {
    const api = mockApi(table, { getUser: () => ({ id: 1, name: 'Ada', roles: ['admin'] }) });
    screen = await mount(`<xo-view get="getUser" p-id="1"><form xo-submit="updateUser">${GROUP}</form></xo-view>`, { api });
    const model = screen.$('form').model;
    model.set('roles', ['viewer', 'editor'], { coerced: true });
    await screen.settle();
    expect(checked('roles')).toEqual([false, true, true]);
    expect(boxes('roles').some((b) => b.required)).toBe(false);
  });

  it('a single boolean checkbox is unchanged', async () => {
    const api = mockApi(table, { getUser: () => ({ id: 1, name: 'Ada', roles: ['admin'], agree: true }) });
    screen = await mount(`<xo-view get="getUser" p-id="1"><form xo-submit="updateUser">${GROUP}</form></xo-view>`, { api });
    expect(screen.$('[name=agree]').checked).toBe(true);
    await toggle('agree', 0);
    expect(screen.$('form').model.get('agree')).toBe(false);
  });
});
