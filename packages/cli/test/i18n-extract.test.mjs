import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { extractMessages, extractFrom, toCatalog, checkCatalog } from '../src/i18n-extract.js';
import { builtin } from '../../i18n/src/builtin.js';
import vi from '../../i18n/src/catalogs/vi.json';

const run = promisify(execFile);

describe('xoong i18n extract', () => {
  it('finds xo-t text and attribute entries, with the written text as default and the line', () => {
    const html = '<h1 xo-t="home.title">Welcome &amp; hello</h1>\n<input xo-t="placeholder:search.ph; aria-label:search.label" placeholder="Search" aria-label=\'Find things\'>\n<p xo-t="list.summary">Showing {$from}–{$to}\n   of {total}</p>';
    expect(extractMessages(html, 'a.html')).toEqual([
      { key: 'home.title', default: 'Welcome & hello', file: 'a.html', line: 1 },
      { key: 'search.ph', default: 'Search', file: 'a.html', line: 2 },
      { key: 'search.label', default: 'Find things', file: 'a.html', line: 2 },
      { key: 'list.summary', default: 'Showing {$from}–{$to} of {total}', file: 'a.html', line: 3 },
    ]);
  });

  it('also reads markup written inside JavaScript template strings, and text() calls', () => {
    const js = "const html = `<button xo-t=\"x.next\" type=\"button\" xo-if=\"${a}\">Next</button>`;\nconst m = text('x.msg', 'Use at least {min} characters.', { min });\nconst q = text(\"x.q\", \"It's \\\"quoted\\\"\");";
    const found = extractMessages(js, 'a.js');
    expect(found.map((f) => [f.key, f.default])).toEqual([['x.next', 'Next'], ['x.msg', 'Use at least {min} characters.'], ['x.q', 'It\'s "quoted"']]);
  });

  it('toCatalog sorts keys and reports a key with different defaults and a default that is not a valid message', () => {
    const { catalog, problems } = toCatalog([
      { key: 'b', default: 'B', file: 'f', line: 1 }, { key: 'a', default: 'A', file: 'f', line: 2 },
      { key: 'a', default: 'Other A', file: 'g', line: 3 }, { key: 'c', default: '{n, plural, one {x}}', file: 'h', line: 4 },
    ]);
    expect(Object.keys(catalog)).toEqual(['a', 'b', 'c']);
    expect(problems.some((p) => /"a" has another default text/.test(p))).toBe(true);
    expect(problems.some((p) => /text of "c" is not a valid message/.test(p))).toBe(true);
  });

  it('the English catalog shipped in @xoong/i18n is exactly what the source defaults say (regenerate it when you add a string)', async () => {
    const { catalog, problems } = toCatalog(await extractFrom(['packages/core/src', 'packages/forms/src', 'packages/ui/src']));
    expect(problems).toEqual([]);
    expect(catalog).toEqual(builtin);
  });

  it('checkCatalog: missing keys, extra keys, wrong placeholders and unreadable messages are reported; the Vietnamese catalog is clean', () => {
    const source = { a: 'Hello {name}', b: '{n, plural, one {# x} other {# y}}', c: 'Plain' };
    expect(checkCatalog(source, { a: 'Xin chào {name}', b: '{n} cái', c: 'Thường' }, 't')).toEqual([]);
    const problems = checkCatalog(source, { a: 'Xin chào {nom}', c: '{broken', extra: 'x' }, 't');
    expect(problems).toEqual(expect.arrayContaining(['t: "a" uses {nom} but the source uses {name}', 't: missing "b"', 't: "extra" is not used by the source']));
    expect(problems.some((p) => /"c" is not a valid message/.test(p))).toBe(true);
    expect(checkCatalog(builtin, vi, 'vi')).toEqual([]);
  });

  it('the CLI writes a catalog template and checks a translation (exit code 1 on problems)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'xoong-i18n-'));
    await writeFile(join(dir, 'a.html'), '<h1 xo-t="home.title">Welcome</h1><p xo-t="home.count">{n} items</p>');
    const cli = new URL('../src/cli.js', import.meta.url).pathname;
    await run(process.execPath, [cli, 'i18n', 'extract', dir, '--out', join(dir, 'en.json')]);
    const en = JSON.parse(await (await import('node:fs/promises')).readFile(join(dir, 'en.json'), 'utf8'));
    expect(en).toEqual({ 'home.count': '{n} items', 'home.title': 'Welcome' });
    await writeFile(join(dir, 'vi.json'), JSON.stringify({ 'home.title': 'Chào', 'home.count': '{m} mục' }));
    await expect(run(process.execPath, [cli, 'i18n', 'check', join(dir, 'vi.json'), '--source', join(dir, 'en.json')])).rejects.toMatchObject({ code: 1 });
    await writeFile(join(dir, 'vi.json'), JSON.stringify({ 'home.title': 'Chào', 'home.count': '{n} mục' }));
    const { stdout } = await run(process.execPath, [cli, 'i18n', 'check', join(dir, 'vi.json'), '--source', join(dir, 'en.json')]);
    expect(stdout.trim()).toBe('ok');
  });
});
