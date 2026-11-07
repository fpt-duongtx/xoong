// The controls inside a generated form: hints name the widget, the schema fills it, the form model and the payload follow.
import { describe, it, expect, afterEach } from 'vitest';
import { mount, mockApi } from '@xoong/test';
import '@xoong/ui';
import '@xoong/controls';

const str = (extra = {}) => ({ t: 'string', ...extra });
const bodySchema = {
  t: 'object', required: ['role'],
  props: {
    role: str({ enum: ['admin', 'editor', 'viewer'], widget: 'xo-combobox', title: 'Role' }),
    topics: { t: 'array', items: str({ enum: ['news', 'tech', 'life'] }), widget: 'xo-combobox', title: 'Topics' },
    keywords: { t: 'array', items: str(), widget: 'xo-tags', title: 'Keywords' },
  },
};
const table = {
  version: 1,
  entities: { Page: { id: 'id' } },
  operations: {
    getPage: { id: 'getPage', method: 'GET', path: '/pages/{id}', response: { t: 'entity', name: 'Page' } },
    updatePage: { id: 'updatePage', method: 'PUT', path: '/pages/{id}', body: true, response: { t: 'entity', name: 'Page' }, bodySchema },
  },
};
const record = { id: 1, role: 'editor', topics: ['tech'], keywords: ['one'] };

let screen;
afterEach(() => screen?.unmount());
const wait = () => new Promise((r) => setTimeout(r, 20)).then(() => screen.settle());
const model = () => screen.$('form').model;

describe('combobox and tags in a generated form', () => {
  it('the schema fills the options, the record fills the values, and a pick reaches the form model and the saved payload', async () => {
    const api = mockApi(table, { getPage: () => record, updatePage: ({ body }) => ({ ...record, ...body }) });
    screen = await mount('<xo-view get="getPage" p-id="1"><xo-form op="updatePage" submit="Save"></xo-form></xo-view>', { api });
    await wait();
    const role = screen.$('xo-combobox[name=role]');
    const topics = screen.$('xo-combobox[name=topics]');
    expect(role.options.map((o) => o.value)).toEqual(['admin', 'editor', 'viewer']);
    expect(role.value).toBe('editor');
    expect(screen.$('[name=role] .xo-combobox-input').value).toBe('editor');
    expect(topics.multiple).toBe(true);
    expect(topics.value).toEqual(['tech']);
    expect(screen.$$('[name=topics] .xo-chip').length).toBe(1);
    expect(model().dirty).toBe(false);

    role.userInput('admin');
    topics.userInput(['tech', 'news']);
    screen.$('xo-tags[name=keywords]').userInput(['one', 'two']);
    await wait();
    expect(model().get('role')).toBe('admin');
    expect(model().get('topics')).toEqual(['tech', 'news']);
    expect(model().get('keywords')).toEqual(['one', 'two']);
    expect(model().dirty).toBe(true);

    await screen.submit('form');
    const [call] = api.callsOf('updatePage');
    expect(call.body).toMatchObject({ role: 'admin', topics: ['tech', 'news'], keywords: ['one', 'two'] });
  });

  it('a required combobox that is empty blocks the save and shows the message', async () => {
    const api = mockApi(table, { getPage: () => ({ id: 1, role: '', topics: [], keywords: [] }), updatePage: ({ body }) => body });
    screen = await mount('<xo-view get="getPage" p-id="1"><xo-form op="updatePage" submit="Save"></xo-form></xo-view>', { api });
    await wait();
    await screen.submit('form');
    expect(api.callsOf('updatePage')).toEqual([]);
    expect(model().errors.role).toBeTruthy();
  });
});
