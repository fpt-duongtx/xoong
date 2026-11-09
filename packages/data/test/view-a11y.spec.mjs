import { describe, it, expect, afterEach } from 'vitest';
import { configure } from '@xoong/data';
import '@xoong/data/view';
import '@xoong/ui';
import { mockApi } from '@xoong/test';

const table = {
  version: 1,
  entities: { User: { id: 'id' } },
  operations: { listUsers: { id: 'listUsers', method: 'GET', path: '/users', query: ['sort'], response: { t: 'object', props: { items: { t: 'array', items: { t: 'entity', name: 'User' } } } } } },
};
const wait = (ms = 20) => new Promise((r) => setTimeout(r, ms));
let container;
afterEach(() => container?.remove());

/** A client whose list answers only when the test says so (after the first call, which answers at once when `first` is true). */
function boot(html, { first = false } = {}) {
  let gate = first ? null : Promise.withResolvers();
  const api = mockApi(table, { listUsers: async ({ query }) => { await gate?.promise; return { items: query.sort === '-name' ? [{ id: 2, name: 'B' }, { id: 1, name: 'A' }] : [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] }; } });
  const client = configure({ api: api.table, fetch: api.fetch, retry: 0, gcTime: Infinity });
  container = document.createElement('div');
  document.body.append(container);
  container.innerHTML = html;
  return {
    api, client, view: container.querySelector('xo-view'),
    hold: () => { gate = Promise.withResolvers(); },
    release: async () => { gate.resolve(); await wait(); await wait(); },
  };
}

describe('aria-busy on a view', () => {
  it('is set while the first load runs and while a sort or page loads over the old rows, and removed when it is done', async () => {
    const t = boot('<xo-view get="listUsers"><b xo-each="items">{name}</b><button type="button" xo-param="sort=-name">z</button></xo-view>', { first: true });
    await wait(); await wait();
    expect(t.view.hasAttribute('aria-busy')).toBe(false); // loaded
    t.hold();
    container.querySelector('button').click();
    await wait();
    expect(t.view.getAttribute('aria-busy')).toBe('true'); // $refreshing: old rows still on screen
    expect(t.view.hasAttribute('data-refreshing')).toBe(true);
    await t.release();
    expect(t.view.hasAttribute('aria-busy')).toBe(false);
  });
  it('is set during the very first load ($loading)', async () => {
    const t = boot('<xo-view get="listUsers"><b xo-each="items">{name}</b></xo-view>');
    await wait();
    expect(t.view.getAttribute('aria-busy')).toBe('true');
    await t.release();
    expect(t.view.hasAttribute('aria-busy')).toBe(false);
  });
  it('a view without a request is never busy', async () => {
    const t = boot('<xo-view><p>static</p></xo-view>', { first: true });
    await wait();
    expect(t.view.hasAttribute('aria-busy')).toBe(false);
  });
});

describe('aria-sort on the header of a sort button', () => {
  const sorted = (t) => [...container.querySelectorAll('th')].map((th) => th.getAttribute('aria-sort'));
  it('xo-param="sort~=field" in a th: ascending, then descending, other columns without aria-sort', async () => {
    const t = boot('<xo-view get="listUsers"><table><thead><tr><th><button type="button" xo-param="sort~=name">Name</button></th><th><button type="button" xo-param="sort~=email">E-mail</button></th></tr></thead></table></xo-view>', { first: true });
    await wait(); await wait();
    const [name, email] = container.querySelectorAll('th button');
    expect(sorted(t)).toEqual([null, null]);
    name.click(); await wait(); await wait();
    expect(sorted(t)).toEqual(['ascending', null]);
    name.click(); await wait(); await wait();
    expect(sorted(t)).toEqual(['descending', null]);
    email.click(); await wait(); await wait();
    expect(sorted(t)).toEqual([null, 'ascending']);
    expect(container.querySelector('th:nth-child(2) button').getAttribute('aria-current')).toBe('true');
  });
  it('<xo-table sortable> gets it on its headers', async () => {
    const t = boot('<xo-view get="listUsers"><xo-table of="items" columns="name,email" sortable></xo-table></xo-view>', { first: true });
    await wait(60); await wait(60);
    expect(sorted(t)).toEqual([null, null]);
    container.querySelector('th button').click(); await wait(60); await wait(60);
    expect(sorted(t)).toEqual(['ascending', null]);
    container.querySelector('th button').click(); await wait(60); await wait(60);
    expect(sorted(t)).toEqual(['descending', null]);
    expect(t.api.callsOf('listUsers').map((c) => c.query.sort)).toEqual([undefined, 'name', '-name']);
  });
  it('a sort button outside a table header is left alone', async () => {
    const t = boot('<xo-view get="listUsers"><button type="button" xo-param="sort~=name">Name</button></xo-view>', { first: true });
    await wait(); await wait();
    container.querySelector('button').click(); await wait(); await wait();
    expect(container.querySelector('button').hasAttribute('aria-sort')).toBe(false);
    expect(t.view.hasAttribute('aria-sort')).toBe(false);
  });
});
