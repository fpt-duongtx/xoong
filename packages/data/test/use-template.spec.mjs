// <template xo-define="name"> and xo-use="name": a template chosen by name or by a value of the data, and a template that uses itself (a tree).
import { describe, it, expect, afterEach, vi } from 'vitest';
import { mount, mockApi } from '@xoong/test';

const table = { operations: { getTree: { id: 'getTree', method: 'GET', path: '/tree', response: { t: 'object', props: {} } }, getPage: { id: 'getPage', method: 'GET', path: '/page', response: { t: 'object', props: {} } } } };
let screen;
afterEach(() => { screen?.unmount(); vi.restoreAllMocks(); });

const tree = { label: 'root', children: [{ label: 'a', children: [{ label: 'a1', children: [] }] }, { label: 'b', children: [] }] };
const NODE = '<template xo-define="node"><span>{label}</span><ul><li xo-each="children" xo-use="node"></li></ul></template>';

describe('xo-use: a template that uses itself', () => {
  it('draws a tree of any depth from one template, each level against its own item', async () => {
    screen = await mount(`<xo-view get="/tree">${NODE}<div xo-use="node"></div></xo-view>`, { api: mockApi(table, { getTree: () => tree }) });
    expect(screen.texts('span')).toEqual(['root', 'a', 'a1', 'b']);
    expect(screen.$$('ul ul ul li').length).toBe(0); // a1 has no children: its list is empty
    expect(screen.$$('ul ul li').length).toBe(1); // a1 is a row of the list inside a
  });

  it('a template that never ends is stopped at 32 levels, with one message, and the page stays alive', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    screen = await mount('<xo-view get="/tree"><template xo-define="loop"><div class="l" xo-use="loop"></div></template><p xo-use="loop"></p><b>after</b></xo-view>', { api: mockApi(table, { getTree: () => tree }) });
    expect(screen.$$('.l').length).toBe(32); // the <p> is use 1 and draws the first .l; use 33 is refused
    expect(error.mock.calls.filter((c) => /nests more than 32/.test(String(c[0]))).length).toBe(1);
    expect(screen.text('b')).toBe('after');
  });
});

describe('xo-use: a template chosen by the data', () => {
  const page = { blocks: [{ type: 'text', text: 'Hello' }, { type: 'image', src: '/a.png', alt: 'A' }, { type: 'text', text: 'Bye' }, { type: 'mystery' }] };
  const defs = '<template xo-define="text"><p>{text}</p></template><template xo-define="image"><figure><img src="{src}" alt="{alt}"></figure></template>';

  it('each item uses the template named by its type, and an element with no wrapper keeps the markup valid', async () => {
    screen = await mount(`<xo-view get="/page">${defs}<article><template xo-each="blocks"><template xo-use="{type}"></template></template></article></xo-view>`, { api: mockApi(table, { getPage: () => page }) });
    expect(screen.texts('article > p')).toEqual(['Hello', 'Bye']);
    expect(screen.$$('article > figure img').length).toBe(1);
    expect(screen.$$('article > template, article > xo-use').length).toBe(0);
  });

  it('a name with a part of data ("block-{type}") and an unknown name: the content of the element shows instead', async () => {
    const defs2 = '<template xo-define="block-text"><p>{text}</p></template>';
    screen = await mount(`<xo-view get="/page">${defs2}<template xo-each="blocks"><div class="b" xo-use="block-{type}"><i>unknown block</i></div></template></xo-view>`, { api: mockApi(table, { getPage: () => page }) });
    expect(screen.$$('.b').length).toBe(4);
    expect(screen.texts('.b p')).toEqual(['Hello', 'Bye']);
    expect(screen.texts('.b i')).toEqual(['unknown block', 'unknown block']); // the image and the mystery block
  });

  it('an unknown name with nothing to show says so once in the console and draws nothing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    screen = await mount('<xo-view get="/page"><template xo-each="blocks"><div class="n" xo-use="nope-{type}"></div></template></xo-view>', { api: mockApi(table, { getPage: () => page }) });
    expect(screen.$$('.n').length).toBe(4);
    expect(screen.$$('.n > *').length).toBe(0);
    const named = warn.mock.calls.filter((c) => /no <template xo-define=/.test(String(c[0])));
    expect(named.length).toBe(3); // nope-text, nope-image, nope-mystery: one message per name
  });

  it('a name that is not a plain word (it comes from data) never selects anything', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    screen = await mount('<xo-view get="/page"><template xo-define="x"><p>no</p></template><div class="d" xo-use="{type}"></div></xo-view>', { api: mockApi(table, { getPage: () => ({ type: 'x"] , body [a="' }) }) });
    expect(screen.$$('.d > *').length).toBe(0);
  });

  it('the markup of the page can define a template once for every view of the page', async () => {
    screen = await mount(`<template xo-define="shared"><em>{label}</em></template><xo-view get="/tree"><div xo-use="shared"></div></xo-view>`, { api: mockApi(table, { getTree: () => tree }) });
    expect(screen.texts('em')).toEqual(['root']);
  });
});
