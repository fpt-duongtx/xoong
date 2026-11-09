import { describe, it, expect, afterEach, vi } from 'vitest';
import { mount, mockApi } from '@xoong/test';

const table = {
  version: 1,
  entities: { User: { id: 'id' } },
  operations: { getMe: { id: 'getMe', method: 'GET', path: '/me', response: null }, listUsers: { id: 'listUsers', method: 'GET', path: '/users', response: { t: 'array', items: { t: 'entity', name: 'User' } } } },
};
let screen;
afterEach(() => { screen?.unmount(); vi.restoreAllMocks(); });
const me = { id: 1, name: 'Ada', tags: ['x', 'y'], address: { zip: '700' }, rows: [[1, 2]] };
const show = async (html, data = me) => { screen = await mount(`<xo-view get="getMe">${html}</xo-view>`, { api: mockApi(table, { getMe: () => data }) }); return screen; };

describe('braces that are not a path stay as written', () => {
  it('JSON, CSS and regex quantifiers in text and attributes', async () => {
    const s = await show(`<pre id="j">{ "a": 1 }</pre><code id="c">body { color: red }</code><p id="e">{}</p><input id="i" pattern="\\d{3}" title="[a-z]{2,4}"><p id="m">{"a": {name}, "z": [1, 2]}</p>`);
    expect(s.$('#j').textContent).toBe('{ "a": 1 }');
    expect(s.$('#c').textContent).toBe('body { color: red }');
    expect(s.$('#e').textContent).toBe('{}');
    expect(s.$('#i').getAttribute('pattern')).toBe('\\d{3}');
    expect(s.$('#i').getAttribute('title')).toBe('[a-z]{2,4}');
    expect(s.$('#m').textContent).toBe('{"a": Ada, "z": [1, 2]}'); // a real binding between literal braces still binds
  });
  it('{{name}} is literal, \\{name} escapes one binding, ICU-style text is left alone', async () => {
    const s = await show('<p id="a">price {{name}}</p><p id="b">\\{name} is {name}</p><p id="c">{n, plural, one {# item} other {# items}}</p><p id="d">C:\\{name}</p>');
    expect(s.$('#a').textContent).toBe('price {{name}}');
    expect(s.$('#b').textContent).toBe('{name} is Ada');
    expect(s.$('#c').textContent).toBe('{n, plural, one {# item} other {# items}}');
    expect(s.$('#d').textContent).toBe('C:{name}');
  });
});

describe('everything the syntax has still binds', () => {
  it('paths, view variables, filters and attributes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = await show(`<p id="a">{name}|{ name }|{address.zip}|{tags[1]}|{tags.length}|{rows[0][1]}|{name | json}|{$loading}|{$error}</p>
      <ul id="l"><li xo-each="tags">{$index}:{$n}:{.}</li></ul>
      <i id="t" title="{name}-{address.zip}" data-x="{ name }" aria-label="{tags['0']}"></i>`);
    expect(s.text('#a')).toBe('Ada|Ada|700|y|2|2|"Ada"|false|');
    expect(s.texts('#l li')).toEqual(['0:1:x', '1:2:y']);
    expect(s.$('#t').getAttribute('title')).toBe('Ada-700');
    expect(s.$('#t').getAttribute('data-x')).toBe('Ada');
    expect(s.$('#t').getAttribute('aria-label')).toBe('x');
  });
  it('keys with dashes and @, and a quoted key', async () => {
    const s = await show(`<p>{first-name}|{@id}|{["a b"]}|{.['a b']}</p>`, { 'first-name': 'Ada', '@id': 'u1', 'a b': 'spaced' });
    expect(s.text('p')).toBe('Ada|u1|spaced|spaced');
  });
});
