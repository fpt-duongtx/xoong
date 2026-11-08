// Options for a combobox or a tag input from an API list: `options-op`, `option-value`, `option-label`.
import { describe, it, expect, afterEach } from 'vitest';
import { mount, mockApi } from '@xoong/test';
import { getClient } from '@xoong/data';
import '@xoong/data/view';
import '@xoong/controls';

const table = {
  version: 1,
  entities: { Category: { id: 'id' } },
  operations: {
    listCategories: { id: 'listCategories', method: 'GET', path: '/categories', query: ['limit'], response: { t: 'object', props: { items: { t: 'array', items: { t: 'entity', name: 'Category' } } } } },
    createCategory: { id: 'createCategory', method: 'POST', path: '/categories', body: true, response: { t: 'entity', name: 'Category' } },
  },
};
let screen;
afterEach(() => screen?.unmount());
const wait = () => new Promise((r) => setTimeout(r, 30)).then(() => screen.settle());

describe('options from the API', () => {
  it('fills a combobox from a list operation with paths for value and label; chips show labels; the cache refreshes it after a mutation', async () => {
    const cats = [{ id: 'a', name: { en: 'Alpha' } }, { id: 'b', name: { en: 'Beta' } }];
    const api = mockApi(table, { listCategories: () => ({ items: cats }), createCategory: ({ body }) => { const c = { id: 'c', name: { en: body.en } }; cats.push(c); return c; } });
    screen = await mount('<xo-combobox id="cb" name="categoryIds" multiple options-op="listCategories" option-value="id" option-label="name.en"></xo-combobox>', { api });
    const el = screen.$('#cb');
    el.setValue(['a']); // a saved record: the value is there before the options are
    await wait();
    expect(el.options).toEqual([{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }]);
    expect(el.querySelector('.xo-chip').textContent).toContain('Alpha'); // the chip was redrawn with the label, not the raw id
    await getClient().mutate('createCategory', {}, { en: 'Gamma' }); // a mutation of that list refreshes the options by itself
    await wait();
    expect(el.options.map((o) => o.label)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('works for xo-tags suggestions and an array of plain strings, with p-* parameters and defaults for value and label', async () => {
    const seen = [];
    const api = mockApi(table, { listCategories: ({ query }) => { seen.push(query); return { items: [{ id: 1, name: 'One' }] }; } });
    screen = await mount('<xo-combobox id="cb" name="x" options-op="listCategories" p-limit="5"></xo-combobox>', { api });
    await wait();
    expect(screen.$('#cb').options).toEqual([{ value: '1', label: 'One' }]); // id and name when no paths are given
    expect(seen[0]).toEqual({ limit: '5' });
  });
});
