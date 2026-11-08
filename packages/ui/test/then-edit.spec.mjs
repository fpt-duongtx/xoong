import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mount, mockApi, respond } from '@xoong/test';
import '@xoong/ui';
import { html, render, signal, XoElement, define } from '@xoong/core';

const table = {
  version: 1,
  entities: { Article: { id: 'id' } },
  operations: {
    getSettings: { id: 'getSettings', method: 'GET', path: '/settings', response: { t: 'object', props: { siteName: { t: 'string' } } } },
    updateSettings: { id: 'updateSettings', method: 'PUT', path: '/settings', body: true, response: null, bodyFields: [{ name: 'siteName', type: 'string' }],
      bodySchema: { t: 'object', required: ['siteName'], props: { siteName: { t: 'string' } } } },
    createArticle: { id: 'createArticle', method: 'POST', path: '/articles', body: true, response: { t: 'entity', name: 'Article' }, bodyFields: [{ name: 'title', type: 'string' }],
      bodySchema: { t: 'object', required: ['title'], props: { title: { t: 'string' } } } },
    getArticle: { id: 'getArticle', method: 'GET', path: '/articles/{id}', response: { t: 'entity', name: 'Article' } },
  },
};
let screen;
beforeEach(() => { history.replaceState(null, '', '/'); });
afterEach(() => { screen?.unmount(); history.replaceState(null, '', '/'); });
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));

describe('a PUT form inside a view with data is an edit form', () => {
  it('starts from the record without xo-body, although the path has no parameter', async () => {
    screen = await mount(`<xo-view get="getSettings"><form xo-submit="updateSettings"><input name="siteName"><button>Save</button></form></xo-view>`,
      { api: mockApi(table, { getSettings: () => ({ siteName: 'Rainlet' }), updateSettings: () => respond(204, null) }) });
    await wait();
    expect(screen.$('input[name=siteName]').value).toBe('Rainlet');
  });
});

describe('xo-then goes on after success', () => {
  it('{id} comes from the created record; the router navigates', async () => {
    screen = await mount(`<xo-router><template xo-route="/"><xo-view><form xo-submit="createArticle" xo-then="/articles/{id}"><input name="title"><button>Create</button></form></xo-view></template>
      <template xo-route="/articles/:id"><p id="there">article</p></template></xo-router>`,
      { api: mockApi(table, { createArticle: () => ({ id: 42, title: 'Hi' }) }) });
    await wait();
    const input = screen.$('input[name=title]');
    input.value = 'Hi'; input.dispatchEvent(new Event('input', { bubbles: true }));
    screen.$('form').requestSubmit();
    await wait(80);
    expect(location.pathname).toBe('/articles/42');
    expect(screen.$('#there')).toBeTruthy();
  });
});

describe('a child that reads state while it connects does not subscribe its parent binding', () => {
  it('inserting content inside a reactive child binding does not re-run the binding', () => {
    const items = signal([1, 2]);
    const spy = signal(0);
    let connects = 0, runs = 0;
    class Probe extends XoElement { connected() { connects++; spy.value; } } // reads a signal while connecting
    define('xo-probe-then', Probe);
    const host = document.createElement('div');
    document.body.append(host);
    const dispose = render(html`<div>${() => { runs++; return items.value.map((i) => html`<xo-probe-then>${i}</xo-probe-then>`); }}</div>`, host);
    const before = runs;
    spy.value = 1; spy.value = 2; // would re-run the binding if a child's read subscribed it
    expect(runs).toBe(before);
    expect(connects).toBeGreaterThan(0);
    dispose?.();
    host.remove();
  });
});
