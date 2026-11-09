// XO113: what the OpenAPI document asks for that changes what a call needs or does, and xoong does not apply (a required header, a cookie, a query
// style, HEAD/OPTIONS operations, servers). `xoong sync` and `xoong doctor` say so, one line per kind; operations.json does not change.
import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { analyze, doctor, runtimeTable } from '../src/index.js';
import { EXPLANATIONS } from '../../mcp/src/server.js';

const run = promisify(execFile);
const cli = new URL('../src/cli.js', import.meta.url).pathname;
const ok = { responses: { 200: { description: 'ok', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'integer' } } } } } }, default: { description: 'e' } } };
const make = (paths, extra = {}) => ({ openapi: '3.0.3', info: { title: 't', version: '1' }, paths, ...extra });
const xo113 = (d) => analyze(d).problems.filter((p) => p.code === 'XO113');
const line = (p) => `${p.message}. ${p.fix}`;

const everything = make({
  '/users': {
    get: { operationId: 'listUsers', parameters: [
      { name: 'X-Tenant-Id', in: 'header', required: true, schema: { type: 'string' } },
      { name: 'session', in: 'cookie', schema: { type: 'string' } },
      { name: 'filter', in: 'query', style: 'deepObject', explode: true, schema: { type: 'object', properties: { status: { type: 'string' } } } },
      { name: 'ids', in: 'query', style: 'form', explode: false, schema: { type: 'array', items: { type: 'integer' } } },
      { name: 'tags', in: 'query', style: 'pipeDelimited', schema: { type: 'array', items: { type: 'string' } } },
      { name: 'cursor', in: 'query', schema: { type: 'string' } },
    ], ...ok },
    head: { operationId: 'headUsers', responses: { 200: { description: 'count' } } },
    options: { responses: { 204: { description: 'cors' } } },
  },
  '/users/{id}': { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }, { name: 'X-Tenant-Id', in: 'header', required: true, schema: { type: 'string' } }], get: { operationId: 'getUser', ...ok } },
  '/ping': { get: { operationId: 'ping', responses: { 204: { description: 'pong' } } } }, // no error response: the one ordinary warning (XO130)
}, { servers: [{ url: 'https://api.example.com/v1' }] });

describe('XO113: constructs xoong does not apply', () => {
  it('one finding per kind, naming the operations and what to do', () => {
    const found = xo113(everything);
    expect(found.map((p) => p.where)).toEqual(['#/paths (parameters in: header)', '#/paths (parameters in: cookie)', '#/paths (head, options, trace)', '#/paths (query parameters)', '#/servers']);
    expect(found.every((p) => p.level === 'warn' && p.code === 'XO113')).toBe(true);
    const [header, cookie, methods, style, server] = found;
    expect(header.message).toBe('the required header X-Tenant-Id (listUsers, getUser) is not sent by xoong'); // the path-level parameter reaches getUser too
    expect(header.fix).toContain("configure({ headers: () => ({ 'X-Tenant-Id': value }) })");
    expect(cookie.message).toContain('the cookie session (listUsers)');
    expect(cookie.fix).toContain("credentials: 'include'");
    expect(methods.message).toBe('2 HEAD, OPTIONS or TRACE operations are not generated (headUsers, OPTIONS /users)'); // the id when there is one, the method and path when not
    expect(methods.fix).toContain('fetch()');
    expect(style.message).toBe('query parameters written in a style xoong does not apply: filter (deepObject), ids (explode: false), tags (pipeDelimited) in listUsers');
    expect(style.fix).toContain("ids: '1,2'");
    expect(server.message).toContain('https://api.example.com/v1');
    expect(server.fix).toContain("configure({ baseUrl: 'https://api.example.com/v1' })");
    for (const p of found) expect(line(p)).not.toContain('\n'); // one line each in `xoong sync`
  });

  it('operations.json is the same with or without them: nothing is dropped from, or added to, the table', () => {
    const table = runtimeTable(analyze(everything));
    expect(Object.keys(table.operations)).toEqual(['listUsers', 'getUser', 'ping']);
    expect(table.operations.listUsers.query).toEqual(['filter', 'ids', 'tags', 'cursor']);
    expect(JSON.stringify(table)).not.toMatch(/X-Tenant-Id|session|api\.example\.com|headUsers/);
  });

  it('a long list is cut: three names, then a count', () => {
    const paths = {};
    for (let i = 0; i < 7; i++) paths[`/r${i}`] = { get: { operationId: `get${i}`, parameters: [{ name: 'X-Tenant-Id', in: 'header', required: true, schema: { type: 'string' } }, { name: `X-Key-${i}`, in: 'header', required: true, schema: { type: 'string' } }], ...ok } };
    const [p] = xo113(make(paths));
    expect(p.message).toBe('the required headers X-Tenant-Id, X-Key-0, X-Key-1, +5 more (get0, get1, get2, +4 more) are not sent by xoong');
    expect(p.fix).toMatch(/^Send them on every call/);
  });

  it('says nothing about what xoong handles or what the standard rules out', () => {
    const quiet = make({
      '/a': { get: { operationId: 'a', parameters: [
        { name: 'X-Optional', in: 'header', schema: { type: 'string' } }, // optional: the call works without it
        { name: 'Accept', in: 'header', required: true, schema: { type: 'string' } }, // these three are ignored by the OpenAPI standard
        { name: 'Content-Type', in: 'header', required: true, schema: { type: 'string' } },
        { name: 'authorization', in: 'header', required: true, schema: { type: 'string' } },
        { name: 'q', in: 'query', explode: false, schema: { type: 'string' } }, // explode only matters for an array or an object
        { name: 'ids', in: 'query', style: 'form', explode: true, schema: { type: 'array', items: { type: 'integer' } } }, // the repeated form xoong sends
        { name: 'sort', in: 'query', style: 'pipeDelimited', schema: { type: 'string' } },
      ], ...ok } },
    });
    expect(xo113(quiet)).toEqual([]);
    expect(xo113(make({ '/a': { get: { operationId: 'a', ...ok } } }, { servers: [{ url: '/' }] }))).toEqual([]);
    expect(xo113(make({ '/a': { get: { operationId: 'a', ...ok } } }, { servers: [] }))).toEqual([]);
  });

  it('servers: the first one, even a path; and servers set on a path or an operation', () => {
    expect(xo113(make({ '/a': { get: { operationId: 'a', ...ok } } }, { servers: [{ url: '/api/v2' }, { url: 'https://other' }] }))[0].message).toContain('the server /api/v2,');
    const own = xo113(make({ '/a': { servers: [{ url: 'https://files' }], get: { operationId: 'a', ...ok } }, '/b': { get: { operationId: 'b', servers: [{ url: 'https://b' }], ...ok } } }, { servers: [{ url: 'https://api' }] }));
    expect(own).toHaveLength(1);
    expect(own[0].message).toContain('; a, b declare servers of their own');
    const only = xo113(make({ '/a': { get: { operationId: 'a', servers: [{ url: 'https://a' }], ...ok } } }));
    expect(only).toHaveLength(1);
    expect(only[0].message).toBe("a declare servers of their own, and xoong does not use them: requests go to the page's own origin");
  });

  it('a Swagger 2 document with a base path says the same (the converter makes it a server)', () => {
    const swagger = { swagger: '2.0', info: { title: 't', version: '1' }, host: 'api.example.com', basePath: '/v1', schemes: ['https'], paths: { '/a': { get: { operationId: 'a', responses: { 200: { description: 'ok' } } } } } };
    expect(xo113(swagger)[0].message).toContain('https://api.example.com/v1');
  });

  it('a document with duplicate operationIds still reports each construct once, for the operation that is kept', () => {
    const d = make({ '/a': { get: { operationId: 'x', parameters: [{ name: 'X-T', in: 'header', required: true, schema: { type: 'string' } }], ...ok } }, '/b': { get: { operationId: 'x', parameters: [{ name: 'X-Other', in: 'header', required: true, schema: { type: 'string' } }], ...ok } } });
    expect(xo113(d)[0].message).toBe('the required header X-T (x) is not sent by xoong');
  });

  it('every kind is a warning, never an error: the document is still usable', () => {
    const a = analyze(everything);
    expect(a.problems.filter((p) => p.level === 'error')).toEqual([]);
  });

  it('XO113 is explained by the MCP server', () => {
    expect(EXPLANATIONS.XO113).toContain('required header');
    expect(EXPLANATIONS.XO113).toContain('operations.json is not changed');
  });
});

describe('XO113 in the commands', () => {
  it('xoong sync prints one warning line per kind (stderr), exits 0, counts only the other warnings, and writes the operations.json the document would give without them', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'xoong-xo113-'));
    const spec = join(dir, 'spec.json');
    const without = join(dir, 'without.json');
    const bare = structuredClone(everything); // the same document without what xoong does not apply
    delete bare.servers;
    delete bare.paths['/users'].head;
    delete bare.paths['/users'].options;
    const plainParams = (ps) => ps.filter((p) => p.in !== 'header' && p.in !== 'cookie').map(({ style: _s, explode: _e, ...p }) => p);
    bare.paths['/users'].get.parameters = plainParams(bare.paths['/users'].get.parameters);
    bare.paths['/users/{id}'].parameters = plainParams(bare.paths['/users/{id}'].parameters);
    await writeFile(spec, JSON.stringify(everything));
    await writeFile(without, JSON.stringify(bare));

    const r = await run('node', [cli, 'sync', spec, '--out', join(dir, 'out')]); // a rejected promise (exit code 1) would fail the test
    const lines = r.stderr.trim().split('\n');
    expect(lines).toHaveLength(5);
    for (const l of lines) expect(l).toMatch(/^warning XO113: /);
    expect(lines[0]).toContain('X-Tenant-Id');
    expect(lines[4]).toContain('baseUrl');
    expect(r.stdout).toMatch(/^synced 3 operations, 0 entities\n/);
    expect(r.stdout).not.toContain('XO113');
    expect(r.stdout).toContain('1 warnings: run'); // XO130 of /ping; the five XO113 are not counted a second time

    const base = await run('node', [cli, 'sync', without, '--out', join(dir, 'out2')]);
    expect(base.stderr).toBe('');
    expect(await readFile(join(dir, 'out', 'operations.json'), 'utf8')).toBe(await readFile(join(dir, 'out2', 'operations.json'), 'utf8'));
  });

  it('a document with nothing to say prints nothing extra', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'xoong-xo113-'));
    await writeFile(join(dir, 'spec.json'), JSON.stringify(make({ '/a': { get: { operationId: 'a', ...ok } } })));
    const r = await run('node', [cli, 'sync', join(dir, 'spec.json'), '--out', join(dir, 'out')]);
    expect(r.stderr).toBe('');
    expect(r.stdout).toBe('synced 1 operations, 0 entities\n');
  });

  it('xoong doctor lists them with the other findings', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'xoong-xo113-'));
    await writeFile(join(dir, 'spec.json'), JSON.stringify(everything));
    const { text, errors } = await doctor(join(dir, 'spec.json'), { all: true });
    expect(errors).toBe(0);
    expect(text.match(/^warn XO113 /gm)).toHaveLength(5);
    expect(text).toContain('fix: Send it on every call');
  });
});
