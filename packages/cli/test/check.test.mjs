import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { checkHtml, checkFiles, formatFindings } from '../src/check.js';

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
