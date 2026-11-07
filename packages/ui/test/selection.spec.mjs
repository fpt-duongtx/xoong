import { describe, it, expect, afterEach } from 'vitest';
import { mount, mockApi, respond } from '@xoong/test';
import '@xoong/ui';

const table = {
  version: 1,
  entities: { User: { id: 'id' } },
  operations: {
    listUsers: { id: 'listUsers', method: 'GET', path: '/users', query: ['sort', 'limit', 'offset'], response: { t: 'object', props: { items: { t: 'array', items: { t: 'entity', name: 'User' } } } } },
    deleteUser: { id: 'deleteUser', method: 'DELETE', path: '/users/{id}', response: null },
  },
};
const all = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: `User ${i + 1}` }));
const list = ({ query }) => {
  const rows = [...all];
  if (query.sort) rows.sort((a, b) => a.name.localeCompare(b.name) * (query.sort.startsWith('-') ? -1 : 1));
  return { items: rows, total: all.length };
};

let screen;
afterEach(() => screen?.unmount());

const html = '<xo-view get="/users"><xo-table columns="name" selectable><button slot="bulk" xo-click="DELETE /users/{id}" xo-selected>Delete ticked</button></xo-table></xo-view>';
const tick = async (selector, on = true) => {
  const box = screen.$(selector);
  box.checked = on;
  box.dispatchEvent(new Event('change', { bubbles: true }));
  await screen.settle();
};

describe('<xo-table selectable> and bulk actions', () => {
  it('shows the bulk bar only while rows are ticked, with a count, and select-all ticks every row', async () => {
    screen = await mount(html, { api: mockApi(table, { listUsers: list }) });
    expect(screen.$('.xo-bulk')).toBeNull();
    await tick('tbody tr:nth-child(2) input[type=checkbox]');
    expect(screen.text('.xo-bulk span')).toBe('1 selected');
    await tick('thead input[type=checkbox]');
    expect(screen.text('.xo-bulk span')).toBe('5 selected');
    expect(screen.$$('tbody input:checked')).toHaveLength(5);
    await tick('thead input[type=checkbox]', false);
    expect(screen.$('.xo-bulk')).toBeNull();
  });

  it('a bulk button runs its operation once per ticked row, in order, then clears the selection', async () => {
    const api = mockApi(table, { listUsers: list, deleteUser: () => respond(204, null) });
    screen = await mount(html, { api });
    await tick('tbody tr:nth-child(1) input[type=checkbox]');
    await tick('tbody tr:nth-child(3) input[type=checkbox]');
    await screen.click('.xo-bulk button');
    expect(api.callsOf('deleteUser').map((c) => c.params.id)).toEqual(['1', '3']);
    expect(screen.$('.xo-bulk')).toBeNull();
    expect(screen.errors).toEqual([]);
  });

  it('the first failure stops the rest and keeps the selection', async () => {
    const api = mockApi(table, { listUsers: list, deleteUser: ({ params }) => (params.id === '1' ? respond(409, { title: 'Conflict' }) : respond(204, null)) });
    screen = await mount(html, { api });
    await tick('tbody tr:nth-child(1) input[type=checkbox]');
    await tick('tbody tr:nth-child(2) input[type=checkbox]');
    await screen.click('.xo-bulk button');
    expect(api.callsOf('deleteUser')).toHaveLength(1);
    expect(screen.errors).toHaveLength(1);
    expect(screen.text('.xo-bulk span')).toBe('2 selected');
  });

  it('selection is dropped when the list changes (sorting, paging, filtering)', async () => {
    screen = await mount('<xo-view get="/users"><xo-table columns="name" selectable sortable></xo-table></xo-view>', { api: mockApi(table, { listUsers: list }) });
    await tick('tbody tr:nth-child(1) input[type=checkbox]');
    expect(screen.$$('tbody input:checked')).toHaveLength(1);
    await screen.click('thead th:nth-child(2) button');
    expect(screen.$$('tbody input:checked')).toHaveLength(0);
  });
});
