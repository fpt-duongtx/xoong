import { describe, it, expect, afterEach } from 'vitest';
import { mount, mockApi, respond } from '@xoong/test';

const table = {
  version: 1,
  entities: { User: { id: 'id' } },
  operations: {
    listUsers: { id: 'listUsers', method: 'GET', path: '/users', query: ['limit', 'offset'], response: { t: 'object', props: { items: { t: 'array', items: { t: 'entity', name: 'User' } }, total: { t: 'integer' } } } },
    deleteUser: { id: 'deleteUser', method: 'DELETE', path: '/users/{id}', response: null },
  },
};
let screen;
afterEach(() => { screen?.unmount(); history.replaceState(null, '', '/'); });
const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const backend = (n) => {
  let rows = Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `U${i + 1}` }));
  return mockApi(table, {
    listUsers: ({ query }) => { const o = Number(query.offset ?? 0), l = Number(query.limit ?? 2); return { items: rows.slice(o, o + l), total: rows.length }; },
    deleteUser: ({ params }) => { rows = rows.filter((r) => r.id !== Number(params.id)); return respond(204, null); },
  });
};
const view = `<xo-view get="listUsers" p-limit="2" p-offset="4"><b xo-each="items">{name}</b><i id="range">{$from}-{$to}</i></xo-view>`;

describe('a page past the end of the list', () => {
  it('goes to the last page that exists when the total shrank (deleting the only row of the last page)', async () => {
    const api = backend(5);
    screen = await mount(`<xo-view get="listUsers" p-limit="2" p-offset="4"><p xo-each="items"><b>{name}</b><button type="button" xo-click="DELETE /users/{id}">d</button></p><i id="range">{$from}-{$to}</i></xo-view>`, { api });
    expect(screen.texts('b')).toEqual(['U5']);
    screen.$('button').click();
    await screen.settle(); await wait(60); await screen.settle();
    expect(screen.texts('b')).toEqual(['U3', 'U4']); // not an empty page
    expect(screen.text('#range')).toBe('3-4');
    expect(api.callsOf('listUsers').at(-1).query).toEqual({ limit: '2', offset: '2' });
  });
  it('an offset beyond the total (an old link) is clamped to the last page; an empty list goes back to offset 0', async () => {
    screen = await mount(view.replace('p-offset="4"', 'p-offset="40"'), { api: backend(5) });
    await wait(60); await screen.settle();
    expect(screen.texts('b')).toEqual(['U5']);
    screen.unmount();
    const none = backend(0);
    screen = await mount(view.replace('p-offset="4"', 'p-offset="40"'), { api: none });
    await wait(60); await screen.settle();
    expect(none.callsOf('listUsers').at(-1).query).toEqual({ limit: '2', offset: '0' }); // offset 0 is a first page, not "no offset"
  });
  it('leaves a valid offset alone and makes no extra request', async () => {
    const api = backend(5);
    screen = await mount(view, { api });
    await wait(60);
    expect(api.callsOf('listUsers')).toHaveLength(1);
  });
});
