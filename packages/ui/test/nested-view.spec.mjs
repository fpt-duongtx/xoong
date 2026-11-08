import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mount, mockApi } from '@xoong/test';
import '@xoong/ui';

const table = {
  version: 1,
  entities: { Asset: { id: 'id' } },
  operations: {
    listMedia: { id: 'listMedia', method: 'GET', path: '/media', query: ['q', 'offset'], response: { t: 'object', props: { items: { t: 'array', items: { t: 'entity', name: 'Asset' } } } } },
    getAsset: { id: 'getAsset', method: 'GET', path: '/media/{id}', response: { t: 'entity', name: 'Asset' } },
  },
};
let screen;
beforeEach(() => history.replaceState(null, '', '/'));
afterEach(() => { screen?.unmount(); history.replaceState(null, '', '/'); });
const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const api = () => mockApi(table, { listMedia: () => ({ items: [{ id: 1, name: 'one.png' }, { id: 2, name: 'two.png' }] }), getAsset: ({ params }) => ({ id: Number(params.id), name: `asset-${params.id}` }) });

describe('rows with their own view, and a path parameter without a value', () => {
  it('a nested view in an xo-each row takes p-id from the row', async () => {
    screen = await mount(`<xo-view get="listMedia"><div xo-each="items" class="row"><xo-view get="getAsset" p-id="{id}"><b>{name}</b></xo-view></div></xo-view>`, { api: api() });
    await wait(150);
    expect(screen.$$('.row b').map((b) => b.textContent)).toEqual(['asset-1', 'asset-2']);
  });
  it('warns once, naming the parameter, when a view has no value for a path parameter', async () => {
    const seen = [];
    const original = console.warn;
    console.warn = (...a) => seen.push(a.join(' '));
    try {
      screen = await mount('<xo-view get="getAsset"><b>{name}</b></xo-view>', { api: api() });
      await wait(60);
    } finally { console.warn = original; }
    expect(seen.filter((m) => m.includes('{id}'))).toHaveLength(1);
    expect(seen[0]).toContain('p-id');
  });
});

describe('template xo-each and boolean attributes', () => {
  it('<template xo-each> repeats its children without a host element, and follows the list', async () => {
    screen = await mount('<xo-view get="listMedia"><article><template xo-each="items"><h2>{name}</h2><p>about {name}</p></template></article></xo-view>', { api: api() });
    await wait(80);
    expect(screen.$$('article > h2').map((e) => e.textContent)).toEqual(['one.png', 'two.png']);
    expect(screen.$$('article > p').map((e) => e.textContent)).toEqual(['about one.png', 'about two.png']);
    expect(screen.$$('article > *').map((e) => e.localName)).toEqual(['h2', 'p', 'h2', 'p']); // flat: no wrapper
    expect(screen.$('article template')).toBeNull();
  });
  it('hidden="{flag}" and aria-selected="{flag}" follow the data', async () => {
    const flags = { ...table, operations: { ...table.operations, getAsset: { ...table.operations.getAsset, response: { t: 'object', props: { open: { t: 'boolean' }, closed: { t: 'boolean' } } } } } };
    screen = await mount('<xo-view get="getAsset" p-id="1"><p id="a" hidden="{closed}">a</p><p id="b" hidden="{open}">b</p><button id="t" aria-selected="{open}" disabled="{closed}">t</button></xo-view>', { api: mockApi(flags, { getAsset: () => ({ id: 1, open: true, closed: false }) }) });
    await wait(80);
    expect(screen.$('#a').hasAttribute('hidden')).toBe(false);
    expect(screen.$('#b').hasAttribute('hidden')).toBe(true);
    expect(screen.$('#t').getAttribute('aria-selected')).toBe('true');
    expect(screen.$('#t').hasAttribute('disabled')).toBe(false);
  });
});

describe('<xo-pager>', () => {
  it('pages a list that is not a table: range text, Previous and Next change offset', async () => {
    const big = { ...table, operations: { ...table.operations, listMedia: { ...table.operations.listMedia, query: ['limit', 'offset'], response: { t: 'object', props: { items: { t: 'array', items: { t: 'entity', name: 'Asset' } }, total: { t: 'integer' } } } } } };
    const all = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: `n${i + 1}` }));
    screen = await mount('<xo-view get="listMedia"><div class="tile" xo-each="items">{name}</div><xo-pager page-size="2"></xo-pager></xo-view>', {
      api: mockApi(big, { listMedia: ({ query }) => ({ items: all.slice(Number(query.offset ?? 0), Number(query.offset ?? 0) + 2), total: 5 }) }),
    });
    await wait(80);
    const tiles = () => screen.$$('.tile').map((t) => t.textContent);
    expect(tiles()).toEqual(['n1', 'n2']);
    expect(screen.$('.xo-range').textContent).toBe('1–2 of 5');
    expect(screen.$$('nav.xo-pager button').map((b) => b.textContent)).toEqual(['Next']);
    screen.$('nav.xo-pager button').click();
    await wait(80);
    expect(tiles()).toEqual(['n3', 'n4']);
    expect(screen.$$('nav.xo-pager button').map((b) => b.textContent)).toEqual(['Previous', 'Next']);
  });
});

describe('an xo-view inside another xo-view', () => {
  for (const attrs of ['', ' url-params="q,offset"']) {
    it(`binds its own children against its own data${attrs ? ' (outer list with url-params)' : ''}`, async () => {
      screen = await mount(`<xo-view get="listMedia"${attrs}>
        <ul><li xo-each="items">{name}</li></ul>
        <aside><xo-view get="getAsset" p-id="7"><h2 id="inner">{name}</h2><p id="busy" xo-if="$loading">Loading</p></xo-view></aside>
      </xo-view>`, { api: api() });
      await wait(120);
      expect(screen.$('#inner').textContent).toBe('asset-7');
      expect(screen.$('#busy')).toBeNull();
      expect(screen.$$('li').map((l) => l.textContent)).toEqual(['one.png', 'two.png']);
    });
  }
});
