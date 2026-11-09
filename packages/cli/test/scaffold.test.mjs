import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scaffold, pickListScreen, listScreenHtml } from '../src/scaffold.js';
import { analyze } from '../src/openapi.js';
import { checkHtml } from '../src/check.js';
import { sync } from '../src/commands.js';

const fixture = new URL('./fixture.json', import.meta.url).pathname;
const chat = new URL('../../../examples/chat/openapi.json', import.meta.url).pathname;

describe('xoong new', () => {
  it('creates a project whose first screen passes `xoong check` against its own generated table', async () => {
    const dir = join(await mkdtemp(join(tmpdir(), 'xoong-new-')), 'my-app');
    const result = await scaffold(dir, { spec: fixture });
    expect(result.screen).toBe('GET /users');
    for (const f of ['package.json', 'index.html', 'src/main.ts', 'src/app.css', 'xoong.config.json', 'xoong.hints.json', 'openapi.json', '.xoong/operations.json', '.xoong/api.d.ts', 'test/index.spec.mjs']) await access(join(dir, f));
    const html = await readFile(join(dir, 'index.html'), 'utf8');
    expect(html).toContain('<xo-view get="GET /users">');
    expect(html).toContain('<tr xo-each=".">');
    expect(html).toMatch(/<td>\{id\}<\/td><td>\{name\}<\/td><td>\{role\}<\/td>/);
    const table = JSON.parse(await readFile(join(dir, '.xoong/operations.json'), 'utf8'));
    expect(checkHtml(html, table, 'index.html')).toEqual([]);
    expect(JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')).name).toBe('my-app');
  });

  it('writes everything `xoong sync` writes, the editor data included (the same files, byte for byte)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xoong-new-sync-'));
    const dir = join(root, 'app');
    const result = await scaffold(dir, { spec: fixture });
    expect(result.files).toContain('.xoong/xoong.html-data.json');
    const synced = join(root, 'synced');
    await sync(fixture, { out: synced });
    for (const f of ['operations.json', 'xoong.html-data.json', 'api.d.ts']) expect(await readFile(join(dir, '.xoong', f), 'utf8'), f).toBe(await readFile(join(synced, f), 'utf8'));
  });

  it('refuses to overwrite an existing project', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'xoong-new-'));
    await writeFile(join(dir, 'package.json'), '{}');
    await expect(scaffold(dir, { spec: fixture })).rejects.toThrow(/already contains a project/);
  });

  it('chooses a list inside an envelope object and tolerates APIs with no list at all', () => {
    const envelope = { type: 'object', properties: { total: { type: 'integer' }, items: { type: 'array', items: { $ref: '#/components/schemas/Order' } } } };
    const order = { type: 'object', properties: { id: { type: 'string' }, total: { type: 'number' }, lines: { type: 'array', items: { type: 'string' } } } };
    const wrapped = analyze({
      openapi: '3.0.0',
      paths: { '/orders': { get: { operationId: 'orders', responses: { 200: { content: { 'application/json': { schema: envelope } } } } } } },
      components: { schemas: { Order: order } },
    });
    const pick = pickListScreen(wrapped);
    expect(pick).toMatchObject({ listPath: 'items', columns: ['id', 'total'] });
    expect(listScreenHtml(pick, 'Orders')).toContain('<tr xo-each="items">');
    expect(pickListScreen(analyze({ openapi: '3.0.0', paths: { '/x/{id}': { get: { responses: { 200: { description: 'ok' } } } } } }))).toBeNull();
  });

  it('works for the chat sample (no list screen is invented where there is none)', async () => {
    const dir = join(await mkdtemp(join(tmpdir(), 'xoong-new-')), 'chat-app');
    const result = await scaffold(dir, { spec: chat });
    expect(result.screen).toBeNull();
    expect(await readFile(join(dir, 'index.html'), 'utf8')).toContain('No list operation found');
  });

  it('escapes titles and column names in the generated HTML', () => {
    const html = listScreenHtml({ operation: { method: 'GET', path: '/x' }, listPath: '.', columns: ['a<b'] }, 'Tom & "Jerry" <b>');
    expect(html).toContain('Tom &amp; &quot;Jerry&quot; &lt;b>');
    expect(html).toContain('<th>a&lt;b</th>');
  });
});

it('--link points the project (and the packages\' own cross references) at a xoong checkout', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'xoong-link-'));
  await scaffold(join(dir, 'app'), { spec: fixture, link: '/opt/xoong' });
  const pkg = JSON.parse(await readFile(join(dir, 'app/package.json'), 'utf8'));
  expect(pkg.dependencies['@xoong/data']).toBe('file:/opt/xoong/packages/data');
  expect(pkg.devDependencies['@xoong/cli']).toBe('file:/opt/xoong/packages/cli');
  expect(pkg.overrides['@xoong/core']).toBe('file:/opt/xoong/packages/core');
  expect(Object.keys(pkg.overrides).sort()).toEqual(['@xoong/cli', '@xoong/core', '@xoong/data', '@xoong/forms', '@xoong/server', '@xoong/test', '@xoong/ui']);
  const plain = await scaffold(join(dir, 'plain'), { spec: fixture });
  expect(JSON.parse(await readFile(join(plain.dir, 'package.json'), 'utf8')).overrides).toBeUndefined();
});
