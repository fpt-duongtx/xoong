// What the AI benchmark found models get wrong, and nothing said so: an element that acts through an <xo-view> outside one, an xo-each that does not match the
// response of the view's operation, and an expression where a path is read. XO277, XO278 and XO279, and the response shape in the operations list.
import { describe, it, expect } from 'vitest';
import { checkHtml, describeResponse } from '../src/check.js';

const table = { operations: {
  listPosts: { id: 'listPosts', method: 'GET', path: '/posts', response: { t: 'array', items: { t: 'entity', name: 'Post' } } },
  listUsers: { id: 'listUsers', method: 'GET', path: '/users', query: ['limit'], response: { t: 'object', props: { items: { t: 'array', items: { t: 'entity', name: 'User' } }, total: { t: 'integer' } } } },
  createUser: { id: 'createUser', method: 'POST', path: '/users', bodyFields: [{ name: 'name', required: true }], response: { t: 'entity', name: 'User' } },
  deleteUser: { id: 'deleteUser', method: 'DELETE', path: '/users/{id}' },
  bare: { id: 'bare', method: 'GET', path: '/bare' },
  ping: { id: 'ping', method: 'GET', path: '/ping', response: { t: 'object', props: { ok: { t: 'boolean' } } } },
} };
const codes = (html, options) => checkHtml(html, table, 'a.html', options).map((f) => f.code);
const first = (html, options) => checkHtml(html, table, 'a.html', options)[0];

describe('describeResponse: the shape of a response in a few words', () => {
  it('an array of records, an object with an array field, one record, scalars, nothing', () => {
    expect(describeResponse(table.operations.listPosts.response)).toBe('Post[]');
    expect(describeResponse(table.operations.listUsers.response)).toBe('{ items: User[], total: integer }');
    expect(describeResponse(table.operations.createUser.response)).toBe('User');
    expect(describeResponse(table.operations.ping.response)).toBe('{ ok: boolean }');
    expect(describeResponse(undefined)).toBe('');
    expect(describeResponse({ t: 'array', items: { t: 'string' } })).toBe('string[]');
  });
});

describe('XO277: what acts through a view is inside one', () => {
  it('<xo-form> outside an <xo-view> is an error with the fix, inside one (even without get) it is fine', () => {
    const f = first('<section><xo-form op="POST /users" submit="Add"></xo-form></section>');
    expect(f).toMatchObject({ code: 'XO277', level: 'error' });
    expect(f.fix).toContain('<xo-view><xo-form');
    expect(codes('<xo-view><xo-form op="POST /users" submit="Add"></xo-form></xo-view>')).toEqual([]);
    expect(codes('<xo-view get="listUsers"><xo-dialog id="d"><xo-view><xo-form op="POST /users"></xo-form></xo-view></xo-dialog></xo-view>')).toEqual([]);
  });

  it('xo-click, xo-param and xo-refresh outside a view do nothing, and that is said', () => {
    expect(codes('<button xo-click="DELETE /users/{id}">x</button>')).toEqual(['XO277']);
    expect(codes('<button xo-param="limit=5">5</button><xo-view get="listUsers"><li xo-each="items">{name}</li></xo-view>')).toEqual(['XO277']);
    expect(codes('<button xo-refresh>again</button>')).toEqual(['XO277']);
    expect(codes('<xo-view get="listUsers"><button xo-param="limit=5">5</button><button xo-refresh>again</button><li xo-each="items"><button xo-click="DELETE /users/{id}">x</button></li></xo-view>')).toEqual([]);
  });

  it('a fragment (an html`...` template, a piece of a page) is not judged: its view may be around it', () => {
    expect(codes('<xo-form op="POST /users"></xo-form><button xo-param="limit=5">5</button>', { fragment: true })).toEqual([]);
  });
});

describe('XO278: xo-each follows the response of the view\'s operation', () => {
  it('an array response is repeated with ".", not by a field name', () => {
    const f = first('<xo-view get="listPosts"><li xo-each="items">{title}</li></xo-view>');
    expect(f).toMatchObject({ code: 'XO278', level: 'error' });
    expect(f.message).toContain('returns an array (Post[])');
    expect(f.fix).toBe('Repeat the response itself: xo-each="."');
    expect(codes('<xo-view get="listPosts"><li xo-each=".">{title}</li></xo-view>')).toEqual([]);
    expect(codes('<xo-view get="/posts"><li xo-each=".">{title}</li></xo-view>')).toEqual([]);
  });

  it('an object response is repeated by the name of an array field, with the closest name for a typo', () => {
    expect(codes('<xo-view get="listUsers"><li xo-each="items">{name}</li></xo-view>')).toEqual([]);
    const typo = first('<xo-view get="listUsers"><li xo-each="itms">{name}</li></xo-view>');
    expect(typo).toMatchObject({ code: 'XO278', level: 'error' });
    expect(typo.message).toContain('closest: "items"');
    expect(typo.fix).toBe('Repeat an array field: xo-each="items"');
    const dot = first('<xo-view get="listUsers"><li xo-each=".">{name}</li></xo-view>');
    expect(dot.message).toContain('returns an object');
    expect(dot.fix).toBe('Repeat its array field: xo-each="items"');
  });

  it('only the first xo-each of a view is judged (the inner ones read the item), "$..." variables and unknown responses are not', () => {
    expect(codes('<xo-view get="listUsers"><li xo-each="items"><b xo-each="tags">{.}</b></li></xo-view>')).toEqual([]);
    expect(codes('<xo-view get="listUsers"><li xo-each="$selected">{.}</li></xo-view>')).toEqual([]);
    expect(codes('<xo-view get="bare"><li xo-each="anything">x</li></xo-view>')).toEqual([]); // a response nobody described: nothing to compare with
    expect(codes('<xo-view><li xo-each="items">{name}</li></xo-view>')).toEqual([]); // no get: nothing to compare with
  });
});

describe('XO279: {...} is a path, not an expression', () => {
  it('a negation, a comparison or a condition in an attribute is said to stay as written', () => {
    const f = first('<xo-view get="listUsers"><button xo-param="limit-=5" hidden="{!$hasPrev}">Previous</button></xo-view>');
    expect(f).toMatchObject({ code: 'XO279', level: 'warn' });
    expect(f.fix).toContain('xo-if="!path"');
    expect(codes('<xo-view get="listUsers"><button disabled="{a && b}">x</button></xo-view>')).toEqual(['XO279']);
    expect(codes('<xo-view get="listUsers"><button disabled="{n > 1}">x</button></xo-view>')).toEqual(['XO279']);
  });

  it('a path (with a format), a literal JSON value, and anything outside a view are fine', () => {
    expect(codes('<xo-view get="listUsers"><button hidden="{flag}" title="{name | upper}" data-x=\'{"a":1}\' class="{status}">x</button></xo-view>')).toEqual([]);
    expect(codes('<p hidden="{!flag}">x</p>')).toEqual([]);
  });
});
