import { describe, it, expect, afterEach } from 'vitest';
import { mount, mockApi, respond } from '@xoong/test';
import '@xoong/forms';
import { define, XoControl, html } from '@xoong/core';

const str = (extra = {}) => ({ t: 'string', ...extra });
const localized = { t: 'object', nullable: true, pruneEmpty: true, emptyAs: 'null', props: { en: str(), vi: str() } };
const bodySchema = {
  t: 'object', required: ['title'],
  props: {
    title: { t: 'object', required: ['en'], pruneEmpty: true, props: { en: str(), vi: str() } },
    subtitle: localized,
    tags: { t: 'array', maxItems: 4, items: str({ maxLength: 6 }) },
    blocks: { t: 'array', items: { t: 'union', key: 'type', map: {
      text: { t: 'object', required: ['body'], props: { type: str(), body: str() } },
      image: { t: 'object', required: ['url'], props: { type: str(), url: str({ format: 'uri' }), caption: localized } },
    } } },
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
const record = { id: 3, createdAt: 'x', title: { en: 'Home', vi: '' }, subtitle: null, tags: ['a', 'b'], blocks: [{ type: 'text', body: 'Hello' }, { type: 'image', url: 'https://x.test/a.png', caption: { en: 'Cap', vi: '' } }] };

let screen;
afterEach(() => screen?.unmount());
const api = (extra = {}) => mockApi(table, { getPage: () => record, updatePage: ({ body }) => ({ ...record, ...body }), ...extra });

const FORM = `<xo-view get="getPage" p-id="3"><form xo-submit="updatePage">
  <input name="title.en"><input name="title.vi"><input name="subtitle.en"><input name="subtitle.vi">
  <ul class="tags"><li xo-each="tags"><input name="tags[{$index}]"><button type="button" class="rm" xo-remove="tags[{$index}]">x</button><button type="button" class="up" xo-move="tags[{$index}]:up">up</button></li></ul>
  <button type="button" id="add-tag" xo-add="tags">Add tag</button>
  <section class="blocks"><div class="block" xo-each="blocks">
    <b xo-if="type=text" class="is-text">text</b><b xo-if="type=image" class="is-image">image</b>
    <input xo-if="type=text" name="blocks[{$index}].body">
    <span xo-if="type=image"><input name="blocks[{$index}].url"><input name="blocks[{$index}].caption.en"><input name="blocks[{$index}].caption.vi"></span>
    <button type="button" class="rm-block" xo-remove="blocks[{$index}]">remove</button><button type="button" class="down" xo-move="blocks[{$index}]:down">down</button>
  </div></section>
  <button type="button" id="add-text" xo-add="blocks" xo-with="type=text">Add text</button><button type="button" id="add-image" xo-add="blocks" xo-with="type=image">Add image</button>
  <button class="save">Save</button></form></xo-view>`;
const model = () => screen.$('form').model;
const settle = () => new Promise((r) => setTimeout(r, 20)).then(() => screen.settle());
const type = async (sel, value) => { const el = screen.$(sel); el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); await settle(); };

describe('arrays in a hand-written form', () => {
  it('renders one row per item with its controls prefilled, by index path', async () => {
    screen = await mount(FORM, { api: api() });
    expect(screen.$$('.tags input').map((i) => i.value)).toEqual(['a', 'b']);
    expect(screen.$('[name="blocks[0].body"]').value).toBe('Hello');
    expect(screen.$('[name="blocks[1].url"]').value).toBe('https://x.test/a.png');
    expect(screen.$('[name="blocks[1].caption.en"]').value).toBe('Cap');
    expect(screen.$$('.is-text').length).toBe(1);
    expect(screen.$$('.is-image').length).toBe(1);
  });

  it('xo-add appends a row (a union row needs its tag); the new controls are bound at once', async () => {
    screen = await mount(FORM, { api: api() });
    await screen.click('#add-tag');
    expect(screen.$$('.tags input').length).toBe(3);
    await type('[name="tags[2]"]', 'new');
    expect(model().get('tags')).toEqual(['a', 'b', 'new']);
    await screen.click('#add-image');
    expect(screen.$$('.is-image').length).toBe(2);
    expect(model().get('blocks')[2]).toEqual({ type: 'image' });
    await type('[name="blocks[2].url"]', 'not a url');
    expect(model().errors['blocks[2].url']).toBe('Enter a valid URL.');
    await screen.click('#add-text');
    expect(model().get('blocks')[3]).toEqual({ type: 'text' });
  });

  it('xo-remove and xo-move edit the draft; the rows follow and keep the values the person typed', async () => {
    screen = await mount(FORM, { api: api() });
    await type('[name="tags[0]"]', 'first');
    await screen.click('.tags li:nth-child(2) .up'); // move "b" above "first"
    expect(screen.$$('.tags input').map((i) => i.value)).toEqual(['b', 'first']);
    await screen.click('.tags li:nth-child(1) .rm');
    expect(screen.$$('.tags input').map((i) => i.value)).toEqual(['first']);
    expect(model().get('tags')).toEqual(['first']);
    await screen.click('.block:nth-child(1) .down'); // move the text block below the image block
    expect(model().get('blocks').map((b) => b.type)).toEqual(['image', 'text']);
    expect(screen.$('[name="blocks[1].body"]').value).toBe('Hello');
    expect(screen.$$('.block')[0].querySelector('.is-image')).not.toBeNull();
  });

  it('a field error follows its item, and is shown on the right row after a removal', async () => {
    screen = await mount(FORM, { api: api() });
    await screen.click('#add-tag');
    await type('[name="tags[2]"]', 'toolongvalue');
    screen.$('[name="tags[2]"]').dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await settle();
    expect(screen.text('.tags li:nth-child(3) [data-xo-error]')).toBe('Use at most 6 characters.');
    await screen.click('.tags li:nth-child(1) .rm');
    expect(screen.text('.tags li:nth-child(2) [data-xo-error]')).toBe('Use at most 6 characters.');
    expect(screen.$('.tags li:nth-child(1) [data-xo-error]')).toBeNull();
  });

  it('submit sends the normalised nested payload: localized objects pruned to what is filled, an empty optional one null', async () => {
    const a = api();
    screen = await mount(FORM, { api: a });
    await screen.click('#add-tag');
    await type('[name="tags[2]"]', 'c');
    await type('[name="blocks[1].caption.vi"]', 'Chu thich');
    await screen.submit('form');
    const [call] = a.callsOf('updatePage');
    expect(call.body).toEqual({
      title: { en: 'Home' }, // vi '' dropped
      subtitle: null, // every locale empty: null
      tags: ['a', 'b', 'c'],
      blocks: [{ type: 'text', body: 'Hello' }, { type: 'image', url: 'https://x.test/a.png', caption: { en: 'Cap', vi: 'Chu thich' } }],
    });
    expect(call.body).not.toHaveProperty('id');
    expect(model().dirty).toBe(false);
  });

  it('an invalid nested field blocks submit, reports the path, and asks the app to reveal it', async () => {
    const a = api();
    screen = await mount(FORM, { api: a });
    await type('[name="blocks[1].url"]', 'nope');
    const revealed = [];
    screen.$('form').addEventListener('xo-reveal', (e) => revealed.push(e.detail.path));
    await screen.submit('form');
    expect(a.callsOf('updatePage')).toHaveLength(0);
    expect(revealed).toEqual(['blocks[1].url']);
    expect(document.activeElement).toBe(screen.$('[name="blocks[1].url"]'));
  });

  it('server errors on a nested path land on the control of that row', async () => {
    const a = api({ updatePage: () => respond(422, { errors: [{ pointer: '#/blocks/1/url', detail: 'Unreachable URL' }] }) });
    screen = await mount(FORM, { api: a });
    await screen.submit('form');
    expect(screen.text('.block:nth-child(2) [data-xo-error]')).toBe('Unreachable URL');
  });
});

describe('a large page: 40 blocks of 20 fields (800 controls)', () => {
  it('mounts, and typing in one control wakes nothing else', async () => {
    const fields = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`f${i}`, str()]));
    const big = { t: 'object', props: { blocks: { t: 'array', items: { t: 'object', props: fields } } } };
    const tbl = { ...table, operations: { ...table.operations, updatePage: { ...table.operations.updatePage, bodySchema: big } } };
    const value = { id: 3, blocks: Array.from({ length: 40 }, (_, b) => Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`f${i}`, `v${b}-${i}`]))) };
    const inputs = Array.from({ length: 20 }, (_, i) => `<input name="blocks[{$index}].f${i}">`).join('');
    screen = await mount(`<xo-view get="getPage" p-id="3"><form xo-submit="updatePage"><div class="row" xo-each="blocks">${inputs}</div></form></xo-view>`, { api: mockApi(tbl, { getPage: () => value }) });
    await settle();
    expect(screen.$$('input').length).toBe(800);
    expect(screen.$('[name="blocks[39].f19"]').value).toBe('v39-19');
    const other = screen.$('[name="blocks[5].f5"]');
    const before = other.value;
    let writes = 0;
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    Object.defineProperty(other, 'value', { get() { return desc.get.call(this); }, set(v) { writes++; desc.set.call(this, v); } });
    const start = performance.now();
    for (let n = 0; n < 10; n++) await type('[name="blocks[17].f3"]', `typed ${n}`);
    const perEdit = (performance.now() - start) / 10;
    expect(writes).toBe(0); // the control of another field was never rewritten
    expect(other.value).toBe(before);
    expect(model().get('blocks')[17].f3).toBe('typed 9');
    expect(perEdit).toBeLessThan(80);
  });
});

class MiniControl extends XoControl {
  render() { return html`<button type="button" @click=${() => this.userInput('x')}>set</button>`; }
}
define('xo-test-mini', MiniControl);

describe('a custom XoControl in a form', () => {
  it('userInput reaches the form model (the control is not reverted before the model hears), and a programmatic value does not change the model', async () => {
    screen = await mount('<xo-view get="getPage" p-id="3"><form xo-submit="updatePage"><xo-test-mini name="subtitle.en"></xo-test-mini></form></xo-view>', { api: api() });
    await settle();
    const host = screen.$('xo-test-mini');
    host.setValue('aaa');
    expect(host.value).toBe('aaa'); // the binder's effect does not revert a programmatic change
    expect(model().get('subtitle')?.en ?? '').toBe(''); // and a programmatic value is not an edit, as with native inputs
    host.setValue('');
    await screen.click('xo-test-mini button');
    expect(host.value).toBe('x');
    expect(model().get('subtitle.en')).toBe('x');
  });

  it('on an edit form whose record has a stored value, userInput also reaches the model', async () => {
    screen = await mount('<xo-view get="getPage" p-id="3"><form xo-submit="updatePage"><xo-test-mini name="title.en"></xo-test-mini></form></xo-view>', { api: api() });
    await settle();
    const host = screen.$('xo-test-mini');
    expect(host.value).toBe('Home'); // prefilled by the binder: the first write sets the control inside the effect
    await screen.click('xo-test-mini button');
    expect(host.value).toBe('x');
    expect(model().get('title.en')).toBe('x');
    host.setCustomValidity('nope'); // a validity change from outside does not make the binder write the model back either
    expect(host.value).toBe('x');
  });

  it('a control the binder prefills (open, refresh, save) is pristine: its own dirty flag agrees with the form until the person edits', async () => {
    screen = await mount('<xo-view get="getPage" p-id="3"><form xo-submit="updatePage"><xo-test-mini name="title.en"></xo-test-mini></form></xo-view>', { api: api() });
    await settle();
    const host = screen.$('xo-test-mini');
    expect(host.value).toBe('Home');
    expect(host.dirty).toBe(false); // the stored value is the baseline, not a change
    expect(host.hasAttribute('data-dirty')).toBe(false);
    expect(model().dirty).toBe(false);
    await screen.click('xo-test-mini button'); // userInput('x')
    expect(host.dirty).toBe(true);
    expect(host.hasAttribute('data-dirty')).toBe(true);
    expect(model().dirty).toBe(true);
    await screen.submit('form');
    await settle();
    expect(model().dirty).toBe(false); // saved: the new value is the baseline
    expect(host.dirty).toBe(false);
    expect(host.hasAttribute('data-dirty')).toBe(false);
  });
});
