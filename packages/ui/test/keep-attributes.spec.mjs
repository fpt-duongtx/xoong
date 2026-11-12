import { describe, it, expect, afterEach } from 'vitest';
import { mount, mockApi } from '@xoong/test';
import { defineTemplate } from '@xoong/data/view';
import '@xoong/ui';

const table = {
  version: 1,
  entities: { User: { id: 'id' } },
  operations: {
    listUsers: { id: 'listUsers', method: 'GET', path: '/users', query: ['limit', 'offset'], response: { t: 'object', props: { items: { t: 'array', items: { t: 'entity', name: 'User' } }, total: { t: 'number' }, theme: { t: 'string' }, closed: { t: 'boolean' } } } },
    createUser: { id: 'createUser', method: 'POST', path: '/users', body: true, response: { t: 'entity', name: 'User' }, bodyFields: [{ name: 'name', type: 'string' }] },
  },
};
const api = () => mockApi(table, { listUsers: () => ({ items: [{ id: 1, name: 'A' }], total: 1, theme: 'dark', closed: true }), createUser: () => ({ id: 2 }) });
const USER = 'id="people" class="wide" style="color: red" aria-label="People" data-k="v" dir="rtl" lang="vi" p-id="7" data-theme="{theme}" size="lg" variant="ghost" sticky="end" xo-t="aria-label:people.label"';
let screen;
afterEach(() => screen?.unmount());

describe('an element that expands keeps what the person wrote on it (ADR-0014)', () => {
  for (const [tag, own, sel, ownClass] of [
    ['xo-table', 'of="items" columns="name"', 'div.xo-table', 'xo-table'],
    ['xo-pager', 'page-size="5"', 'nav.xo-pager', 'xo-pager'],
    ['xo-form', 'op="createUser" submit="Add"', 'form.xo-form', 'xo-form'],
  ]) {
    it(`<${tag}>: unknown, global, aria, data, p-* and interpolated attributes survive; class and style merge`, async () => {
      screen = await mount(`<xo-view get="/users"><${tag} ${own} ${USER}></${tag}></xo-view>`, { api: api() });
      const root = screen.$(sel);
      expect(root).toBeTruthy();
      for (const [n, v] of [['id', 'people'], ['aria-label', 'People'], ['data-k', 'v'], ['dir', 'rtl'], ['lang', 'vi'], ['p-id', '7'], ['size', 'lg'], ['variant', 'ghost'], ['sticky', 'end']]) expect(root.getAttribute(n), n).toBe(v);
      expect(root.getAttribute('data-theme')).toBe('dark'); // bound once, in the view's scope
      expect(root.getAttribute('class')).toBe(`${ownClass} wide`);
      expect(root.getAttribute('style')).toBe('color: red');
    });
  }

  it('attributes the component handles are taken, not copied', async () => {
    screen = await mount('<xo-view get="/users"><xo-table of="items" columns="name" sortable selectable page-size="5" page-sizes="5,10" filters="name" empty="None" title="name" status="name" cards column-picker hidden-columns="name" columns-key="k"></xo-table><xo-form op="createUser" submit="Add"></xo-form></xo-view>', { api: api() });
    const box = screen.$('div.xo-table');
    expect(box.getAttributeNames().sort()).toEqual(['class']);
    expect(screen.$('form.xo-form').getAttributeNames().sort()).toEqual(['class', 'xo-submit']);
  });

  it('hidden="{closed}" and hidden are present on the element it became', async () => {
    // happy-dom does not apply @layer, so it cannot show that .xo-form { display: grid } used to beat [hidden]. Computed display and height are asserted in fouc.test.mjs.
    screen = await mount('<xo-view get="/users"><xo-table of="items" columns="name" hidden="{closed}"></xo-table><xo-form op="createUser" hidden></xo-form></xo-view>', { api: api() });
    expect(screen.$('div.xo-table').hidden).toBe(true);
    expect(screen.$('form.xo-form').hidden).toBe(true);
  });

  it('<xo-pager hidden> puts hidden on the nav itself, with no display:contents wrapper', async () => {
    screen = await mount('<xo-view get="/users"><xo-pager page-size="5" hidden></xo-pager></xo-view>', { api: api() });
    const nav = screen.$('nav.xo-pager');
    expect(nav.hidden).toBe(true);
    expect(nav.parentElement.localName).toBe('xo-view');
  });

  it('regression guard: an author xo-submit does not replace the operation the form was built from', async () => {
    // Passed before this change too: the form writes xo-submit from op, and an author xo-submit is not a second target.
    screen = await mount('<xo-view><xo-form op="createUser" xo-submit="nope"></xo-form></xo-view>', { api: api() });
    expect(screen.$('form').getAttribute('xo-submit')).toBe('createUser');
  });

  it('xo-form: modifiers reach the form as before, and so does anything else', async () => {
    screen = await mount('<xo-view><xo-form op="createUser" xo-notice="Saved" novalidate autocomplete="off" data-x="1"></xo-form></xo-view>', { api: api() });
    const form = screen.$('form[xo-submit]');
    expect(form.getAttribute('xo-notice')).toBe('Saved');
    expect(form.hasAttribute('novalidate')).toBe(true);
    expect(form.getAttribute('data-x')).toBe('1');
  });

  it('a third-party template gets the rule; a fragment gives the attributes to its first element and binds every node', async () => {
    defineTemplate('my-card', (el, { take }) => {
      const f = document.createDocumentFragment();
      const h = document.createElement('h2');
      h.className = 'card';
      h.setAttribute('style', 'color: blue');
      h.textContent = take('heading');
      const p = document.createElement('p');
      p.textContent = '{theme}';
      f.append(h, p);
      return f;
    });
    screen = await mount('<xo-view get="/users"><my-card heading="Hi" class="x" style="color: red" data-theme="{theme}"></my-card></xo-view>', { api: api() });
    const h = screen.$('h2');
    expect(h.getAttribute('class')).toBe('card x');
    expect(h.getAttribute('style')).toBe('color: blue;color: red');
    expect(h.getAttribute('data-theme')).toBe('dark');
    expect(h.hasAttribute('heading')).toBe(false);
    expect(screen.text('h2 + p')).toBe('dark');
  });

  it('regression guard: an output with no element root is still replaced, and does not throw', async () => {
    // Passed before the attribute copy: replaceWith already accepted a comment. Guards the copy, which must not write onto that comment or throw.
    defineTemplate('my-note', () => document.createComment('kept'));
    screen = await mount('<xo-view><my-note id="z" class="c"></my-note><b>ok</b></xo-view>', { api: api() });
    expect(screen.$('my-note')).toBeNull();
    expect(screen.$('#z')).toBeNull();
    expect(screen.text('b')).toBe('ok');
  });
});
