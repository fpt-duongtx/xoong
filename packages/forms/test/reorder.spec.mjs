// Reordering rows of an array in a form: the focus follows the moved row, and a handle drags a row onto another row of the same list.
import { describe, it, expect, afterEach } from 'vitest';
import { mount, mockApi } from '@xoong/test';
import '@xoong/forms';

const str = () => ({ t: 'string' });
const bodySchema = { t: 'object', props: { tags: { t: 'array', items: str() }, blocks: { t: 'array', items: str() } } };
const table = {
  version: 1, entities: { Page: { id: 'id' } },
  operations: {
    getPage: { id: 'getPage', method: 'GET', path: '/pages/{id}', response: { t: 'entity', name: 'Page' } },
    updatePage: { id: 'updatePage', method: 'PUT', path: '/pages/{id}', body: true, response: { t: 'entity', name: 'Page' }, bodySchema },
  },
};
const record = { id: 3, tags: ['a', 'b'], blocks: ['x', 'y'] };
const FORM = `<xo-view get="getPage" p-id="3"><form xo-submit="updatePage">
  <ul class="tags"><li xo-each="tags"><span class="h" xo-drag="tags[{$index}]">::</span><input name="tags[{$index}]">
    <button type="button" class="rm" xo-remove="tags[{$index}]">x</button><button type="button" class="up" xo-move="tags[{$index}]:up">up</button></li></ul>
  <button type="button" id="add-tag" xo-add="tags">Add tag</button>
  <ul class="blocks"><li xo-each="blocks"><span class="h2" xo-drag="blocks[{$index}]">::</span></li></ul>
</form></xo-view>`;

let screen;
afterEach(() => screen?.unmount());
const api = () => mockApi(table, { getPage: () => record, updatePage: ({ body }) => body });
const model = () => screen.$('form').model;
const settle = () => new Promise((r) => setTimeout(r, 20)).then(() => screen.settle());
const rows = () => [...screen.$$('.tags li')];

const dt = () => ({ data: {}, get types() { return Object.keys(this.data); }, setData(k, v) { this.data[k] = v; }, getData(k) { return this.data[k] ?? ''; }, effectAllowed: '' });
const drag = (type, el, data) => { const e = new Event(type, { bubbles: true, cancelable: true }); e.dataTransfer = data; el.dispatchEvent(e); return e; };

describe('reordering rows', () => {
  it('Move up keeps the focus on the same button of the row that now holds the item', async () => {
    screen = await mount(FORM, { api: api() });
    await settle();
    expect(model().get('tags')).toEqual(['a', 'b']);
    rows()[1].querySelector('.up').focus();
    rows()[1].querySelector('.up').click();
    await settle();
    expect(model().get('tags')).toEqual(['b', 'a']);
    expect(document.activeElement).toBe(rows()[0].querySelector('.up')); // the item moved to the first row: so did the focus
  });

  it('removing a row puts the focus on the same button of the row now at that position, then the previous, then the add button', async () => {
    screen = await mount(FORM, { api: api() });
    await settle();
    rows()[0].querySelector('.rm').focus();
    rows()[0].querySelector('.rm').click();
    await settle();
    expect(model().get('tags')).toEqual(['b']);
    expect(document.activeElement).toBe(rows()[0].querySelector('.rm'));
    rows()[0].querySelector('.rm').click();
    await settle();
    expect(model().get('tags')).toEqual([]);
    expect(document.activeElement).toBe(screen.$('#add-tag'));
  });

  it('dragging a handle onto another row of the same list moves the item; another list or another kind of drag does nothing', async () => {
    screen = await mount(FORM, { api: api() });
    await settle();
    const handles = () => [...screen.$$('.tags .h')];
    const data = dt();
    const start = drag('dragstart', handles()[0], data);
    expect(data.getData('application/x-xoong-row')).toBe('tags[0]');
    expect(start.defaultPrevented).toBe(false);
    expect(handles()[0].closest('li').classList.contains('xo-dragging')).toBe(true);
    expect(drag('dragover', handles()[1], data).defaultPrevented).toBe(true); // a row accepts it
    expect(handles()[1].closest('li').classList.contains('xo-drop')).toBe(true);
    drag('drop', handles()[1], data);
    await settle();
    expect(model().get('tags')).toEqual(['b', 'a']);
    expect(screen.$$('.xo-dragging, .xo-drop').length).toBe(0);
    const again = dt();
    again.setData('application/x-xoong-row', 'tags[0]');
    drag('drop', screen.$('.blocks .h2'), again); // a row of another list: refused
    await settle();
    expect(model().get('tags')).toEqual(['b', 'a']);
    expect(model().get('blocks')).toEqual(['x', 'y']);
    const foreign = drag('dragover', handles()[0], { types: ['text/plain'], getData: () => '' });
    expect(foreign.defaultPrevented).toBe(false); // not one of ours
  });

  it('xo-array-change tells the page what happened to a list: add, remove, move by button, a drag, or code', async () => {
    screen = await mount(FORM, { api: api() });
    await settle();
    const seen = [];
    screen.$('form').addEventListener('xo-array-change', (e) => seen.push(e.detail));
    screen.$('#add-tag').click();
    rows()[0].querySelector('.up').click(); // the first row cannot move up: nothing
    rows()[1].querySelector('.up').click();
    rows()[0].querySelector('.rm').click();
    const data = dt();
    drag('dragstart', screen.$$('.tags .h')[0], data);
    drag('drop', screen.$$('.tags .h')[1], data);
    model().append('blocks', 'z');
    await settle();
    expect(seen).toEqual([
      { path: 'tags', op: 'add', from: undefined, to: 2 },
      { path: 'tags', op: 'move', from: 1, to: 0 },
      { path: 'tags', op: 'remove', from: 0, to: undefined },
      { path: 'tags', op: 'move', from: 0, to: 1 },
      { path: 'blocks', op: 'add', from: undefined, to: 2 },
    ]);
  });
});
