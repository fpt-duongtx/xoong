import { it, expect, afterEach, vi } from 'vitest';
import { mount, mockApi } from '@xoong/test';

const table = {
  version: 1,
  entities: {},
  operations: { listJ: { id: 'listJ', method: 'GET', path: '/j', query: ['page[number]', 'filter[status]', 'filter[q]', 'sort'], response: null } },
};
let screen;
afterEach(() => { screen?.unmount(); vi.restoreAllMocks(); });
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));

it('xo-param takes bracketed names (JSON:API filter[status], page[number]): buttons and inputs', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const api = mockApi(table, { listJ: () => ({ ok: 1 }) });
  screen = await mount('<xo-view get="listJ" p-page[number]="2"><button id="b" xo-param="filter[status]=open">x</button><button id="n" xo-param="page[number]+=1">n</button><button id="s" xo-param="sort-=1">s</button><input id="q" xo-param="filter[q]"></xo-view>', { api });
  expect(api.callsOf('listJ').at(-1).query).toEqual({ 'page[number]': '2' });
  screen.$('#b').click(); await screen.settle();
  expect(api.callsOf('listJ').at(-1).query).toEqual({ 'page[number]': '2', 'filter[status]': 'open' });
  expect(screen.$('#b').getAttribute('aria-current')).toBe('true'); // the active filter is marked like any other value button
  screen.$('#n').click(); await screen.settle();
  expect(api.callsOf('listJ').at(-1).query['page[number]']).toBe('3');
  const q = screen.$('#q'); q.value = 'ada'; q.dispatchEvent(new Event('input', { bubbles: true })); await wait(300); await screen.settle();
  expect(api.callsOf('listJ').at(-1).query['filter[q]']).toBe('ada');
  expect(error).not.toHaveBeenCalled(); // "is not name=value" is no longer reported for these
  screen.$('#s').click(); await screen.settle();
  expect(api.callsOf('listJ').at(-1).query.sort).toBe('0'); // a name ending in "-" before "=" still means "k-=n" (never below 0)
});
