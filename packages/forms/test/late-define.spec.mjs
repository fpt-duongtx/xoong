// A custom control can appear in the page before its class is defined (a route's content rendered before the widget module loaded, a lazy import).
// The browser upgrades such elements when `define` runs. The form binder and XoControl must cope: bind after the upgrade, and keep what was set before it.
import { describe, it, expect, afterEach } from 'vitest';
import { mount, mockApi } from '@xoong/test';
import { define, XoControl, html } from '@xoong/core';
import '@xoong/forms';

const bodySchema = { t: 'object', props: { title: { t: 'string' }, slug: { t: 'string', maxLength: 5 } } };
const table = {
  version: 1, entities: { Page: { id: 'id' } },
  operations: {
    getPage: { id: 'getPage', method: 'GET', path: '/pages/{id}', response: { t: 'entity', name: 'Page' } },
    updatePage: { id: 'updatePage', method: 'PUT', path: '/pages/{id}', body: true, response: { t: 'entity', name: 'Page' }, bodySchema },
  },
};
let screen;
let counter = 0; // a tag cannot be undefined again: one tag per test
afterEach(() => screen?.unmount());
const wait = () => new Promise((r) => setTimeout(r, 20)).then(() => screen.settle());
const model = () => screen.$('form').model;
const tag = () => `xo-late-${counter}`;
const open = (record = { id: 1, title: 'T', slug: 'abc' }) => mount(`<xo-view get="getPage" p-id="1"><form xo-submit="updatePage"><input name="title"><${tag()} name="slug"></${tag()}></form></xo-view>`,
  { api: mockApi(table, { getPage: () => record, updatePage: ({ body }) => body }) });
const defineLate = () => {
  class Late extends XoControl {
    render() { return html`<button type="button" @click=${() => this.userInput('typed')}>go</button>`; }
  }
  define(tag(), Late);
};

describe('a control used before its element is defined', () => {
  it('is bound once it is defined: the record fills it, an edit reaches the model, the schema rules apply', async () => {
    counter++;
    screen = await open();
    await wait();
    const el = screen.$(tag());
    expect(el.value).toBeUndefined(); // not upgraded yet: a plain element
    defineLate();
    await wait();
    expect(el.value).toBe('abc'); // the binder found it after the upgrade
    await screen.click(`${tag()} button`);
    expect(model().get('slug')).toBe('typed');
    el.userInput('toolong');
    await wait();
    expect(model().errors.slug).toBeTruthy(); // maxLength 5
    expect(model().dirty).toBe(true);
  });

  it('a value set on the element before the upgrade becomes its start value (the own property must not shadow the accessor)', async () => {
    counter++;
    document.body.innerHTML = `<${tag()} name="x"></${tag()}>`;
    const el = document.querySelector(tag());
    el.value = 'early';
    defineLate();
    expect(el.value).toBe('early');
    expect(el.dirty).toBe(false); // the early value is the baseline, like an attribute
    el.setValue('later');
    expect(el.value).toBe('later');
    expect(el.dirty).toBe(true);
    document.body.innerHTML = '';
  });
});
