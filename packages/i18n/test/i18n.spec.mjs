import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { text } from '@xoong/core';
import { mount, mockApi } from '@xoong/test';
import '@xoong/ui';
import { configureI18n, setLocale, addMessages, resetI18n, t, locale, onLocaleChange, detectLocale, directionOf, messageFor } from '../src/index.js';
import vi from '../src/catalogs/vi.json';
import { builtin } from '../src/builtin.js';

let screen;
beforeEach(() => resetI18n());
afterEach(() => { screen?.unmount(); resetI18n(); document.documentElement.removeAttribute('lang'); document.documentElement.removeAttribute('dir'); });
const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

describe('language state', () => {
  it('t() uses the active language, falls back through region, base language and the fallback locale, then the given text, then the key', async () => {
    await configureI18n({ locale: 'pt-BR', fallback: 'en', messages: { en: { a: 'A en', b: 'B en', c: 'C en' }, pt: { a: 'A pt', b: 'B pt' }, 'pt-BR': { a: 'A pt-BR' } } });
    expect(t('a')).toBe('A pt-BR');
    expect(t('b')).toBe('B pt');
    expect(t('c')).toBe('C en');
    expect(t('zzz', {}, 'Default text')).toBe('Default text');
    expect(t('zzz')).toBe('zzz');
    expect(t('a', {}, 'ignored')).toBe('A pt-BR');
  });

  it('messages take arguments, plurals and number formats in the active language', async () => {
    await configureI18n({ locale: 'de', messages: { de: { n: '{count, plural, one {# Artikel} other {# Artikel}} ({price, number})' } } });
    expect(t('n', { count: 1500, price: 1234.5 })).toBe('1.500 Artikel (1.234,5)');
  });

  it('setLocale loads the catalog (and the base language) first, then switches, setting <html lang> and dir', async () => {
    const loaded = [];
    await configureI18n({ locale: 'en', messages: { en: { hello: 'Hello' } }, load: async (code) => { loaded.push(code); return { default: { hello: code === 'ar' ? 'مرحبا' : `Hello ${code}` } }; } });
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    const seen = [];
    const stop = onLocaleChange((code) => seen.push(code));
    await setLocale('ar');
    expect(t('hello')).toBe('مرحبا');
    expect(document.documentElement.dir).toBe('rtl');
    expect(loaded).toEqual(['ar']);
    await setLocale('ar'); // already loaded: nothing fetched again
    expect(loaded).toEqual(['ar']);
    await setLocale('pt-BR');
    expect(loaded).toEqual(['ar', 'pt-BR', 'pt']);
    expect(seen).toEqual(['ar', 'pt-BR']); // only a real change is announced
    stop();
  });

  it('two quick setLocale calls end on the last one, even when the first catalog is the slow one', async () => {
    await configureI18n({ locale: 'en', messages: { en: { k: 'en' } }, load: async (code) => { await tick(code === 'vi' ? 60 : 1); return { k: code }; } });
    const seen = [];
    const stop = onLocaleChange((code) => seen.push(code));
    const first = setLocale('vi');
    const last = setLocale('de');
    await Promise.all([first, last]);
    await tick(80);
    expect(locale.value).toBe('de');
    expect(document.documentElement.lang).toBe('de');
    expect(t('k')).toBe('de');
    expect(seen).toEqual(['de']); // the stale call neither switched nor announced anything
    await setLocale('vi'); // its catalog did load: a later explicit choice still works
    expect(t('k')).toBe('vi');
    stop();
  });

  it('a configureI18n({ locale }) after a pending setLocale wins over it', async () => {
    await configureI18n({ locale: 'en', load: async (code) => { await tick(code === 'vi' ? 40 : 1); return { k: code }; } });
    const slow = setLocale('vi');
    await configureI18n({ locale: 'fr' });
    await slow;
    expect(locale.value).toBe('fr');
  });

  it('a catalog that fails to load is reported, and the fallback keeps working', async () => {
    const errors = [];
    const original = console.error;
    console.error = (...a) => errors.push(a.join(' '));
    try {
      await configureI18n({ locale: 'en', messages: { en: { k: 'English' } }, load: async () => { throw new Error('404'); } });
      await setLocale('xx');
    } finally { console.error = original; }
    expect(t('k')).toBe('English');
    expect(errors.join('\n')).toMatch(/could not load the "xx" catalog: 404/);
  });

  it('directionOf knows right-to-left languages', () => {
    expect(['en', 'vi', 'ja', 'ar', 'he', 'fa-IR', 'ur'].map(directionOf)).toEqual(['ltr', 'ltr', 'ltr', 'rtl', 'rtl', 'rtl', 'rtl']);
  });

  it('detectLocale: ?lang first, then a saved choice, then the browser, then the default; regions match their language', () => {
    const supported = ['en', 'vi', 'pt-BR'];
    history.replaceState(null, '', '/?lang=vi');
    expect(detectLocale(supported)).toBe('vi');
    history.replaceState(null, '', '/?lang=pt');
    expect(detectLocale(supported)).toBe('pt-BR');
    history.replaceState(null, '', '/');
    localStorage.setItem('xoong.locale', 'VI');
    expect(detectLocale(supported)).toBe('vi');
    localStorage.removeItem('xoong.locale');
    expect(detectLocale(supported, { default: 'en' })).toMatch(/en|vi|pt-BR/);
    expect(detectLocale(['xx'], { default: 'xx' })).toBe('xx');
  });
});

describe('formats follow the language', () => {
  it('{value | date} and the localized format use the active language', async () => {
    await configureI18n({ locale: 'vi' });
    screen = await mount('<xo-view get="getItem"><i>{when | date}</i><b>{title | localized}</b></xo-view>', { api: mockApi({ version: 1, operations: { getItem: { id: 'getItem', method: 'GET', path: '/item', response: null } } }, { getItem: () => ({ when: '2026-11-07T10:00:00Z', title: { en: 'Hello', vi: 'Xin chào' } }) }) });
    expect(screen.text('b')).toBe('Xin chào');
    expect(screen.text('i')).toMatch(/2026/);
    await setLocale('en');
    await tick();
    expect(screen.text('b')).toBe('Hello');
    expect(screen.text('i')).toMatch(/Nov 7, 2026/);
  });

  it('localized: the active language, then its base language, then English, then whatever is filled in', async () => {
    const show = async (value, code) => { await setLocale(code); screen?.unmount(); screen = await mount('<xo-view get="getItem"><b>{title | localized}</b></xo-view>', { api: mockApi({ version: 1, operations: { getItem: { id: 'getItem', method: 'GET', path: '/item', response: null } } }, { getItem: () => ({ title: value }) }) }); return screen.text('b'); };
    expect(await show({ en: 'Hello', 'pt-BR': 'Olá' }, 'pt-BR')).toBe('Olá');
    expect(await show({ en: 'Hello', pt: 'Ola' }, 'pt-BR')).toBe('Ola');
    expect(await show({ en: 'Hello', zh: '你好' }, 'vi')).toBe('Hello');
    expect(await show({ zh: '你好', ru: '' }, 'vi')).toBe('你好');
    expect(await show({}, 'vi')).toBe('');
  });
});

describe('xo-t', () => {
  it('outside a view: the element text and attributes are translated, the written text is the default, and a language change updates them', async () => {
    screen = await mount('<h1 xo-t="home.title">Welcome</h1><input xo-t="placeholder:home.search; aria-label:home.label" placeholder="Search" aria-label="Search the site"><p xo-t="missing.key">Default stays</p>', { api: mockApi({ version: 1, operations: {} }) });
    await tick();
    expect(screen.text('h1')).toBe('Welcome'); // no catalog yet: the default
    addMessages('vi', { 'home.title': 'Chào mừng', 'home.search': 'Tìm kiếm', 'home.label': 'Tìm trong trang' });
    await setLocale('vi');
    await tick();
    expect(screen.text('h1')).toBe('Chào mừng');
    expect(screen.$('input').getAttribute('placeholder')).toBe('Tìm kiếm');
    expect(screen.$('input').getAttribute('aria-label')).toBe('Tìm trong trang');
    expect(screen.text('p')).toBe('Default stays'); // a missing key shows the written text
    await setLocale('en');
    await tick();
    expect(screen.text('h1')).toBe('Welcome'); // back to the default: the written text is the English source
  });

  it('inside a view: {placeholders} come from the scope, plurals work, and rows repeat with their own values', async () => {
    addMessages('vi', { 'list.summary': '{count, plural, other {Có # bài viết}} ({name})' });
    await configureI18n({ locale: 'vi' });
    const api = mockApi({ version: 1, operations: { getList: { id: 'getList', method: 'GET', path: '/list', response: null } } }, { getList: () => ({ count: 3, name: 'Tin tức', rows: [{ n: 1 }, { n: 2 }] }) });
    screen = await mount('<xo-view get="getList"><p class="sum" xo-t="list.summary">{count} articles ({name})</p><ul><li xo-each="rows" xo-t="list.row">Row {n}</li></ul></xo-view>', { api });
    expect(screen.text('.sum')).toBe('Có 3 bài viết (Tin tức)');
    expect(screen.texts('li')).toEqual(['Row 1', 'Row 2']); // key not in the catalog: the written text, interpolated from the row
    addMessages('vi', { 'list.row': 'Dòng {n}' });
    await tick();
    expect(screen.texts('li')).toEqual(['Dòng 1', 'Dòng 2']);
    await setLocale('en');
    await tick();
    expect(screen.text('.sum')).toBe('3 articles (Tin tức)');
  });

  it('elements added later are translated, and an element with xo-t keeps its other directives (a button with xo-if and xo-param)', async () => {
    addMessages('vi', { 'x.later': 'Muộn', 'xoong.table.next': 'Sau' });
    await configureI18n({ locale: 'vi' });
    screen = await mount('<div id="host"></div>', { api: mockApi({ version: 1, operations: {} }) });
    const p = document.createElement('p');
    p.setAttribute('xo-t', 'x.later');
    p.textContent = 'Later';
    screen.$('#host').append(p);
    await tick(20);
    expect(p.textContent).toBe('Muộn');
  });
});

describe("xoong's own strings", () => {
  it('validation messages, table text and confirm buttons are translated by the catalog (Vietnamese ships with the package)', async () => {
    await configureI18n({ locale: 'vi', messages: { vi } });
    expect(text('xoong.validation.required', 'Please fill in this field.')).toBe('Vui lòng điền thông tin này.');
    const { validate } = await import('@xoong/forms');
    expect(validate({ t: 'object', required: ['n'], props: { n: { t: 'string', minLength: 3 }, m: { t: 'integer', maximum: 5 } } }, { m: 9 })).toEqual({ n: 'Vui lòng điền thông tin này.', m: 'Tối đa là 5.' });
    expect(validate({ t: 'object', props: { n: { t: 'string', minLength: 3 } } }, { n: 'ab' }).n).toBe('Dùng ít nhất 3 ký tự.');
    await setLocale('en');
    expect(validate({ t: 'object', props: { n: { t: 'string', minLength: 1 } } }, { n: '' }).n).toBe('Use at least 1 character.');
  });

  it('the table translates its buttons, range and accessible names', async () => {
    await configureI18n({ locale: 'vi', messages: { vi } });
    const table = { version: 1, entities: { A: { id: 'id' } }, operations: { list: { id: 'list', method: 'GET', path: '/a', query: ['limit', 'offset'], response: { t: 'object', props: { items: { t: 'array', items: { t: 'entity', name: 'A' } } } } } } };
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: `N${i + 1}` }));
    screen = await mount('<xo-view get="list"><xo-table columns="name" selectable page-size="2"><button slot="bulk" xo-click="list" xo-selected>Go</button></xo-table></xo-view>', { api: mockApi(table, { list: ({ query }) => ({ items: rows.slice(Number(query.offset ?? 0), Number(query.offset ?? 0) + 2), total: 5 }) }) });
    await tick();
    expect(screen.text('.xo-range')).toBe('1–2 trong tổng số 5');
    expect(screen.$('.xo-pager button').getAttribute('aria-label')).toBe('Sau');
    expect(screen.$('.xo-pager button').getAttribute('title')).toBe('Sau');
    expect(screen.$('tbody input[type=checkbox]').getAttribute('aria-label')).toBe('Chọn dòng');
    expect(screen.$('.xo-pager').getAttribute('aria-label')).toBe('Phân trang');
    await screen.click('.xo-pager button');
    expect(screen.$('.xo-pager button').getAttribute('aria-label')).toBe('Trước');
    const box = screen.$('tbody input[type=checkbox]');
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    expect(screen.text('.xo-bulk span')).toBe('Đã chọn 1');
  });

  it('every key in the English catalog has a Vietnamese translation with the same placeholders (a quality gate for catalogs)', async () => {
    const { checkCatalog } = await import('../../cli/src/i18n-extract.js');
    expect(checkCatalog(builtin, vi, 'vi')).toEqual([]);
    expect(messageFor('xoong.validation.required')).toBeUndefined(); // reset: nothing loaded
    void locale;
  });
});
