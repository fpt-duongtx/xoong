import { describe, it, expect } from 'vitest';
import { checkHtml } from '../src/check.js';

const t = { operations: { getUser: { id: 'getUser', method: 'GET', path: '/users/{id}' } } };
const found = (html) => checkHtml(html, t).map((f) => f.code);
const app = (inner) => `<xo-router><template xo-layout="shell"><main xo-outlet></main></template>${inner}</xo-router>`;

describe('xoong check: router', () => {
  it('accepts a correct router, with nested layouts and route parameters in views', () => {
    expect(found(`<xo-router>
      <template xo-layout="root"><header></header><div xo-outlet></div></template>
      <template xo-layout="shell" layout="root"><nav></nav><section><main xo-outlet></main></section></template>
      <template xo-route="/" layout="shell"><p>home</p></template>
      <template xo-route="/users/:id" layout="shell"><xo-view get="getUser" p-id=":id"><b>{name}</b></xo-view></template>
      <template xo-route="*"><p>404</p></template></xo-router>`)).toEqual([]);
  });

  it('XO260: a route path must start with "/" or be *, and may be declared once', () => {
    expect(found(app('<template xo-route="users"><p>x</p></template>'))).toEqual(['XO260']);
    expect(found(app('<template xo-route=""><p>x</p></template>'))).toEqual(['XO260']);
    expect(found(app('<template xo-route="/a"><p>1</p></template><template xo-route="/a"><p>2</p></template>'))).toEqual(['XO260']);
  });

  it('XO261: a layout that is not declared, with the closest name', () => {
    const f = checkHtml(app('<template xo-route="/" layout="shel"><p>x</p></template>'), t)[0];
    expect(f).toMatchObject({ code: 'XO261', level: 'error' });
    expect(f.message).toContain('closest: "shell"');
    expect(f.fix).toBe('Use layout="shell"');
  });

  it('XO262: a layout without xo-outlet', () => {
    expect(found('<xo-router><template xo-layout="shell"><main></main></template><template xo-route="/" layout="shell"><p>x</p></template></xo-router>')).toEqual(['XO262']);
  });

  it('XO263: p-x=":name" outside a route, or naming a parameter the route does not have', () => {
    expect(found('<xo-view get="getUser" p-id=":id"></xo-view>')).toEqual(['XO263']);
    const f = checkHtml(app('<template xo-route="/users/:id" layout="shell"><xo-view get="getUser" p-id=":ids"></xo-view></template>'), t)[0];
    expect(f).toMatchObject({ code: 'XO263' });
    expect(f.fix).toBe('Use p-id=":id"');
    expect(found(app('<template xo-route="/users" layout="shell"><xo-view get="getUser" p-id=":id"></xo-view></template>'))).toEqual(['XO263']);
  });

  it('XO230 still catches a typo in the router names', () => {
    expect(found('<xo-routr></xo-routr><template xo-rout="/x"></template>')).toEqual(['XO230', 'XO230']);
  });
});
