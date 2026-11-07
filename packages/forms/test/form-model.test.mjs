import { describe, it, expect } from 'vitest';
import { effect } from '@xoong/core/signals';
import { createForm, normalize } from '../src/form-model.js';

const str = (extra = {}) => ({ t: 'string', ...extra });
const localized = { t: 'object', nullable: true, pruneEmpty: true, emptyAs: 'null', props: { en: str(), vi: str(), zh: str() } };
const schema = {
  t: 'object', required: ['slug', 'title'],
  props: {
    slug: str({ pattern: '^[a-z-]+$' }),
    title: { t: 'object', required: ['en'], pruneEmpty: true, props: { en: str(), vi: str() } },
    summary: localized,
    note: str({ nullable: true }),
    age: { t: 'integer', minimum: 0 },
    publishedAt: str({ format: 'date-time' }),
    tags: { t: 'array', items: str(), maxItems: 2 },
    createdAt: str({ readOnly: true }),
  },
};
const record = { id: 7, createdAt: '2026-01-01T00:00:00Z', updatedAt: 'x', slug: 'hello', title: { en: 'Hello', vi: '' }, summary: null, publishedAt: '2026-11-07T19:49:55.398Z' };
const make = (extra = {}) => createForm({ schema, value: record, ...extra });

describe('baseline, draft and dirty', () => {
  it('a form opens pristine: draft equals baseline, nothing touched, valid', () => {
    const f = make();
    expect(f.dirty).toBe(false);
    expect(f.valid).toBe(true);
    expect(f.value).toEqual(record);
    expect(f.baseline).toEqual(record);
  });

  it('the draft is a copy: editing it never changes the record it came from', () => {
    const f = make();
    f.set('slug', 'changed');
    expect(f.get('slug')).toBe('changed');
    expect(record.slug).toBe('hello');
    expect(f.baseline.slug).toBe('hello');
  });

  it('typing and deleting is pristine again, and so is an empty optional string (dirty uses the payload normalisation)', () => {
    const f = make();
    f.set('slug', 'hellox');
    expect(f.dirty).toBe(true);
    f.set('slug', 'hello');
    expect(f.dirty).toBe(false);
    f.set('title.vi', ''); // was '' already
    f.set('note', '');
    expect(f.dirty).toBe(false);
    f.set('title.vi', 'Xin chao');
    expect(f.dirty).toBe(true);
    expect(f.dirtyAt['title.vi']).toBe(true);
    expect(f.dirtyAt['slug']).toBe(false);
  });

  it('coerces control strings to the schema type', () => {
    const f = make();
    f.set('age', '42');
    expect(f.get('age')).toBe(42);
    f.set('age', '');
    expect(f.get('age')).toBeUndefined();
    f.set('note', '');
    expect(f.get('note')).toBeNull(); // nullable: cleared means null
    f.set('tags[1]', 'b');
    expect(f.get('tags')).toEqual([undefined, 'b']);
  });

  it('reset goes back to the baseline; markPristine makes the draft (or the saved record) the new baseline', () => {
    const f = make();
    f.set('slug', 'other');
    f.touch('slug');
    f.reset();
    expect([f.get('slug'), f.dirty, f.touched['slug']]).toEqual(['hello', false, false]);
    f.set('slug', 'saved');
    f.markPristine();
    expect([f.dirty, f.baseline.slug]).toEqual([false, 'saved']);
    f.set('slug', 'again');
    f.markPristine({ ...record, slug: 'from-server', updatedAt: 'new' });
    expect([f.get('slug'), f.baseline.updatedAt, f.dirty]).toEqual(['from-server', 'new', false]);
  });

  it('refresh: a pristine form follows the record, a dirty one keeps the draft and becomes stale', () => {
    const f = make();
    f.refresh({ ...record, slug: 'live-update' });
    expect([f.get('slug'), f.stale]).toEqual(['live-update', false]);
    f.set('slug', 'mine');
    f.refresh({ ...record, slug: 'live-update-2' });
    expect([f.get('slug'), f.stale, f.baseline.slug]).toEqual(['mine', true, 'live-update']);
    f.markPristine();
    expect(f.stale).toBe(false);
  });
});

describe('the payload', () => {
  it('only sends properties of the request schema: ids, timestamps and read-only fields of the record stay out', () => {
    const body = make().body();
    expect(body).not.toHaveProperty('id');
    expect(body).not.toHaveProperty('createdAt');
    expect(body).not.toHaveProperty('updatedAt');
    expect(body.slug).toBe('hello');
  });

  it('empty optional strings are omitted; pruneEmpty drops empty members; an object left empty follows emptyAs', () => {
    const f = make();
    expect(f.body().title).toEqual({ en: 'Hello' }); // vi: '' is dropped
    f.set('summary.en', 'x');
    f.set('summary.vi', '');
    expect(f.body().summary).toEqual({ en: 'x' });
    f.set('summary.en', '');
    expect(f.body().summary).toBeNull(); // every locale empty: the whole optional object is null
    f.set('note', 'n');
    f.set('note', '');
    expect(f.body().note).toBeNull(); // nullable: an explicit null is a value
  });

  it('an untouched date-time keeps its exact original string', () => {
    expect(make().body().publishedAt).toBe('2026-11-07T19:49:55.398Z');
  });

  it('normalize on its own: any nodes are kept, unions follow their variant, emptyAs "null" on a string', () => {
    expect(normalize({ t: 'any' }, { a: 1, b: '' })).toEqual({ a: 1, b: '' });
    const u = { t: 'union', key: 'type', map: { a: { t: 'object', props: { type: str(), n: str({ emptyAs: 'null' }), x: str() } } } };
    expect(normalize(u, { type: 'a', n: '', x: '', junk: 1 })).toEqual({ type: 'a', n: null });
    expect(normalize(u, { type: 'zzz' })).toBeUndefined();
  });

  it('serialize is the escape hatch and receives the draft and the default body', () => {
    const f = make({ serialize: (draft, body) => ({ ...body, extra: draft.id }) });
    expect(f.body().extra).toBe(7);
    expect(f.body().slug).toBe('hello');
  });
});

describe('errors, rules and per-path state', () => {
  it('schema errors are exposed by path, readable per field, and the form is invalid until fixed', () => {
    const f = make();
    f.set('slug', 'Bad Slug');
    f.set('age', '-1');
    expect(f.errors['slug']).toBe('This does not match the expected format.');
    expect(f.errors['age']).toBe('Must be at least 0.');
    expect(f.valid).toBe(false);
    expect(Object.keys(f.errors).sort()).toEqual(['age', 'slug']);
    expect(f.field('slug').valid).toBe(false);
    f.set('slug', 'good');
    expect(f.errors['slug']).toBe('');
    expect('slug' in f.errors).toBe(false);
  });

  it('touched and filled are readable per path, also for paths no control renders (a tab can show a dot)', () => {
    const f = make();
    expect(f.filled['title.en']).toBe(true);
    expect(f.filled['title.vi']).toBe(false);
    expect(f.touched['title.vi']).toBe(false);
    f.touch('title.vi');
    expect(f.touched['title.vi']).toBe(true);
    f.set('title.vi', 'Xin chao');
    expect(f.filled['title.vi']).toBe(true);
  });

  it('custom rules by path: synchronous, with the whole record, and cross-field with "*"', () => {
    const f = make({ rules: {
      slug: (v, { record: r }) => (v === 'taken' ? `Taken (${r.title.en})` : ''),
      '*': (r) => (r.age && r.age > 100 ? { age: 'Too old' } : {}),
    } });
    f.set('slug', 'taken');
    expect(f.errors['slug']).toBe('Taken (Hello)');
    f.set('age', '150');
    expect(f.errors['age']).toBe('Too old');
    f.set('slug', 'free');
    expect(f.errors['slug']).toBe('');
  });

  it('a schema error wins over a custom rule on the same path; a throwing rule becomes an error, not a crash', () => {
    const f = make({ rules: { slug: () => 'custom', age: () => { throw new Error('boom'); } } });
    f.set('slug', 'Bad Slug');
    expect(f.errors['slug']).toBe('This does not match the expected format.');
    expect(f.errors['age']).toBe('boom');
  });

  it('rules for array items: items[].field applies to every item', () => {
    const f = createForm({ schema: { t: 'object', props: { items: { t: 'array', items: { t: 'object', props: { n: str() } } } } }, value: { items: [{ n: 'a' }, { n: 'bad' }, { n: 'c' }] },
      rules: { 'items[].n': (v) => (v === 'bad' ? 'No' : '') } });
    expect(Object.keys(f.errors)).toEqual(['items[1].n']);
    f.set('items[1].n', 'fine');
    expect(Object.keys(f.errors)).toEqual([]);
  });

  it('async rules: pending while running, the answer is applied, a stale answer is ignored', async () => {
    const calls = [];
    const f = make({ rules: { slug: (v) => new Promise((resolve) => { calls.push(v); setTimeout(() => resolve(v === 'taken' ? 'Already used' : ''), v === 'taken' ? 30 : 5); }) } });
    await new Promise((r) => setTimeout(r, 20)); // the rule ran for the initial value
    f.set('slug', 'taken');
    f.set('slug', 'free'); // a newer value: the slow answer for "taken" must not win
    expect(f.pending).toBe(true);
    await new Promise((r) => setTimeout(r, 80));
    expect(f.pending).toBe(false);
    expect(f.errors['slug']).toBe('');
    f.set('slug', 'taken');
    await new Promise((r) => setTimeout(r, 60));
    expect(f.errors['slug']).toBe('Already used');
  });

  it('server errors by path show up, and clear when that field is edited', () => {
    const f = make();
    f.setServerErrors({ slug: 'Slug already exists', 'title.en': 'Bad title' });
    expect(f.errors['slug']).toBe('Slug already exists');
    expect(f.valid).toBe(false);
    f.set('slug', 'another');
    expect(f.errors['slug']).toBe('');
    expect(f.errors['title.en']).toBe('Bad title');
    f.reset();
    expect(f.errors['title.en']).toBe('');
  });
});

describe('reactivity: an edit wakes the readers of that path, not the others', () => {
  it('effects on other fields do not rerun', () => {
    const f = make();
    const runs = { slug: 0, title: 0, whole: 0 };
    effect(() => { f.field('slug').value; runs.slug++; });
    effect(() => { f.field('title.en').value; f.field('title.en').error; runs.title++; });
    effect(() => { f.dirty; runs.whole++; });
    f.set('slug', 'a');
    expect(runs).toEqual({ slug: 2, title: 1, whole: 2 });
    f.set('slug', 'b'); // dirty stays true: the form-level readers do not rerun either
    expect(runs).toEqual({ slug: 3, title: 1, whole: 2 });
    f.set('title.en', 'T');
    expect(runs.title).toBe(2);
    expect(runs.slug).toBe(3);
  });

  it('errors map readers track one path each', () => {
    const f = make();
    let runs = 0;
    effect(() => { f.errors['age']; runs++; });
    f.set('slug', 'ok-slug');
    expect(runs).toBe(1);
    f.set('age', '-5');
    expect(runs).toBe(2);
  });
});

describe('submit', () => {
  it('touches everything and returns the errors without sending when invalid', async () => {
    const f = make();
    f.set('slug', 'Bad Slug');
    let sent = 0;
    const r = await f.submit(async () => { sent++; });
    expect(sent).toBe(0);
    expect(r.ok).toBe(false);
    expect(r.first).toBe('slug');
    expect(r.errors.slug).toBeTruthy();
    expect(f.touched['slug']).toBe(true);
  });

  it('sends the normalised body, tracks submitting, then makes the saved record the baseline', async () => {
    const f = make();
    f.set('slug', 'new-slug');
    let body, during;
    const r = await f.submit(async (b) => { body = b; during = f.submitting; return { ...record, id: 7, slug: 'new-slug', updatedAt: 'later' }; });
    expect(r.ok).toBe(true);
    expect(body.slug).toBe('new-slug');
    expect(body).not.toHaveProperty('id');
    expect(during).toBe(true);
    expect(f.submitting).toBe(false);
    expect([f.dirty, f.baseline.updatedAt]).toEqual([false, 'later']);
  });

  it('a failure with field messages shows them on the paths and rethrows; the draft is kept', async () => {
    const f = make();
    f.set('slug', 'dupe');
    const error = Object.assign(new Error('conflict'), { fields: { slug: 'Slug already exists' } });
    await expect(f.submit(async () => { throw error; })).rejects.toBe(error);
    expect(f.errors['slug']).toBe('Slug already exists');
    expect(f.get('slug')).toBe('dupe');
    expect(f.dirty).toBe(true);
    expect(f.submitting).toBe(false);
  });

  it('waits for async rules before deciding', async () => {
    const f = make({ rules: { slug: (v) => new Promise((r) => setTimeout(() => r(v === 'taken' ? 'Already used' : ''), 10)) } });
    f.set('slug', 'taken');
    let sent = 0;
    const r = await f.submit(async () => { sent++; });
    expect(sent).toBe(0);
    expect(r.errors.slug).toBe('Already used');
  });
});

describe('size: a record with hundreds of fields', () => {
  it('800 text fields in arrays of objects: an edit wakes only that field and stays cheap', () => {
    const blockSchema = { t: 'object', props: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`f${i}`, str({ maxLength: 50 })])) };
    const big = { t: 'object', props: { blocks: { t: 'array', items: blockSchema } } };
    const value = { blocks: Array.from({ length: 40 }, () => Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`f${i}`, `value ${i}`]))) };
    const f = createForm({ schema: big, value });
    let renders = 0;
    for (let b = 0; b < 40; b++) for (let i = 0; i < 20; i++) effect(() => { f.field(`blocks[${b}].f${i}`).value; f.field(`blocks[${b}].f${i}`).error; renders++; });
    expect(renders).toBe(800);
    renders = 0;
    const start = performance.now();
    for (let n = 0; n < 20; n++) f.set('blocks[17].f3', `typed ${n}`);
    const perEdit = (performance.now() - start) / 20;
    expect(renders).toBe(20); // only the edited field's readers ran, 20 times
    expect(perEdit).toBeLessThan(60); // generous: the claim is that it does not grow with the number of fields (the render count above is the exact check)
    expect(f.dirty).toBe(true);
  });
});
