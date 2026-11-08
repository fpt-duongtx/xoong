import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { checkHtml, checkScript, htmlTemplates, checkFiles, formatFindings } from '../src/check.js';

const table = { operations: {
  listUsers: { id: 'listUsers', method: 'GET', path: '/users' },
  getUser: { id: 'getUser', method: 'GET', path: '/users/{id}' },
  createUser: { id: 'createUser', method: 'POST', path: '/users', body: true },
  disableUser: { id: 'disableUser', method: 'POST', path: '/users/{id}/disable' },
} };
const codes = (html) => checkHtml(html, table).map((f) => f.code);
const one = (html) => checkHtml(html, table)[0];

describe('xoong check', () => {
  it('accepts a correct screen', () => {
    expect(codes(`<xo-view get="/users/{id}" p-id="1"><button xo-click="POST /users/{id}/disable">Disable</button>
      <form xo-submit="createUser"><button>Add</button></form><li xo-each="tags" xo-if="x"></li></xo-view>`)).toEqual([]);
  });

  it('reports an unknown operation with its location, the closest match and the fix', () => {
    const f = one('<p>x</p>\n<xo-view get="/users">\n  <button xo-click="POST /user/{id}/disable">Off</button>\n</xo-view>');
    expect(f).toMatchObject({ level: 'error', code: 'XO201', line: 3, column: 11 });
    expect(f.message).toContain('closest: "POST /users/{id}/disable"');
    expect(f.fix).toBe('Use "POST /users/{id}/disable"');
  });

  it('knows operations by id and by "METHOD /path"; a bare /path means GET', () => {
    expect(codes('<xo-view get="listUsers"></xo-view><xo-view get="/users"></xo-view><xo-view get="GET /users"></xo-view>')).toEqual([]);
    expect(one('<xo-view get="listUser"></xo-view>').message).toContain('closest: "listUsers"');
  });

  it('XO203: get must be a GET operation', () => {
    expect(codes('<xo-view get="createUser"></xo-view>')).toEqual(['XO203']);
  });

  it('XO210: a path parameter without a p-* attribute (camel-cased from kebab)', () => {
    expect(codes('<xo-view get="/users/{id}"></xo-view>')).toEqual(['XO210']);
    expect(codes('<xo-view get="/users/{id}" p-id="1"></xo-view>')).toEqual([]);
    const t = { operations: { a: { id: 'a', method: 'GET', path: '/o/{orgId}' } } };
    expect(checkHtml('<xo-view get="a" p-org-id="1"></xo-view>', t)).toEqual([]);
  });

  it('XO202 warns when xo-click calls a GET; XO220 requires a form for xo-submit', () => {
    expect(codes('<button xo-click="GET /users">Load</button>')).toEqual(['XO202']);
    expect(codes('<div xo-submit="createUser"></div>')).toContain('XO220');
  });

  it('XO221 empty expressions; XO230 unknown xo-* attributes and elements', () => {
    expect(codes('<ul><li xo-each=""></li></ul>')).toEqual(['XO221']);
    const typo = one('<button xo-clik="createUser">Go</button>');
    expect(typo).toMatchObject({ code: 'XO230', level: 'error' });
    expect(typo.message).toContain('closest: xo-click');
    expect(one('<xo-veiw></xo-veiw>')).toMatchObject({ code: 'XO230', level: 'warn' });
  });

  it('accessibility: XO240 unnamed button, XO241 click on a non-interactive element', () => {
    expect(codes('<button xo-click="createUser"></button>')).toEqual(['XO240']);
    expect(codes('<button xo-click="createUser" aria-label="Add"></button>')).toEqual([]);
    expect(codes('<span xo-click="createUser">add</span>')).toEqual(['XO241']);
    expect(codes('<span xo-click="createUser" role="button" tabindex="0">add</span>')).toEqual([]);
  });

  it('looks inside <template> and nested elements', () => {
    expect(codes('<template><xo-view get="nope"></xo-view></template>')).toEqual(['XO201']);
  });

  it('checks folders recursively, skipping node_modules and dot folders, and formats a report', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'xoong-check-'));
    await mkdir(join(dir, 'pages')); await mkdir(join(dir, 'node_modules')); await mkdir(join(dir, '.xoong'));
    await writeFile(join(dir, 'pages', 'a.html'), '<xo-view get="nope"></xo-view>');
    await writeFile(join(dir, 'node_modules', 'b.html'), '<xo-view get="nope"></xo-view>');
    await writeFile(join(dir, 'ok.html'), '<p>fine</p>');
    const { findings, files } = await checkFiles([dir], table);
    expect(files).toBe(2);
    expect(findings).toHaveLength(1);
    const report = formatFindings(findings, { files });
    expect(report).toMatch(/pages\/a\.html:1:\d+  error XO201/);
    expect(report).toMatch(/2 files, 1 errors, 0 warnings/);
  });

  it('CLI: exit code 1 with errors, 0 without; --format json; missing operations file explains what to do', async () => {
    const run = promisify(execFile);
    const cli = new URL('../src/cli.js', import.meta.url).pathname;
    const dir = await mkdtemp(join(tmpdir(), 'xoong-check-'));
    await writeFile(join(dir, 'ops.json'), JSON.stringify(table));
    await writeFile(join(dir, 'bad.html'), '<xo-view get="nope"></xo-view>');
    await writeFile(join(dir, 'good.html'), '<xo-view get="listUsers"></xo-view>');
    await expect(run('node', [cli, 'check', join(dir, 'bad.html'), '--operations', join(dir, 'ops.json')])).rejects.toMatchObject({ code: 1 });
    const ok = await run('node', [cli, 'check', join(dir, 'good.html'), '--operations', join(dir, 'ops.json'), '--format', 'json']);
    expect(JSON.parse(ok.stdout)).toEqual([]);
    await expect(run('node', [cli, 'check', join(dir, 'good.html')], { cwd: dir })).rejects.toMatchObject({ stderr: expect.stringContaining('xoong sync') });
  });
});

describe('review fixes', () => {
  it('XO240: an icon-only button named by an img alt or a nested aria-label is accessible', () => {
    const c = (html) => checkHtml(html, table).map((f) => f.code);
    expect(c('<button xo-click="createUser"><img src="a.svg" alt="Add"></button>')).toEqual([]);
    expect(c('<button xo-click="createUser"><svg aria-label="Add"></svg></button>')).toEqual([]);
    expect(c('<button xo-click="createUser"><img src="a.svg" alt=""></button>')).toEqual(['XO240']);
    expect(c('<button xo-click="createUser"><span></span></button>')).toEqual(['XO240']);
  });
});

describe('xoong check: admin set', () => {
  const t = { operations: {
    listUsers: { id: 'listUsers', method: 'GET', path: '/users', query: ['sort', 'limit', 'offset'] },
    listTags: { id: 'listTags', method: 'GET', path: '/tags', query: ['limit'] },
    createUser: { id: 'createUser', method: 'POST', path: '/users', body: true, bodyFields: [{ name: 'name', type: 'string' }] },
    importUsers: { id: 'importUsers', method: 'POST', path: '/users/import', body: true },
  } };
  const found = (html) => checkHtml(html, t).map((f) => f.code);

  it('accepts a table, a form, a dialog and the new attributes', () => {
    expect(found(`<xo-view get="/users"><xo-table columns="name" sortable page-size="10"><button xo-param="sort=name" xo-open="#d">x</button></xo-table></xo-view>
      <xo-dialog id="d"><xo-form op="POST /users"></xo-form><button xo-close>Cancel</button></xo-dialog>`)).toEqual([]);
  });

  it('XO250: sortable or page-size needs the query parameters on the operation', () => {
    expect(found('<xo-view get="/tags"><xo-table columns="a" sortable></xo-table></xo-view>')).toEqual(['XO250']);
    const f = checkHtml('<xo-view get="/tags"><xo-table columns="a" page-size="5"></xo-table></xo-view>', t)[0];
    expect(f.message).toContain('"offset"');
    expect(found('<xo-view get="/tags"><xo-table columns="a" page-size="5"></xo-table></xo-view>')).toEqual(['XO250']);
  });

  it('XO242: an xo-image needs alt (an empty alt is allowed)', () => {
    expect(found('<xo-image src="/a.jpg"></xo-image>')).toEqual(['XO242']);
    expect(found('<xo-image src="/a.jpg" alt=""></xo-image>')).toEqual([]);
    expect(found('<xo-image src="/a.jpg" alt="Harbour"></xo-image>')).toEqual([]);
  });

  it('XO243: an img with bound data in src loads the literal text', () => {
    expect(found('<xo-view><img src="{cover.url}" alt=""></xo-view>')).toEqual(['XO243']);
    expect(found('<xo-view><xo-image src="{cover.url}" alt=""></xo-image></xo-view>')).toEqual([]);
    expect(found('<img src="/static.png" alt="">')).toEqual([]);
  });

  it('XO222: a submit form needs an <xo-view>', () => {
    expect(found('<form xo-submit="POST /users"></form>')).toEqual(['XO222']);
    expect(found('<xo-view><form xo-submit="POST /users"></form></xo-view>')).toEqual([]);
  });

  it('XO251: a table needs an <xo-view get>', () => {
    expect(found('<xo-table columns="a"></xo-table>')).toEqual(['XO251']);
    expect(found('<xo-view><xo-table columns="a"></xo-table></xo-view>')).toEqual(['XO251']);
  });

  it('XO201 for an unknown form operation, XO252 when there are no simple fields', () => {
    expect(found('<xo-form op="POST /user"></xo-form>')).toEqual(['XO201']);
    expect(found('<xo-form op="POST /users/import"></xo-form>')).toEqual(['XO252']);
  });

  it('XO230 still catches a typo in the new names', () => {
    expect(found('<xo-tabel></xo-tabel><button xo-opn="#d">x</button>')).toEqual(['XO230', 'XO230']);
  });
});

describe('xoong check: JavaScript and TypeScript', () => {
  const src = (code) => checkScript(code, table, 'app.ts');

  it('finds html`...` templates, ignoring ${} holes, nested templates and escapes', () => {
    const code = 'const a = html`<p class=${c}>${() => html`<i>${x}</i>`}</p>`;\nconst b = html`<b>\\`</b>`; const c = 1;';
    expect(htmlTemplates(code).map((t) => t.text.replace(/ +/g, ' '))).toEqual(['<p class=x >x </p>', '<b>\\`</b>']); // holes keep their width (blanks)
    expect(htmlTemplates(code)[1]).toMatchObject({ line: 2 });
  });

  it('line and column stay right after multi-line holes and same-line holes (review findings)', () => {
    const multi = 'const a = html`<ul>${items.map((i) =>\n  html`<li>${i}</li>`\n).join("")}</ul>\n<xo-bogus></xo-bogus>`;';
    expect(src(multi).find((f) => f.code === 'XO230')).toMatchObject({ line: 4, column: 1 });
    const same = src('x = html`<p>${x}</p><xo-zz>`;').find((f) => f.code === 'XO230');
    expect(same.column).toBe('x = html`<p>${x}</p>'.length + 1);
  });

  it('understands enough JavaScript: braces in strings, comments, strings and regexes that mention html`', () => {
    expect(src("html`<b>${ '}' }</b><xo-bogus>`").map((f) => f.code)).toEqual(['XO230']);
    expect(src("// don't use html` here\nconst y = `a`;\nconst z = 1;")).toEqual([]);
    expect(src('const s = "html`<xo-bogus>`"; const r = /`/; const t = html`<p>ok</p>`;')).toEqual([]);
    expect(htmlTemplates('const t = html`<p>${html`<i>${a}</i>`}</p>`; const u = html`<b></b>`;')).toHaveLength(2);
  });

  it('only checks calls on something that looks like a xoong client, and directory scans skip build output', async () => {
    expect(src("db.query('SELECT 1'); router.load('/x'); client.load('listUser'); apiClient.mutate('GET /users'); getClient().load('nope');").map((f) => f.code)).toEqual(['XO201', 'XO204', 'XO201']);
    const dir = await mkdtemp(join(tmpdir(), 'xoong-skip-'));
    await mkdir(join(dir, 'dist'));
    await writeFile(join(dir, 'dist', 'bundle.js'), 'client.load("nope");');
    await writeFile(join(dir, 'vendor.min.js'), 'client.load("nope");');
    expect((await checkFiles([dir], table)).files).toBe(0);
  });

  it('checks HTML inside templates and maps findings to the right line and column of the file', () => {
    const f = src('import { html } from "@xoong/core";\nexport const view = () => html`\n  <xo-view get="/users">\n    <button xo-click="POST /user/{id}/disable">Off</button>\n  </xo-view>`;')[0];
    expect(f).toMatchObject({ code: 'XO201', level: 'error', file: 'app.ts', line: 4 });
    expect(f.message).toContain('closest: "POST /users/{id}/disable"');
  });

  it('checks the operation named in client.load / query / mutate / stream', () => {
    const f = src('await client.load("listUser");\nawait client.mutate("createUser", {}, body);\nawait client.load("createUser");\nawait client.mutate("GET /users");\nclient.query(`x`);');
    expect(f.map((x) => [x.code, x.line])).toEqual([['XO201', 1], ['XO204', 3], ['XO204', 4]]);
    expect(f[0].message).toContain('closest: "listUsers"');
    expect(src('client.load("/users"); client.stream("createUser");')).toEqual([]);
  });

  it('checkFiles covers .ts, .js and .html together, and skips .d.ts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'xoong-check-'));
    await writeFile(join(dir, 'a.ts'), 'client.load("nope");');
    await writeFile(join(dir, 'b.html'), '<xo-view get="/nope"></xo-view>');
    await writeFile(join(dir, 'c.d.ts'), 'client.load("nope");');
    const { findings, files } = await checkFiles([dir], table);
    expect(files).toBe(2);
    expect(findings.map((f) => f.code)).toEqual(['XO201', 'XO201']);
  });
});
