import { describe, it, expect, afterEach, vi } from 'vitest';
import '@xoong/controls';

const wait = () => new Promise((r) => setTimeout(r, 0));
const OPTIONS = '<option value="1">Ada Lovelace</option><option value="2">Grace Hopper</option><option value="3" disabled>Alan Turing</option><option value="4">Barbara Liskov</option>';
const mount = async (tag = 'xo-combobox', attrs = '', inner = OPTIONS, wrap = '') => {
  document.body.innerHTML = `<form>${wrap}<${tag} name="f" label="Person" ${attrs}>${inner}</${tag}></form><p id="outside">x</p>`;
  await wait();
  return document.querySelector(tag);
};
const input = () => document.querySelector('.xo-combobox-input');
const list = () => document.querySelector('[role=listbox]');
const opts = () => [...document.querySelectorAll('[role=option]')].map((o) => o.textContent);
const chips = () => [...document.querySelectorAll('.xo-chip')].map((c) => c.firstChild.textContent);
const type = (text) => { input().value = text; input().dispatchEvent(new Event('input', { bubbles: true })); };
const key = (k) => { const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); input().dispatchEvent(e); return e; };

afterEach(() => { document.body.innerHTML = ''; });

describe('<xo-combobox> on a page that already holds the drawn control', () => {
  it('draws it once: a prerendered box and list are replaced, not doubled', async () => {
    const prerendered = '<div class="xo-combobox-box"><input class="xo-combobox-input" role="combobox"></div><ul class="xo-combobox-list" role="listbox" hidden></ul>';
    await mount('xo-combobox', '', OPTIONS + prerendered);
    expect(document.querySelectorAll('xo-combobox .xo-combobox-box')).toHaveLength(1);
    expect(document.querySelectorAll('xo-combobox [role=listbox]')).toHaveLength(1);
    expect(document.querySelectorAll('xo-combobox .xo-combobox-input')).toHaveLength(1);
  });
});

describe('<xo-combobox> (single)', () => {
  it('is a combobox with a listbox: roles and the label, options read from <option> children', async () => {
    const el = await mount();
    expect(input().getAttribute('role')).toBe('combobox');
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(input().getAttribute('aria-controls')).toBe(list().id);
    expect(input().getAttribute('aria-label')).toBe('Person');
    expect(list().hidden).toBe(true);
    expect(el.options.map((o) => o.label)).toEqual(['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Barbara Liskov']);
    expect(document.querySelectorAll('xo-combobox > option').length).toBe(0); // the control draws its own content
  });

  it('ArrowDown opens the list; typing filters; Enter picks the highlighted option and sets the value and the field text', async () => {
    const el = await mount();
    const seen = [];
    el.addEventListener('input', () => seen.push(['input', el.value]));
    el.addEventListener('change', () => seen.push(['change', el.value]));
    key('ArrowDown');
    expect(list().hidden).toBe(false);
    expect(input().getAttribute('aria-expanded')).toBe('true');
    expect(opts()).toEqual(['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Barbara Liskov']);
    type('ra');
    expect(opts()).toEqual(['Grace Hopper', 'Barbara Liskov']);
    key('ArrowDown'); // Barbara
    expect(input().getAttribute('aria-activedescendant')).toBe(document.querySelectorAll('[role=option]')[1].id);
    key('Enter');
    expect(el.value).toBe('4');
    expect(input().value).toBe('Barbara Liskov');
    expect(list().hidden).toBe(true);
    expect(seen).toEqual([['input', '4'], ['change', '4']]); // the inner field's own events do not leak
  });

  it('disabled options are skipped by the arrows and cannot be picked; Escape closes and restores the text', async () => {
    const el = await mount('xo-combobox', '', OPTIONS, '');
    el.setValue('1');
    expect(input().value).toBe('Ada Lovelace');
    key('ArrowDown');
    key('ArrowDown'); // Grace
    key('ArrowDown'); // skips Alan (disabled) -> Barbara
    expect(document.querySelector('.xo-active').textContent).toBe('Barbara Liskov');
    document.querySelector('[role=option][aria-disabled=true]').click();
    expect(el.value).toBe('1');
    type('zzz');
    expect(document.querySelector('.xo-empty').textContent).toBe('No results');
    key('Escape');
    expect(list().hidden).toBe(true);
    expect(input().value).toBe('Ada Lovelace');
  });

  it('a click on an option picks it; the value attribute and `selected` give the start value; required and dirty work like a native control', async () => {
    const el = await mount('xo-combobox', 'required', OPTIONS.replace('value="2"', 'value="2" selected'));
    expect(el.value).toBe('2');
    expect(el.dirty).toBe(false);
    key('ArrowDown');
    document.querySelectorAll('[role=option]')[0].click();
    expect(el.value).toBe('1');
    expect(el.dirty).toBe(true);
    el.setValue('');
    expect(el.validity.valueMissing).toBe(true);
    expect(el.validationMessage).not.toBe('');
  });

  it('`options` can be set from JavaScript (strings or { value, label })', async () => {
    const el = await mount('xo-combobox', '', '');
    el.options = ['draft', { value: 'pub', label: 'Published' }];
    el.setValue('pub');
    expect(input().value).toBe('Published');
    key('ArrowDown');
    expect(opts()).toEqual(['draft', 'Published']);
  });

  it('`remote` leaves filtering to the app: xo-search carries the query', async () => {
    const el = await mount('xo-combobox', 'remote');
    const queries = [];
    el.addEventListener('xo-search', (e) => queries.push(e.detail.query));
    type('gr');
    expect(queries).toEqual(['gr']);
    expect(opts().length).toBe(4); // not filtered locally
    el.options = [{ value: '9', label: 'From server' }];
    expect(opts()).toEqual(['From server']);
  });

  it('a click outside closes the list and marks the control touched', async () => {
    const el = await mount();
    key('ArrowDown');
    document.querySelector('#outside').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(list().hidden).toBe(true);
    input().dispatchEvent(new FocusEvent('blur'));
    await new Promise((r) => setTimeout(r, 5));
    expect(el.touched).toBe(true);
  });
});

describe('<xo-combobox multiple> and <xo-tags>', () => {
  it('multiple: picks add chips and keep the list open; chosen options leave the list; the value is an array', async () => {
    const el = await mount('xo-combobox', 'multiple');
    key('ArrowDown');
    key('Enter'); // Ada
    expect(el.value).toEqual(['1']);
    expect(chips()).toEqual(['Ada Lovelace']);
    expect(list().hidden).toBe(false);
    expect(opts()).toEqual(['Grace Hopper', 'Alan Turing', 'Barbara Liskov']);
    key('Enter'); // Grace
    expect(el.value).toEqual(['1', '2']);
    expect(el.dirty).toBe(true);
  });

  it('Backspace on an empty field removes the last chip; the chip button removes its own', async () => {
    const el = await mount('xo-combobox', 'multiple', OPTIONS);
    el.setValue(['1', '2', '4']);
    expect(chips()).toEqual(['Ada Lovelace', 'Grace Hopper', 'Barbara Liskov']);
    key('Backspace');
    expect(el.value).toEqual(['1', '2']);
    document.querySelector('.xo-chip button[data-value="1"]').click();
    expect(el.value).toEqual(['2']);
    expect(document.querySelector('.xo-chip button').getAttribute('aria-label')).toBe('Remove Grace Hopper');
    type('x');
    key('Backspace'); // there is text: Backspace edits it
    expect(el.value).toEqual(['2']);
  });

  it('a comma-separated value attribute and a string value are read as a list', async () => {
    const el = await mount('xo-combobox', 'multiple value="1,4"');
    expect(el.value).toEqual(['1', '4']);
    el.setValue('2, 4');
    expect(el.value).toEqual(['2', '4']);
  });

  it('<xo-tags>: Enter or a comma adds typed text as a chip, duplicates are ignored, blur commits what is typed', async () => {
    const el = await mount('xo-tags', 'placeholder="Add a keyword"', '');
    expect(input().placeholder).toBe('Add a keyword');
    type('alpha');
    expect(opts()).toEqual(['Add "alpha"']);
    key('Enter');
    expect(el.value).toEqual(['alpha']);
    type('beta');
    const comma = key(',');
    expect(comma.defaultPrevented).toBe(true);
    expect(el.value).toEqual(['alpha', 'beta']);
    type('alpha');
    key('Enter');
    expect(el.value).toEqual(['alpha', 'beta']); // already there
    type('gamma');
    input().dispatchEvent(new FocusEvent('blur'));
    await new Promise((r) => setTimeout(r, 5));
    expect(el.value).toEqual(['alpha', 'beta', 'gamma']);
    expect(chips()).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('Enter does not submit the form while the list is open', async () => {
    await mount('xo-tags', '', '');
    const submitted = vi.fn((e) => e.preventDefault());
    document.querySelector('form').addEventListener('submit', submitted);
    type('x');
    const e = key('Enter');
    expect(e.defaultPrevented).toBe(true);
  });

  it('creatable single: a typed value that is not in the list can be added', async () => {
    const el = await mount('xo-combobox', 'creatable');
    type('Someone new');
    key('Enter');
    expect(el.value).toBe('Someone new');
    expect(input().value).toBe('Someone new');
  });

  it('serialises an array as one form entry per value', async () => {
    const el = await mount('xo-combobox', 'multiple');
    el.setValue(['1', '2']);
    const data = el.serialize(el.value);
    if (typeof FormData !== 'undefined' && data instanceof FormData) expect(data.getAll('f')).toEqual(['1', '2']);
    else expect(data).toBe('["1","2"]');
  });

  it('a schema node gives the options (an enum) and multiple (an array of an enum); markup options win', async () => {
    const el = await mount('xo-combobox', '', '');
    el.schema = { t: 'string', enum: ['draft', 'published'] };
    el.setValue('draft');
    expect(input().value).toBe('draft');
    key('ArrowDown');
    expect(opts()).toEqual(['draft', 'published']);
    const tags = await mount('xo-combobox', '', '');
    tags.schema = { t: 'array', items: { t: 'string', enum: ['a', 'b'] } };
    expect(tags.multiple).toBe(true);
    tags.setValue(['a']);
    expect(chips()).toEqual(['a']);
    const own = await mount('xo-combobox', '', OPTIONS);
    own.schema = { t: 'string', enum: ['x'] };
    expect(own.options.map((o) => o.label)).toContain('Ada Lovelace');
    expect(own.options.map((o) => o.label)).not.toContain('x');
  });

  it('options and a value set before the element is defined survive the upgrade', async () => {
    const el = document.createElement('xo-combobox-late'); // the tag is not defined yet: a plain element
    el.setAttribute('name', 'f');
    el.options = ['a', 'b'];
    el.value = 'b';
    document.body.append(el);
    customElements.define('xo-combobox-late', class extends customElements.get('xo-combobox') {}); // the upgrade runs now
    await wait();
    expect(el.options.map((o) => o.value)).toEqual(['a', 'b']);
    expect(el.value).toBe('b');
    expect(el.querySelector('.xo-combobox-input').value).toBe('b');
  });
});
