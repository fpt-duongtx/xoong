// Findings from the first consumer's probes of v0.0.4.
import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { checkHtml } from '../src/check.js';
import { analyze } from '../src/index.js';
import { build } from '../src/build.js';

const run = promisify(execFile);
const cli = new URL('../src/cli.js', import.meta.url).pathname;

describe('xoong check: filters with labels', () => {
  const t = { operations: { listArticles: { id: 'listArticles', method: 'GET', path: '/articles', query: ['q', 'status'] } } };
  const codes = (html) => checkHtml(html, t).map((f) => f.code);
  it('"q:Search" is the parameter q with a label; a label never hides a missing parameter', () => {
    expect(codes('<xo-view get="/articles"><xo-table columns="a" filters="q:Search,status"></xo-table></xo-view>')).toEqual([]);
    const f = checkHtml('<xo-view get="/articles"><xo-table columns="a" filters="zz:Search"></xo-table></xo-view>', t);
    expect(f.map((x) => x.code)).toEqual(['XO253']);
    expect(f[0].message).toContain('"zz"');
    expect(f[0].message).not.toContain('Search');
  });
});

describe('xoong build: arguments and the output folder', () => {
  it('--help prints the help and builds nothing; unknown options are refused', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'xoong-help-'));
    await writeFile(join(dir, 'index.html'), '<!doctype html><title>x</title>');
    const { stdout } = await run(process.execPath, [cli, 'build', '--help'], { cwd: dir });
    expect(stdout).toMatch(/build \[--root/);
    expect(await readdir(dir)).toEqual(['index.html']); // no dist folder appeared
    await expect(run(process.execPath, [cli, 'build', '--hlep'], { cwd: dir })).rejects.toMatchObject({ code: 1, stderr: expect.stringMatching(/unknown option --hlep/) });
    expect(await readdir(dir)).toEqual(['index.html']);
  });

  it('an output folder inside the root is never copied into itself: building twice gives the same files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xoong-nested-'));
    await mkdir(join(root, 'public'));
    await writeFile(join(root, 'index.html'), '<!doctype html><link rel="stylesheet" href="/a.css">');
    await writeFile(join(root, 'a.css'), 'body{}');
    await writeFile(join(root, 'public', 'x.txt'), 'x');
    const first = await build({ root, out: join(root, 'dist'), include: ['public', '.'] });
    const second = await build({ root, out: join(root, 'dist'), include: ['public', '.'] });
    expect(second.files.map((f) => f.path)).toEqual(first.files.map((f) => f.path));
    expect(second.files.some((f) => f.path.includes('dist/'))).toBe(false);
    expect((await readdir(join(root, 'dist'))).sort()).toEqual(['a.css', 'build-report.json', 'index.html', 'public']);
  });
});

describe('extension keys and pass-through in bodySchema', () => {
  const doc = { openapi: '3.0.3', info: { title: 't', version: '1' }, paths: { '/x': { post: { operationId: 'create',
    requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Input' } } } }, responses: { default: { description: 'e' } } } } },
  components: { schemas: { Input: { type: 'object', properties: {
    title: { type: 'object', nullable: true, 'x-xoong-prune-empty': true, 'x-xoong-empty-as': 'null', 'x-rainlet-localized': { locales: ['en', 'vi'] }, properties: { en: { type: 'string', maxLength: 80 }, vi: { type: 'string', maxLength: 80 } } },
    note: { type: 'string', 'x-rainlet-recommended': '1200x630' },
  } } } } };

  it('x-xoong-prune-empty and x-xoong-empty-as work on any node, inline objects included; other x-* keys reach widgets in schema.hints', () => {
    const s = analyze(doc).operations.create.bodySchema;
    expect(s.props.title.pruneEmpty).toBe(true);
    expect(s.props.title.emptyAs).toBe('null');
    expect(s.props.title.hints).toEqual({ 'x-rainlet-localized': { locales: ['en', 'vi'] } });
    expect(s.props.note.hints).toEqual({ 'x-rainlet-recommended': '1200x630' });
    expect(s.props.title.props.en.maxLength).toBe(80);
  });

  it('pruneEmpty and emptyAs are accepted in fields hints too, next to schema-level hints', () => {
    const s = analyze({ ...doc, components: { schemas: { Input: { type: 'object', properties: { t: { type: 'object', properties: { en: { type: 'string' } } } } } } } },
      { hints: { fields: { 'Input.t': { pruneEmpty: true, emptyAs: 'null' } } } }).operations.create.bodySchema;
    expect(s.props.t).toMatchObject({ pruneEmpty: true, emptyAs: 'null' });
  });
});
