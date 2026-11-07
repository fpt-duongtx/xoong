import { describe, it, expect, afterEach, vi } from 'vitest';
import { parse, formatMessage, argsOf } from '../src/message.js';

const f = (message, args = {}, locale = 'en') => formatMessage(message, (n) => args[n], locale);

describe('the message language (an ICU subset)', () => {
  it('plain text, arguments, and arguments that are missing', () => {
    expect(f('Hello')).toBe('Hello');
    expect(f('Hello {name}!', { name: 'Ada' })).toBe('Hello Ada!');
    expect(f('{a}{b}', { a: 1 })).toBe('1'); // a missing argument is empty
    expect(f('{o}', { o: { x: 1 } })).toBe('{"x":1}');
  });

  it('numbers, dates, times and relative times follow the locale', () => {
    expect(f('{n, number}', { n: 1234567.5 })).toBe('1,234,567.5');
    expect(f('{n, number}', { n: 1234567.5 }, 'de')).toBe('1.234.567,5');
    expect(f('{d, date}', { d: '2026-11-07T10:00:00Z' })).toMatch(/Nov 7, 2026/);
    expect(f('{d, time}', { d: '2026-11-07T10:00:00Z' })).toMatch(/\d{1,2}:\d{2}/);
    expect(f('{d, relative}', { d: new Date(Date.now() - 3 * 86400000).toISOString() })).toBe('3 days ago');
    expect(f('{n, number, percent}', { n: 5 })).toBe('5'); // a style is accepted and ignored
  });

  it('plural: categories from Intl.PluralRules, exact =n matches, # is the formatted number', () => {
    const m = '{count, plural, =0 {No items} one {# item} other {# items}}';
    expect(f(m, { count: 0 })).toBe('No items');
    expect(f(m, { count: 1 })).toBe('1 item');
    expect(f(m, { count: 1500 })).toBe('1,500 items');
    expect(f(m, { count: 2 }, 'vi')).toBe('2 items'); // Vietnamese has only "other"
    const ru = '{n, plural, one {# файл} few {# файла} many {# файлов} other {# файла}}';
    expect([1, 3, 5, 21].map((n) => f(ru, { n }, 'ru'))).toEqual(['1 файл', '3 файла', '5 файлов', '21 файл']);
  });

  it('plural offset, nested arguments, nested plurals', () => {
    const m = '{n, plural, offset:1 =0 {Nobody} =1 {{who}} one {{who} and # other} other {{who} and # others}}';
    expect(f(m, { n: 0, who: 'Ada' })).toBe('Nobody');
    expect(f(m, { n: 1, who: 'Ada' })).toBe('Ada');
    expect(f(m, { n: 2, who: 'Ada' })).toBe('Ada and 1 other');
    expect(f(m, { n: 4, who: 'Ada' })).toBe('Ada and 3 others');
    expect(f('{a, plural, one {{b, plural, one {x} other {y}}} other {z}}', { a: 1, b: 2 })).toBe('y');
  });

  it('select and selectordinal', () => {
    const m = '{g, select, female {her} male {his} other {their}} {n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}';
    expect(f(m, { g: 'female', n: 1 })).toBe('her 1st');
    expect(f(m, { g: 'male', n: 22 })).toBe('his 22nd');
    expect(f(m, { g: 'x', n: 13 })).toBe('their 13th');
  });

  it('quoting: \'{\' and \'}\' are literal braces, \'\' an apostrophe; # outside a plural is just #', () => {
    expect(f("Use '{name}' to insert a name")).toBe('Use {name} to insert a name');
    expect(f("It''s {n}", { n: 5 })).toBe("It's 5");
    expect(f('Item #{n}', { n: 5 })).toBe('Item #5');
    expect(f("don't")).toBe("don't");
  });

  it('argument names may contain $ and dots-free paths used by views ({$from}, {total})', () => {
    expect(f('{$from}–{$to} of {total}', { $from: 1, $to: 3, total: 7 })).toBe('1–3 of 7');
  });

  it('argsOf lists every argument, nested ones included (to check translations keep the same placeholders)', () => {
    expect([...argsOf(parse('{a} {n, plural, one {{b}} other {# {c}}} {g, select, x {{d}} other {}}'))].sort()).toEqual(['a', 'b', 'c', 'd', 'g', 'n']);
  });
});

describe('a message that cannot be read', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is shown as written and reported once, never an exception', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const bad of ['Hello {name', '{n, plural, one {x}}', '{n, bogus}', 'a } b', '{n, plural one {x} other {y}}']) {
      expect(f(bad, { n: 1 })).toBe(bad);
      expect(f(bad, { n: 1 })).toBe(bad);
    }
    expect(error).toHaveBeenCalledTimes(5); // once per message
    expect(error.mock.calls[0][0]).toMatch(/cannot read the message "Hello \{name"/);
  });

  it('parse throws a clear error for the tools that check catalogs', () => {
    expect(() => parse('{n, plural, one {x}}')).toThrow(/needs an "other" case/);
    expect(() => parse('{}')).toThrow(/empty argument/);
  });
});
