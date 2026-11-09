import { describe, it, expect, afterEach } from 'vitest';
import { mount, mockApi, respond } from '@xoong/test';
import '@xoong/ui';

const table = {
  version: 1,
  entities: { User: { id: 'id' } },
  operations: {
    listUsers: { id: 'listUsers', method: 'GET', path: '/users', response: { t: 'array', items: { t: 'entity', name: 'User' } } },
    createUser: { id: 'createUser', method: 'POST', path: '/users', body: true, response: { t: 'entity', name: 'User' }, bodySchema: { t: 'object', required: ['name'], props: { name: { t: 'string' } } } },
    deleteUser: { id: 'deleteUser', method: 'DELETE', path: '/users/{id}', response: null },
  },
};
let screen;
afterEach(() => { screen?.unmount(); });
const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const api = (create = ({ body }) => ({ id: 1, ...body })) => {
  let rows = [{ id: 1, name: 'Ada' }];
  return mockApi(table, { listUsers: () => rows, createUser: create, deleteUser: () => { rows = []; return respond(204, null); } });
};
const submit = async (form) => {
  const input = form.querySelector('[name=name]');
  input.value = 'x';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await screen.settle(); await wait(60);
};

describe('xo-done and xo-error bubble from the element that ran the action', () => {
  it('a dialog inside the same <xo-view> as its form closes when the form succeeds', async () => {
    screen = await mount('<xo-view><button type="button" xo-open="#d">open</button><xo-dialog id="d"><xo-form op="createUser" submit="Add"></xo-form></xo-dialog></xo-view>', { api: api() });
    await wait(30);
    screen.$('button[xo-open]').click(); await wait(10);
    expect(screen.$('dialog').open).toBe(true);
    await submit(screen.$('form'));
    expect(screen.$('dialog').open).toBe(false);
  });
  it('the layout with the view inside the dialog still closes it, and a listener on the view still gets the event', async () => {
    screen = await mount('<button type="button" xo-open="#d">open</button><xo-dialog id="d"><xo-view><xo-form op="createUser" submit="Add"></xo-form></xo-view></xo-dialog>', { api: api() });
    const seen = [];
    screen.$('xo-view').addEventListener('xo-done', (e) => seen.push(e.detail));
    await wait(30);
    screen.$('button[xo-open]').click(); await wait(10);
    await submit(screen.$('form'));
    expect(screen.$('dialog').open).toBe(false);
    expect(seen).toEqual([{ id: 1, name: 'x' }]);
  });
  it('xo-error also passes through the elements between the form and the view', async () => {
    screen = await mount('<xo-view><div id="mid"><form xo-submit="createUser"><input name="name"></form></div></xo-view>', { api: api(() => respond(500, { title: 'Boom' })) });
    const seen = [];
    screen.$('#mid').addEventListener('xo-error', (e) => seen.push(e.detail.status));
    await submit(screen.$('form'));
    expect(seen).toEqual([500]);
    expect(screen.errors).toHaveLength(1); // still reaches a listener above the view
  });
  it('an action whose element is removed by its own result (delete a row) still reports xo-done to the page', async () => {
    screen = await mount('<xo-view get="listUsers"><p xo-each="."><b>{name}</b><button type="button" xo-click="DELETE /users/{id}">d</button></p></xo-view>', { api: api() });
    const seen = [];
    screen.container.addEventListener('xo-done', () => seen.push('done'));
    screen.$('button').click();
    await screen.settle(); await wait(60);
    expect(screen.$('button')).toBeNull();
    expect(seen).toEqual(['done']);
  });
});
