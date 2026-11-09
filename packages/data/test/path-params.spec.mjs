import { describe, it, expect, afterEach, vi } from 'vitest';
import { mount, mockApi } from '@xoong/test';
import { fillPath } from '../src/invalidate.js';

const table = {
  version: 1,
  entities: { User: { id: 'id' } },
  operations: { getUser: { id: 'getUser', method: 'GET', path: '/users/{id}', response: { t: 'entity', name: 'User' } } },
};
let screen;
afterEach(() => { screen?.unmount(); vi.restoreAllMocks(); });
const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));

describe('an empty path parameter is a missing one', () => {
  it('fillPath refuses "" (it would build /users/), but accepts 0 and false-looking text', () => {
    expect(() => fillPath('/users/{id}', { id: '' }, 'getUser')).toThrow(/needs path parameter "id"/);
    expect(() => fillPath('/users/{id}', {}, 'getUser')).toThrow(/needs path parameter "id"/);
    expect(fillPath('/users/{id}', { id: 0 })).toBe('/users/0');
    expect(fillPath('/users/{id}', { id: 'false' })).toBe('/users/false');
  });
  it('<xo-view p-id=""> sends no request, warns once naming the parameter, and loads once the param is set', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = mockApi(table, { getUser: ({ params }) => ({ id: Number(params.id), name: `U${params.id}` }) });
    const urls = [];
    const inner = api.fetch;
    api.fetch = (url, init) => { urls.push(String(url)); return inner(url, init); };
    screen = await mount('<xo-view get="getUser" p-id=""><b>{name}</b></xo-view>', { api });
    await wait();
    expect(urls).toEqual([]); // not GET /users/
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('{id}'))).toHaveLength(1);
    expect(String(warn.mock.calls[0][0])).toContain('p-id');
    screen.$('xo-view').params = { id: '7' };
    await screen.settle(); await wait();
    expect(screen.text('b')).toBe('U7');
    expect(urls).toEqual(['/users/7']);
  });
});
