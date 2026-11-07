import { describe, it, expect, afterEach } from 'vitest';
import { parsePath, pathKey, getAt, setAt, nodeAt, coerce, defaults, validate, checkValue, setMessages, resetMessages, message } from '../src/schema.js';

const str = (extra = {}) => ({ t: 'string', ...extra });
const article = {
  t: 'object', required: ['slug', 'title', 'rating'],
  props: {
    slug: str({ pattern: '^[a-z0-9-]+$', minLength: 3, maxLength: 12 }),
    title: { t: 'object', required: ['en'], props: { en: str(), vi: str() } },
    rating: { t: 'integer', minimum: 1, maximum: 5 },
    price: { t: 'number', exclusiveMinimum: 0, multipleOf: 0.5, nullable: true },
    email: str({ format: 'email' }),
    kind: str({ enum: ['a', 'b'] }),
    tags: { t: 'array', items: str({ maxLength: 4 }), maxItems: 3, uniqueItems: true },
    blocks: { t: 'array', minItems: 1, items: { t: 'union', key: 'type', map: { text: { t: 'object', required: ['body'], props: { type: str(), body: str() } }, image: { t: 'object', required: ['url'], props: { type: str(), url: str({ format: 'uri' }) } } } } },
    createdAt: str({ readOnly: true }),
  },
};

afterEach(resetMessages);

describe('paths', () => {
  it('parses dotted and bracket paths the same way, and writes the canonical form', () => {
    expect(parsePath('items[2].title')).toEqual(['items', 2, 'title']);
    expect(parsePath('items.2.title')).toEqual(['items', 2, 'title']);
    expect(parsePath('a')).toEqual(['a']);
    expect(parsePath('')).toEqual([]);
    expect(pathKey(['items', 2, 'title', 'en'])).toBe('items[2].title.en');
    expect(pathKey([0, 'x'])).toBe('[0].x');
  });

  it('getAt reads through missing steps, setAt writes a copy without touching the original', () => {
    const v = { a: { b: [1, 2] } };
    expect(getAt(v, ['a', 'b', 1])).toBe(2);
    expect(getAt(v, ['a', 'x', 'y'])).toBeUndefined();
    const next = setAt(v, ['a', 'b', 1], 9);
    expect(next).toEqual({ a: { b: [1, 9] } });
    expect(v).toEqual({ a: { b: [1, 2] } });
    expect(next.a).not.toBe(v.a);
    expect(setAt({}, ['x', 'y', 0, 'z'], 1)).toEqual({ x: { y: [{ z: 1 }] } });
    expect(setAt({ a: 1, b: 2 }, ['a'], undefined)).toEqual({ b: 2 }); // undefined removes the key
    const arr = setAt({ l: [1, 2, 3] }, ['l', 1], undefined);
    expect(arr.l).toHaveLength(3);
  });

  it('structure is shared: untouched branches keep their identity (what makes per-path updates cheap)', () => {
    const v = { a: { x: 1 }, b: { y: 2 } };
    const next = setAt(v, ['a', 'x'], 5);
    expect(next.b).toBe(v.b);
  });
});

describe('nodeAt', () => {
  it('finds nodes through objects, arrays and the variant a union picks from the value', () => {
    expect(nodeAt(article, ['title', 'en']).t).toBe('string');
    expect(nodeAt(article, ['tags', 1]).maxLength).toBe(4);
    expect(nodeAt(article, ['nope'])).toBeUndefined();
    const value = { blocks: [{ type: 'image', url: 'x' }, { type: 'text' }] };
    expect(nodeAt(article, ['blocks', 0, 'url'], value).format).toBe('uri');
    expect(nodeAt(article, ['blocks', 1, 'body'], value).t).toBe('string');
    expect(nodeAt(article, ['blocks', 1, 'url'], value)).toBeUndefined(); // that variant has no url
    expect(nodeAt(article, ['blocks', 2, 'url'], value)).toBeUndefined(); // no such item: no variant to pick
  });
});

describe('coerce and defaults', () => {
  it('turns control strings into typed values; empty text is nothing (null for nullable); a bad number stays text', () => {
    expect(coerce({ t: 'integer' }, '42')).toBe(42);
    expect(coerce({ t: 'number' }, '1.5')).toBe(1.5);
    expect(coerce({ t: 'integer' }, '')).toBeUndefined();
    expect(coerce({ t: 'number', nullable: true }, '')).toBeNull();
    expect(coerce({ t: 'integer' }, 'abc')).toBe('abc');
    expect(coerce({ t: 'boolean' }, 'on')).toBe(true);
    expect(coerce({ t: 'boolean' }, false)).toBe(false);
    expect(coerce(str(), '')).toBeUndefined();
    expect(coerce(str(), 'x')).toBe('x');
    expect(coerce(undefined, 'raw')).toBe('raw');
  });

  it('defaults: explicit defaults, and {} for required nested objects only', () => {
    expect(defaults({ t: 'object', required: ['o'], props: { a: str({ default: 'x' }), o: { t: 'object', props: { n: { t: 'integer', default: 3 } } }, p: { t: 'object', props: {} } } })).toEqual({ a: 'x', o: { n: 3 } });
    expect(defaults({ t: 'array', minItems: 1, items: str() })).toEqual([]);
    expect(defaults(str())).toBeUndefined();
  });
});

describe('validate', () => {
  const ok = { slug: 'my-slug', title: { en: 'Hi' }, rating: 3 };

  it('accepts a valid record and ignores read-only and unknown properties', () => {
    expect(validate(article, { ...ok, createdAt: 12345, extra: 1 })).toEqual({});
  });

  it('required: missing, empty string and null (unless nullable) are errors, with the path', () => {
    expect(validate(article, {})).toEqual({ slug: 'Please fill in this field.', title: 'Please fill in this field.', rating: 'Please fill in this field.' });
    expect(validate(article, { ...ok, slug: '' }).slug).toBe('Please fill in this field.');
    expect(validate(article, { ...ok, title: { en: '' } })['title.en']).toBe('Please fill in this field.');
    expect(validate({ t: 'object', required: ['n'], props: { n: { t: 'integer', nullable: true } } }, { n: null })).toEqual({});
  });

  it('strings: length, pattern, format, enum', () => {
    expect(validate(article, { ...ok, slug: 'ab' }).slug).toBe('Use at least 3 characters.');
    expect(validate(article, { ...ok, slug: 'a'.repeat(13) }).slug).toBe('Use at most 12 characters.');
    expect(validate(article, { ...ok, slug: 'Bad Slug' }).slug).toBe('This does not match the expected format.');
    expect(validate(article, { ...ok, email: 'nope' }).email).toBe('Enter a valid email address.');
    expect(validate(article, { ...ok, email: 'a@b.co' })).toEqual({});
    expect(validate(article, { ...ok, kind: 'z' }).kind).toBe('Choose one of the listed values.');
  });

  it('numbers: type, integer, bounds, exclusive bounds, multipleOf', () => {
    expect(validate(article, { ...ok, rating: 'abc' }).rating).toBe('Enter a whole number.');
    expect(validate(article, { ...ok, rating: 2.5 }).rating).toBe('Enter a whole number.');
    expect(validate(article, { ...ok, rating: 0 }).rating).toBe('Must be at least 1.');
    expect(validate(article, { ...ok, rating: 6 }).rating).toBe('Must be at most 5.');
    expect(validate(article, { ...ok, price: 0 }).price).toBe('Must be greater than 0.');
    expect(validate(article, { ...ok, price: 1.3 }).price).toBe('Must be a multiple of 0.5.');
    expect(validate(article, { ...ok, price: 1.5 })).toEqual({});
    expect(validate(article, { ...ok, price: null })).toEqual({});
  });

  it('arrays: min/max items, unique items, and every item by index path', () => {
    expect(validate(article, { ...ok, tags: ['a', 'b', 'c', 'd'] }).tags).toBe('Add at most 3.');
    expect(validate(article, { ...ok, tags: ['a', 'a'] }).tags).toBe('Items must be different from each other.');
    expect(validate(article, { ...ok, tags: ['ok', 'toolong'] })).toEqual({ 'tags[1]': 'Use at most 4 characters.' });
    expect(validate(article, { ...ok, blocks: [] }).blocks).toBe('Add at least 1.');
  });

  it('unions: the variant picked by the tag is validated, with item paths; an unknown tag is an error on the tag', () => {
    const errs = validate(article, { ...ok, blocks: [{ type: 'text', body: '' }, { type: 'image', url: 'not a url' }, { type: 'video' }] });
    expect(errs).toEqual({
      'blocks[0].body': 'Please fill in this field.',
      'blocks[1].url': 'Enter a valid URL.',
      'blocks[2].type': 'Choose a type.',
    });
  });

  it('a nested path error uses the canonical path key', () => {
    expect(Object.keys(validate(article, { ...ok, title: { en: 'x', vi: 5 } }))).toEqual(['title.vi']);
  });

  it('a pattern JavaScript cannot read does not block the form', () => {
    expect(checkValue(str({ pattern: '(?<bad' }), 'x')).toBe('');
  });
});

describe('messages', () => {
  it('can be replaced per code (another language) and restored', () => {
    setMessages({ required: () => 'Bắt buộc', minLength: ({ min }) => `Ít nhất ${min} ký tự` });
    expect(validate(article, {}).slug).toBe('Bắt buộc');
    expect(validate(article, { ...{ slug: 'ab', title: { en: 'x' }, rating: 3 } }).slug).toBe('Ít nhất 3 ký tự');
    expect(message('maximum', { max: 9 })).toBe('Must be at most 9.'); // untouched ones keep the default
    resetMessages();
    expect(validate(article, {}).slug).toBe('Please fill in this field.');
  });
});
