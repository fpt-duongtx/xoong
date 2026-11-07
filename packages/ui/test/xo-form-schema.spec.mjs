import { describe, it, expect, afterEach } from 'vitest';
import { mount, mockApi } from '@xoong/test';
import { define, XoControl, html } from '@xoong/core';
import '@xoong/ui';

const str = (extra = {}) => ({ t: 'string', ...extra });
const localized = { t: 'object', nullable: true, pruneEmpty: true, emptyAs: 'null', title: 'Subtitle', props: { en: str({ title: 'English' }), vi: str({ title: 'Vietnamese' }) } };
const bodySchema = {
  t: 'object', required: ['slug', 'title'],
  props: {
    internalId: str({ hidden: true }),
    seoTitle: str({ group: 'SEO', order: 50, description: 'Shown in search results' }),
    slug: str({ order: 10, title: 'URL slug', pattern: '^[a-z-]+$' }),
    title: { t: 'object', required: ['en'], props: { en: str(), vi: str() } },
    subtitle: localized,
    body: str({ widget: 'textarea', order: 20 }),
    password: str({ widget: 'password', order: 30 }),
    cover: str({ widget: 'rl-test-image', order: 40, hints: { recommendedSize: '1200x630' } }),
    status: str({ enum: ['draft', 'published'], order: 60 }),
    featured: { t: 'boolean', order: 70 },
    createdAt: str({ readOnly: true }),
    tags: { t: 'array', items: str(), title: 'Tags' },
    faq: { t: 'array', items: { t: 'object', required: ['q'], props: { q: str(), a: str() } } },
    blocks: { t: 'array', items: { t: 'union', key: 'type', map: {
      text: { t: 'object', title: 'Text block', props: { type: str(), body: str() } },
      image: { t: 'object', title: 'Image block', props: { type: str(), url: str({ format: 'uri' }) } },
    } } },
    layout: { t: 'union', key: 'kind', map: { hero: { t: 'object', props: { kind: str(), heading: str() } }, plain: { t: 'object', props: { kind: str() } } } },
  },
};
const table = {
  version: 1,
  entities: { Page: { id: 'id' } },
  operations: {
    getPage: { id: 'getPage', method: 'GET', path: '/pages/{id}', response: { t: 'entity', name: 'Page' } },
    updatePage: { id: 'updatePage', method: 'PUT', path: '/pages/{id}', body: true, response: { t: 'entity', name: 'Page' }, bodySchema },
    createPage: { id: 'createPage', method: 'POST', path: '/pages', body: true, response: { t: 'entity', name: 'Page' }, bodySchema },
  },
};
const record = { id: 1, internalId: 'srv-1', slug: 'home', title: { en: 'Home' }, status: 'draft', tags: ['a'], faq: [{ q: 'Why?', a: 'Because' }], blocks: [{ type: 'text', body: 'Hi' }] };

let screen;
afterEach(() => screen?.unmount());
const edit = (api) => mount('<xo-view get="getPage" p-id="1"><xo-form op="updatePage" submit="Save"></xo-form></xo-view>', { api });
const settle = () => new Promise((r) => setTimeout(r, 20)).then(() => screen.settle());

class TestImage extends XoControl {
  render() { return html`<span class="img">${() => this.value}</span>`; }
}
define('rl-test-image', TestImage);

describe('<xo-form> from a request schema with nesting, arrays, unions and hints', () => {
  it('draws fields in `order`, then declaration order; hidden and read-only fields are not drawn; labels come from title or the name', async () => {
    screen = await edit(mockApi(table, { getPage: () => record }));
    const labels = screen.texts('form > label.xo-field > span, form > fieldset > legend');
    expect(labels.slice(0, 7)).toEqual(['URL slug', 'Body', 'Password', 'Cover', 'Status', 'Featured', 'Title']);
    expect(screen.$('[name=internalId]')).toBeNull(); // hidden: kept in the model, not drawn
    expect(screen.$('[name=createdAt]')).toBeNull(); // read-only
    expect(screen.$('[name=slug]').required).toBe(true);
  });

  it('widgets: textarea, password, select from an enum, checkbox, and a custom XoControl that receives its schema node, hints and the form model', async () => {
    screen = await edit(mockApi(table, { getPage: () => record }));
    expect(screen.$('textarea[name=body]')).not.toBeNull();
    expect(screen.$('[name=password]').type).toBe('password');
    expect(screen.$('select[name=status]').value).toBe('draft');
    expect(screen.$('input[type=checkbox][name=featured]')).not.toBeNull();
    const cover = screen.$('rl-test-image[name=cover]');
    expect(cover.hints.recommendedSize).toBe('1200x630');
    expect(cover.hints.label).toBeUndefined();
    expect(cover.schema.widget).toBe('rl-test-image');
    expect(cover.xoForm).toBe(screen.$('form').model);
  });

  it('a group becomes a fieldset with a legend; a hint becomes small text', async () => {
    screen = await edit(mockApi(table, { getPage: () => record }));
    expect(screen.text('fieldset.xo-group > legend')).toBe('SEO');
    expect(screen.text('fieldset.xo-group .xo-hint')).toBe('Shown in search results');
    expect(screen.$('fieldset.xo-group [name=seoTitle]')).not.toBeNull();
  });

  it('nested objects are fieldsets with controls named by path, prefilled from the record', async () => {
    screen = await edit(mockApi(table, { getPage: () => record }));
    expect(screen.$('[name="title.en"]').value).toBe('Home');
    expect(screen.text('fieldset.xo-object > legend')).toBe('Title');
    expect(screen.$('[name="subtitle.vi"]')).not.toBeNull();
  });

  it('an array of values: rows with add, remove and move buttons that edit the draft', async () => {
    screen = await edit(mockApi(table, { getPage: () => record }));
    const tags = () => screen.$$('fieldset.xo-array:nth-of-type(1) .xo-row input').map((i) => i.value);
    expect(screen.$('[name="tags[0]"]').value).toBe('a');
    await screen.click('button[xo-add="tags"]');
    expect(screen.$$('[name^="tags["]').length).toBe(2);
    screen.$('[name="tags[1]"]').value = 'b';
    screen.$('[name="tags[1]"]').dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    await screen.click('[name="tags[1]"] ~ .xo-row-actions button[aria-label="Move up"], .xo-row:has([name="tags[1]"]) button[aria-label="Move up"]');
    expect(screen.$('form').model.get('tags')).toEqual(['b', 'a']);
    await screen.click('.xo-row:has([name="tags[0]"]) button[aria-label="Remove"]');
    expect(screen.$('form').model.get('tags')).toEqual(['a']);
    void tags;
  });

  it('an array of objects draws each item\'s fields and validates them by path', async () => {
    screen = await edit(mockApi(table, { getPage: () => record }));
    expect(screen.$('[name="faq[0].q"]').value).toBe('Why?');
    screen.$('[name="faq[0].q"]').value = '';
    screen.$('[name="faq[0].q"]').dispatchEvent(new Event('input', { bubbles: true }));
    expect(screen.$('form').model.errors['faq[0].q']).toBe('Please fill in this field.');
  });

  it('an array of unions: one add button per variant, and each row shows the fields of its variant (the tag itself is not a field)', async () => {
    screen = await edit(mockApi(table, { getPage: () => record }));
    expect(screen.texts('.xo-array-add button').filter((t) => /block/i.test(t))).toEqual(['Add Text block', 'Add Image block']);
    expect(screen.$('[name="blocks[0].body"]')).not.toBeNull();
    expect(screen.$('[name="blocks[0].type"]')).toBeNull();
    await screen.click('button[xo-add="blocks"][xo-with="type=image"]');
    expect(screen.$('[name="blocks[1].url"]')).not.toBeNull();
    expect(screen.$('[name="blocks[1].body"]')).toBeNull();
    expect(screen.$('form').model.get('blocks')[1]).toEqual({ type: 'image' });
  });

  it('a union property: choose the variant, and only that variant\'s fields show', async () => {
    screen = await edit(mockApi(table, { getPage: () => ({ ...record, layout: { kind: 'hero', heading: 'Hi' } }) }));
    expect(screen.$('select[name="layout.kind"]').value).toBe('hero');
    expect(screen.$('[name="layout.heading"]')).not.toBeNull();
    const select = screen.$('select[name="layout.kind"]');
    select.value = 'plain';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(screen.$('[name="layout.heading"]')).toBeNull();
  });

  it('saving sends the normalised payload: hidden fields from the record that are in the request schema stay, read-only and unknown ones do not', async () => {
    const api = mockApi(table, { getPage: () => record, updatePage: ({ body }) => ({ ...record, ...body }) });
    screen = await edit(api);
    await screen.submit('form');
    const [call] = api.callsOf('updatePage');
    expect(call.body.internalId).toBe('srv-1'); // hidden in the form, still part of the request
    expect(call.body).not.toHaveProperty('id');
    expect(call.body).not.toHaveProperty('createdAt');
    expect(call.body.subtitle).toBeUndefined(); // never set: nothing to send
    expect(call.body.title).toEqual({ en: 'Home' });
    expect(call.body.blocks).toEqual([{ type: 'text', body: 'Hi' }]);
  });

  it('a create form starts from the schema defaults, with no row for an empty array', async () => {
    screen = await mount('<xo-view><xo-form op="createPage"></xo-form></xo-view>', { api: mockApi(table) });
    expect(screen.$$('.xo-row').length).toBe(0);
    expect(screen.$('[name=slug]').value).toBe('');
    expect(screen.text('form > button:last-child')).toBe('Save');
  });
});
