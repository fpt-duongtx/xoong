import { describe, it, expect } from 'vitest';
import { checkHtml } from '../src/check.js';

const t = { operations: { del: { id: 'del', method: 'DELETE', path: '/u/{id}' }, listU: { id: 'listU', method: 'GET', path: '/u' } } };
const codes = (html) => checkHtml(html, t).map((f) => f.code);

describe('xoong check: selection attributes', () => {
  it('accepts xo-selected with xo-click, and xo-select on a checkbox', () => {
    expect(codes('<xo-view get="/u"><li xo-each="."><input type="checkbox" xo-select></li><button xo-click="DELETE /u/{id}" xo-selected>x</button></xo-view>')).toEqual([]);
  });

  it('XO254: xo-selected without xo-click, xo-select off a checkbox', () => {
    expect(codes('<button xo-selected>x</button>')).toEqual(['XO254']);
    expect(codes('<input xo-select><div xo-select></div>')).toEqual(['XO254', 'XO254']);
  });
});
