import { describe, it, expect, afterEach } from 'vitest';
import { mount, mockApi, respond } from '@xoong/test';
import '@xoong/forms';

const str = (extra = {}) => ({ t: 'string', ...extra });
const bodySchema = {
  t: 'object', required: ['slug', 'title', 'rating'],
  props: {
    slug: str({ pattern: '^[a-z0-9-]+$', maxLength: 20 }),
    title: { t: 'object', required: ['en'], pruneEmpty: true, props: { en: str(), vi: str() } },
    rating: { t: 'integer', minimum: 1, maximum: 5 },
    kind: str({ enum: ['news', 'guide'] }),
    featured: { t: 'boolean' },
    publishedAt: str({ format: 'date-time' }),
    tags: { t: 'array', items: str(), maxItems: 3 },
  },
};
const table = {
  version: 1,
  entities: { Article: { id: 'id' } },
  operations: {
    getArticle: { id: 'getArticle', method: 'GET', path: '/articles/{id}', response: { t: 'entity', name: 'Article' } },
    updateArticle: { id: 'updateArticle', method: 'PUT', path: '/articles/{id}', body: true, response: { t: 'entity', name: 'Article' }, bodySchema },
    createArticle: { id: 'createArticle', method: 'POST', path: '/articles', body: true, response: { t: 'entity', name: 'Article' }, bodySchema },
  },
};
const record = { id: 5, createdAt: '2026-01-01T00:00:00Z', slug: 'hello', title: { en: 'Hello', vi: '' }, rating: 3, kind: 'news', featured: true, publishedAt: '2026-11-07T19:49:55.398Z', tags: ['a', 'b'] };

let screen;
afterEach(() => screen?.unmount());
const api = (extra = {}) => mockApi(table, { getArticle: () => record, updateArticle: ({ body }) => ({ ...record, ...body, updatedAt: 'now' }), createArticle: ({ body }) => ({ id: 99, ...body }), ...extra });
const EDIT = `<xo-view get="getArticle" p-id="5"><form xo-submit="updateArticle">
  <label>Slug <input name="slug"></label>
  <label>Title <input name="title.en"></label><label>Titel <input name="title.vi"></label>
  <label>Rating <input name="rating"></label>
  <select name="kind"></select>
  <input type="checkbox" name="featured">
  <input name="publishedAt">
  <button>Save</button>
</form></xo-view>`;
const input = async (name, value) => { const el = screen.$(`[name="${name}"]`); el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); await screen.settle(); };
const blur = async (name) => { screen.$(`[name="${name}"]`).dispatchEvent(new FocusEvent('focusout', { bubbles: true })); await screen.settle(); };

describe('prefill and attribute completion', () => {
  it('fills every control from the record of the enclosing view, nested paths and types included', async () => {
    screen = await mount(EDIT, { api: api() });
    expect(screen.$('[name=slug]').value).toBe('hello');
    expect(screen.$('[name="title.en"]').value).toBe('Hello');
    expect(screen.$('[name="title.vi"]').value).toBe('');
    expect(screen.$('[name=rating]').value).toBe('3');
    expect(screen.$('[name=kind]').value).toBe('news');
    expect(screen.$('[name=featured]').checked).toBe(true);
    expect(screen.$('[name=publishedAt]').type).toBe('datetime-local'); // completed from format: date-time
    expect(screen.$('[name=publishedAt]').value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/); // local time, minutes
  });

  it('completes type, required, bounds and pattern from the schema, and leaves what the author wrote alone', async () => {
    screen = await mount(EDIT.replace('<input name="rating">', '<input name="rating" type="range" min="2">'), { api: api() });
    const slug = screen.$('[name=slug]');
    expect([slug.type, slug.required, slug.maxLength, slug.getAttribute('pattern')]).toEqual(['text', true, 20, '^[a-z0-9-]+$']);
    expect(screen.$('[name="title.en"]').required).toBe(true);
    expect(screen.$('[name="title.vi"]').required).toBe(false);
    const rating = screen.$('[name=rating]');
    expect([rating.type, rating.getAttribute('min'), rating.getAttribute('max')]).toEqual(['range', '2', '5']); // type and min were the author's
    expect(screen.$('[name=featured]').required).toBe(false);
    expect([...screen.$('[name=kind]').options].map((o) => o.value)).toEqual(['', 'news', 'guide']);
    expect(screen.$('form').hasAttribute('novalidate')).toBe(true);
  });

  it('a create form (no path parameter) starts empty, an edit form inside a list row would start from that row', async () => {
    screen = await mount('<xo-view><form xo-submit="createArticle"><input name="slug"><input name="rating"><button>Add</button></form></xo-view>', { api: api() });
    expect(screen.$('[name=slug]').value).toBe('');
    expect(screen.$('form').model.dirty).toBe(false);
  });
});

describe('typing, dirty and the model', () => {
  it('typing writes typed values into the model; dirty follows; undoing is pristine again', async () => {
    screen = await mount(EDIT, { api: api() });
    const model = screen.$('form').model;
    await input('rating', '4');
    expect(model.get('rating')).toBe(4);
    expect(model.dirty).toBe(true);
    await input('rating', '3');
    expect(model.dirty).toBe(false);
    screen.$('[name=featured]').checked = false;
    screen.$('[name=featured]').dispatchEvent(new Event('change', { bubbles: true }));
    expect(model.get('featured')).toBe(false);
    expect(model.dirty).toBe(true);
  });

  it('what the person types is not rewritten under their cursor, even when the model would format it differently', async () => {
    screen = await mount(EDIT, { api: api() });
    await input('rating', '4.0');
    expect(screen.$('[name=rating]').value).toBe('4.0'); // the model holds 4; the control keeps the typed text
    expect(screen.$('form').model.get('rating')).toBe(4);
  });

  it('$form in markup is reactive: dirty, valid, and per-path errors', async () => {
    screen = await mount(`<xo-view get="getArticle" p-id="5"><form xo-submit="updateArticle"><input name="slug"><input name="title.en">
      <p class="dirty" xo-if="$form.dirty">unsaved</p><p class="err">{$form.errors['title.en']}</p><b class="valid">{$form.valid}</b></form></xo-view>`, { api: api() });
    expect(screen.$('.dirty')).toBeNull();
    await input('slug', 'new-slug');
    expect(screen.text('.dirty')).toBe('unsaved');
    await input('title.en', '');
    expect(screen.text('.err')).toBe('Please fill in this field.'); // readable although the field was never blurred
    expect(screen.text('.valid')).toBe('false');
    await input('title.en', 'Back');
    expect(screen.text('.err')).toBe('');
    expect(screen.text('.valid')).toBe('true');
  });

  it('custom rules set on the form element take part', async () => {
    screen = await mount(EDIT, { api: api() });
    const form = screen.$('form');
    form.rules = { slug: (v) => (v === 'taken' ? 'Already used' : '') };
    await input('slug', 'taken');
    await blur('slug');
    expect(screen.text('[data-xo-error]')).toBe('Already used');
  });
});

describe('errors in the DOM', () => {
  it('stay quiet until the field is left, then show with aria-invalid and aria-describedby; they clear when fixed', async () => {
    screen = await mount(EDIT, { api: api() });
    await input('slug', 'Bad Slug');
    expect(screen.$('[data-xo-error]')).toBeNull();
    await blur('slug');
    const slug = screen.$('[name=slug]');
    expect(screen.text('[data-xo-error]')).toBe('This does not match the expected format.');
    expect(slug.getAttribute('aria-invalid')).toBe('true');
    expect(slug.getAttribute('aria-describedby')).toBe(screen.$('[data-xo-error]').id);
    await input('slug', 'good-slug');
    expect(screen.$('[data-xo-error]')).toBeNull();
    expect(slug.hasAttribute('aria-invalid')).toBe(false);
    expect(slug.hasAttribute('aria-describedby')).toBe(false);
  });
});

describe('submit', () => {
  it('an invalid form sends nothing, shows every error, focuses the first invalid control and emits xo-invalid', async () => {
    const a = api();
    screen = await mount(EDIT, { api: a });
    await input('rating', '9');
    await input('slug', 'Bad Slug');
    const invalid = [];
    screen.container.addEventListener('xo-invalid', (e) => invalid.push(Object.keys(e.detail.errors)));
    await screen.submit('form');
    expect(a.callsOf('updateArticle')).toHaveLength(0);
    expect(screen.texts('[data-xo-error]')).toEqual(['This does not match the expected format.', 'Must be at most 5.']);
    expect(document.activeElement).toBe(screen.$('[name=slug]')); // DOM order, not schema order
    expect(invalid).toEqual([['slug', 'rating']]);
  });

  it('a valid form sends the normalised, typed body (no ids, no timestamps, no empty strings) and becomes pristine', async () => {
    const a = api();
    screen = await mount(EDIT, { api: a });
    await input('rating', '4');
    await screen.submit('form');
    const [call] = a.callsOf('updateArticle');
    expect(call.params).toEqual({ id: '5' });
    expect(call.body).toEqual({ slug: 'hello', title: { en: 'Hello' }, rating: 4, kind: 'news', featured: true, publishedAt: '2026-11-07T19:49:55.398Z', tags: ['a', 'b'] });
    expect(screen.$('form').model.dirty).toBe(false);
    expect(screen.$('form').model.baseline.updatedAt).toBe('now'); // the saved record is the new baseline
    expect(screen.errors).toEqual([]);
  });

  it('server errors land on their paths (nested too) and are cleared when the field is edited', async () => {
    const a = api({ updateArticle: () => respond(422, { errors: [{ pointer: '#/title/en', detail: 'Title is taken' }] }) });
    screen = await mount(EDIT, { api: a });
    await screen.submit('form');
    expect(screen.text('[data-xo-error]')).toBe('Title is taken');
    expect(screen.$('[name="title.en"]').getAttribute('aria-invalid')).toBe('true');
    expect(screen.$('[name="title.en"]').value).toBe('Hello'); // the draft is kept
    expect(screen.$('form').model.dirty).toBe(false);
    await input('title.en', 'Another');
    expect(screen.$('[data-xo-error]')).toBeNull();
  });

  it('a create form is emptied after success; xo-keep keeps the values', async () => {
    screen = await mount('<xo-view><form xo-submit="createArticle"><input name="slug"><input name="title.en"><input name="rating"><button>Add</button></form></xo-view>', { api: api() });
    await input('slug', 'a-b');
    await input('title.en', 'T');
    await input('rating', '2');
    await screen.submit('form');
    expect(screen.$('[name=slug]').value).toBe('');
    expect(screen.$('form').model.dirty).toBe(false);
    screen.unmount();
    screen = await mount('<xo-view><form xo-submit="createArticle" xo-keep><input name="slug"><input name="title.en"><input name="rating"><button>Add</button></form></xo-view>', { api: api() });
    await input('slug', 'a-b');
    await input('title.en', 'T');
    await input('rating', '2');
    await screen.submit('form');
    expect(screen.$('[name=slug]').value).toBe('a-b');
    expect(screen.$('form').model.dirty).toBe(false);
  });

  it('xo-reveal: the app can reveal a hidden field before it is focused; hidden controls never block the submit', async () => {
    const a = api();
    screen = await mount(`<xo-view get="getArticle" p-id="5"><form xo-submit="updateArticle"><input name="slug"><input name="title.en"><div id="tab" hidden><input name="title.vi" required></div><button>Save</button></form></xo-view>`, { api: a });
    const seen = [];
    screen.$('form').addEventListener('xo-reveal', (e) => { seen.push(e.detail.path); e.preventDefault(); screen.$('#tab').hidden = false; });
    screen.$('form').model.rules = { 'title.vi': (v) => (v ? '' : 'Missing translation') };
    await screen.submit('form');
    expect(a.callsOf('updateArticle')).toHaveLength(0); // the hidden required control was validated by the model, not the browser
    expect(seen).toEqual(['title.vi']);
    await new Promise((r) => setTimeout(r, 60));
    expect(document.activeElement).toBe(screen.$('[name="title.vi"]'));
    expect(screen.text('[data-xo-error]')).toBe('Missing translation');
  });
});

describe('records that change underneath', () => {
  it('a live update refreshes a pristine form; a dirty form keeps the draft and turns stale', async () => {
    screen = await mount(`<xo-view live get="getArticle" p-id="5"><form xo-submit="updateArticle"><input name="slug"><input name="title.en"><i class="stale" xo-if="$form.stale">changed elsewhere</i></form></xo-view>`, { api: api() });
    await screen.push({ type: 'patch', entity: 'Article', id: 5, path: '/slug', value: 'live-slug', version: 1 });
    expect(screen.$('[name=slug]').value).toBe('live-slug');
    expect(screen.$('.stale')).toBeNull();
    await input('title.en', 'My edit');
    await screen.push({ type: 'patch', entity: 'Article', id: 5, path: '/slug', value: 'live-slug-2', version: 2 });
    expect(screen.$('[name=slug]').value).toBe('live-slug'); // the draft is kept
    expect(screen.$('[name="title.en"]').value).toBe('My edit');
    expect(screen.text('.stale')).toBe('changed elsewhere');
  });
});

describe('date-time', () => {
  it('a datetime-local control shows local time, and an untouched value keeps its exact original string; an edit sends UTC ISO', async () => {
    const a = api();
    screen = await mount(EDIT.replace('<input name="publishedAt">', '<input name="publishedAt" type="datetime-local">'), { api: a });
    const shown = screen.$('[name=publishedAt]').value;
    expect(shown).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    await screen.submit('form');
    expect(a.callsOf('updateArticle')[0].body.publishedAt).toBe('2026-11-07T19:49:55.398Z'); // never touched: not rewritten
    await input('publishedAt', '2027-03-04T10:15');
    await screen.submit('form');
    expect(a.callsOf('updateArticle')[1].body.publishedAt).toBe(new Date('2027-03-04T10:15').toISOString());
  });
});
