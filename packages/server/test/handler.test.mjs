import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandler, buildImportMap, injectImportMap } from '../src/index.js';
import { nodeFiles, stripTypes, serve, createDevHandler } from '../src/node.js';

const memory = (tree) => async (path) => (path in tree ? { body: tree[path] } : null);
const get = (handler, path, init) => handler(new Request('http://x' + path, init));

describe('static files', () => {
  const handler = createHandler({ files: memory({ '/index.html': '<h1>hi</h1>', '/a/b.css': 'p{}', '/app.js': 'x', '/data.bin': new Uint8Array([1, 2]) }) });

  it('serves files with content types and no-cache', async () => {
    const res = await get(handler, '/a/b.css');
    expect([res.status, res.headers.get('content-type'), res.headers.get('cache-control')]).toEqual([200, 'text/css; charset=utf-8', 'no-cache']);
    expect((await get(handler, '/data.bin')).headers.get('content-type')).toBe('application/octet-stream');
  });
  it('serves index.html for folders and 404 for missing files', async () => {
    expect(await (await get(handler, '/')).text()).toBe('<h1>hi</h1>');
    expect((await get(handler, '/missing.js')).status).toBe(404);
  });
  it('HEAD has headers and no body; other methods are 405', async () => {
    const head = await get(handler, '/app.js', { method: 'HEAD' });
    expect([head.status, await head.text()]).toEqual([200, '']);
    expect((await get(handler, '/app.js', { method: 'DELETE' })).status).toBe(405);
  });
  it('refuses path traversal and malformed paths', async () => {
    // URL parsing resolves dot segments (also when percent-encoded) before the handler sees the path,
    // so these can never address anything outside the file tree; nodeFiles enforces the root as well.
    expect((await get(handler, '/%2e%2e/etc/passwd')).status).toBe(404);
    expect((await get(handler, '/a/../index.html')).status).toBe(200);
    expect((await get(handler, '/%E0%A4%A')).status).toBe(400);
    expect((await get(handler, '/x%00y')).status).toBe(400);
  });
  it('spa mode falls back to index.html for extension-less routes only', async () => {
    const spa = createHandler({ files: memory({ '/index.html': 'shell' }), spa: true });
    expect(await (await get(spa, '/users/42')).text()).toBe('shell');
    expect((await get(spa, '/missing.js')).status).toBe(404);
  });
});

describe('transforms and import map', () => {
  it('transforms by extension and reports failures as 500 with the file name', async () => {
    const errors = [];
    const handler = createHandler({
      files: memory({ '/a.ts': 'const x: number = 1', '/bad.ts': 'boom' }),
      transform: { '.ts': (code, path) => { if (code === 'boom') throw new Error('nope'); return code.replace(': number', ''); } },
      onError: (e) => errors.push(e),
    });
    const ok = await get(handler, '/a.ts');
    expect([await ok.text(), ok.headers.get('content-type')]).toEqual(['const x = 1', 'text/javascript; charset=utf-8']);
    const bad = await get(handler, '/bad.ts');
    expect(bad.status).toBe(500);
    expect(await bad.text()).toMatch(/could not transform \/bad\.ts[\s\S]*nope/);
    expect(errors).toHaveLength(1);
  });

  it('builds an import map from package exports', () => {
    const map = buildImportMap({ '@xoong/core': { prefix: '/@xoong/core', exports: { '.': './src/index.js', './signals': './src/signals.js' } }, '@x/single': { prefix: '/@x/single', exports: './main.js' } });
    expect(map.imports).toEqual({ '@xoong/core': '/@xoong/core/src/index.js', '@xoong/core/signals': '/@xoong/core/src/signals.js', '@x/single': '/@x/single/main.js' });
  });

  it('injects the map before the first script, into head, or at the top, but never twice', () => {
    const map = { imports: { a: '/a.js' } };
    expect(injectImportMap('<head></head><script src=x></script>', map)).toMatch(/^<head><\/head><script type="importmap">.*<\/script>\n<script src=x>/);
    expect(injectImportMap('<head></head><body></body>', map)).toMatch(/<script type="importmap">.*<\/script>\n<\/head>/);
    expect(injectImportMap('<p>hi</p>', map).startsWith('<script type="importmap">')).toBe(true);
    const once = injectImportMap('<script type="importmap">{}</script>', map);
    expect(once).toBe('<script type="importmap">{}</script>');
    expect(injectImportMap('<p></p>', { imports: { x: '</script><b>' } })).not.toContain('</script><b>');
  });

  it('serves package files under their prefix and adds the map to HTML pages', async () => {
    const handler = createHandler({
      files: memory({ '/index.html': '<script type="module" src="/app.js"></script>', '/@xoong/core/src/index.js': 'export const a = 1', '/app.js': '' }),
      packages: { '@xoong/core': { prefix: '/@xoong/core', exports: { '.': './src/index.js' } } },
    });
    expect(await (await get(handler, '/')).text()).toContain('"@xoong/core":"/@xoong/core/src/index.js"');
    expect(await (await get(handler, '/@xoong/core/src/index.js')).text()).toBe('export const a = 1');
    expect((await get(handler, '/@xoong/core/src/nope.js')).status).toBe(404);
  });
});

describe('proxy', () => {
  let upstream;
  const seen = [];
  afterEach(() => upstream?.close());
  const start = async (impl) => {
    upstream = http.createServer(impl);
    await new Promise((r) => upstream.listen(0, '127.0.0.1', r));
    return `http://127.0.0.1:${upstream.address().port}`;
  };

  it('forwards method, path, query, headers and body; strips hop-by-hop headers; passes status through', async () => {
    const origin = await start(async (req, res) => {
      let body = ''; for await (const c of req) body += c;
      seen.push({ method: req.method, url: req.url, auth: req.headers.authorization, fwd: req.headers['x-forwarded-host'], body });
      res.writeHead(201, { 'content-type': 'application/json', connection: 'close', 'x-custom': 'yes' });
      res.end('{"ok":true}');
    });
    const handler = createHandler({ proxy: { '/api': origin + '/base' } });
    const res = await get(handler, '/api/users/1?x=1&y=2', { method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: '{"a":1}' });
    expect([res.status, await res.json(), res.headers.get('x-custom')]).toEqual([201, { ok: true }, 'yes']);
    expect(seen.at(-1)).toEqual({ method: 'POST', url: '/base/users/1?x=1&y=2', auth: 'Bearer t', fwd: 'x', body: '{"a":1}' });
  });

  it('only matches whole path segments and prefers the longest prefix', async () => {
    const a = await start((req, res) => res.end('A:' + req.url));
    const first = upstream; 
    const handler = createHandler({ proxy: { '/api': a, '/api/v2': a + '/two' }, files: memory({ '/apix': 'static' }) });
    expect(await (await get(handler, '/api/v2/z')).text()).toBe('A:/two/z');
    expect(await (await get(handler, '/api/q')).text()).toBe('A:/q');
    expect(await (await get(handler, '/apix')).text()).toBe('static');
    first.close();
  });

  it('does not follow redirects and answers 502 with the reason when the upstream is down', async () => {
    const origin = await start((req, res) => { res.writeHead(302, { location: '/elsewhere' }); res.end(); });
    const handler = createHandler({ proxy: { '/api': origin } });
    const redirect = await get(handler, '/api/x');
    expect([redirect.status, redirect.headers.get('location')]).toEqual([302, '/elsewhere']);
    upstream.close(); upstream = null;
    const errors = [];
    const dead = createHandler({ proxy: { '/api': origin }, onError: (e) => errors.push(e) });
    const res = await get(dead, '/api/x');
    expect(res.status).toBe(502);
    expect(await res.text()).toMatch(/could not reach http:\/\/127\.0\.0\.1/);
    expect(errors).toHaveLength(1);
  });

  it('streams server-sent events without buffering', async () => {
    const origin = await start((req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('data: 1\n\n');
      setTimeout(() => { res.write('data: 2\n\n'); res.end(); }, 60);
    });
    const handler = createHandler({ proxy: { '/events': origin } });
    const res = await get(handler, '/events');
    const reader = res.body.getReader();
    const t0 = Date.now();
    const first = new TextDecoder().decode((await reader.read()).value);
    expect(first).toBe('data: 1\n\n');
    expect(Date.now() - t0).toBeLessThan(50); // arrived before the upstream finished
    await reader.cancel();
  });

  it('rejects bad proxy configuration at start-up', () => {
    expect(() => createHandler({ proxy: { api: 'http://x' } })).toThrow(/must start with "\/"/);
    expect(() => createHandler({ proxy: { '/api': 'not a url' } })).toThrow(/not a valid URL/);
  });
});

describe('node adapters', () => {
  it('nodeFiles stays inside its root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xoong-srv-'));
    await mkdir(join(root, 'sub'));
    await writeFile(join(root, 'sub', 'a.txt'), 'A');
    await writeFile(join(root, '..secret'), 'S').catch(() => {});
    const read = nodeFiles(join(root, 'sub'));
    expect((await read('/a.txt')).body.toString()).toBe('A');
    expect(await read('/../..secret')).toBeNull();
    expect(await read('/../../etc/passwd')).toBeNull();
    expect(await read('/')).toBeNull(); // a directory is not a file
    expect(await read('/missing')).toBeNull();
  });

  it('stripTypes removes types, keeps positions, and explains non-erasable syntax', async () => {
    const out = await stripTypes('export const x: number = 1;\ninterface I { a: string }\nexport const y = x as number;', '/a.ts');
    expect(out.split('\n')).toHaveLength(3);
    expect(out).toMatch(/export const x\s+= 1;/);
    await expect(stripTypes('enum E { A }', '/e.ts')).rejects.toThrow(/\/e\.ts[\s\S]*erasable/);
  });

  it('a dev handler serves the project, strips .ts, and exposes @xoong packages through an import map', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xoong-dev-'));
    await writeFile(join(root, 'index.html'), '<script type="module" src="/main.ts"></script>');
    await writeFile(join(root, 'main.ts'), 'import { signal } from "@xoong/core/signals";\nexport const n: number = signal(1).value;');
    const repo = new URL('../../..', import.meta.url).pathname;
    const dev = await createDevHandler({ root, resolveFrom: repo });

    const page = await (await get(dev, '/')).text();
    expect(page).toContain('"@xoong/core":"/@xoong/core/src/index.js"');
    expect(page).toContain('"@xoong/core/signals":"/@xoong/core/src/signals.js"');
    expect(page).toContain('"@xoong/data/view":"/@xoong/data/src/view.js"');
    expect(page.indexOf('importmap')).toBeLessThan(page.indexOf('main.ts')); // the map precedes the first module script

    const ts = await get(dev, '/main.ts');
    expect(ts.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(await ts.text()).not.toMatch(/: number/);
    expect((await get(dev, '/@xoong/core/src/signals.js')).status).toBe(200);
    expect((await get(dev, '/@xoong/core/package.json')).status).toBe(200);
    expect((await get(dev, '/@xoong/core/../../etc/passwd')).status).toBe(404);
  });

  it('without installed packages the page is served unchanged (no import map)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xoong-dev-'));
    await writeFile(join(root, 'index.html'), '<p>plain</p>');
    const dev = await createDevHandler({ root, resolveFrom: root });
    expect(await (await get(dev, '/')).text()).toBe('<p>plain</p>');
  });

  it('serve() adapts to node:http, including request bodies and closing SSE connections', async () => {
    let closed = false;
    const handler = async (request) => {
      if (new URL(request.url).pathname === '/echo') return new Response(await request.text(), { status: 201, headers: { 'x-a': '1' } });
      const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: hi\n\n')); }, cancel() { closed = true; } });
      return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
    };
    const s = await serve(handler, { port: 0 });
    const echo = await fetch(s.url + '/echo', { method: 'POST', body: 'payload' });
    expect([echo.status, echo.headers.get('x-a'), await echo.text()]).toEqual([201, '1', 'payload']);
    const controller = new AbortController();
    const sse = await fetch(s.url + '/events', { signal: controller.signal });
    await sse.body.getReader().read();
    controller.abort();
    await new Promise((r) => setTimeout(r, 80));
    expect(closed).toBe(true);
    await s.close();
  });
});

describe('review fixes', () => {
  it('several Set-Cookie headers survive the proxy and the Node adapter', async () => {
    const upstream = http.createServer((req, res) => { res.setHeader('set-cookie', ['sid=1; HttpOnly', 'csrf=2; Path=/']); res.end('ok'); });
    await new Promise((r) => upstream.listen(0, '127.0.0.1', r));
    const origin = `http://127.0.0.1:${upstream.address().port}`;
    const handler = createHandler({ proxy: { '/api': origin } });
    expect((await get(handler, '/api/login')).headers.getSetCookie()).toEqual(['sid=1; HttpOnly', 'csrf=2; Path=/']);
    const s = await serve(handler, { port: 0 });
    const viaHttp = await fetch(s.url + '/api/login');
    expect(viaHttp.headers.getSetCookie()).toEqual(['sid=1; HttpOnly', 'csrf=2; Path=/']);
    await s.close(); upstream.close();
  });

  it('proxy matches and slices the same (encoded) path; "/" proxies everything', async () => {
    const upstream = http.createServer((req, res) => res.end('U:' + req.url));
    await new Promise((r) => upstream.listen(0, '127.0.0.1', r));
    const origin = `http://127.0.0.1:${upstream.address().port}`;
    const api = createHandler({ proxy: { '/api': origin }, files: memory({}) });
    expect(await (await get(api, '/api/a%20b?x=1')).text()).toBe('U:/a%20b?x=1');
    expect((await get(api, '/%61pi/x')).status).toBe(404); // an encoded prefix is not a proxy match (and never corrupts the path)
    const all = createHandler({ proxy: { '/': origin } });
    expect(await (await get(all, '/any/thing')).text()).toBe('U:/any/thing');
    upstream.close();
  });

  it('dev server refuses dotfiles (.env, .git) but serves .xoong and .well-known', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xoong-hide-'));
    await mkdir(join(root, '.xoong')); await mkdir(join(root, '.git')); await mkdir(join(root, '.well-known'));
    await writeFile(join(root, '.env'), 'SECRET=1');
    await writeFile(join(root, '.git', 'config'), '[core]');
    await writeFile(join(root, '.xoong', 'operations.json'), '{}');
    await writeFile(join(root, '.well-known', 'x.txt'), 'ok');
    const dev = await createDevHandler({ root, resolveFrom: root });
    expect([(await get(dev, '/.env')).status, (await get(dev, '/.git/config')).status]).toEqual([404, 404]);
    expect([(await get(dev, '/.xoong/operations.json')).status, (await get(dev, '/.well-known/x.txt')).status]).toEqual([200, 200]);
  });

  it('a base prefixes asset URLs and is stripped from the request, including X-Forwarded-Prefix', async () => {
    const files = memory({
      '/index.html': '<link rel="stylesheet" href="/app.css"><script type="module" src="/src/main.js"></script><a href="/other">x</a>',
      '/app.css': "body{background:url(/bg.png)} @import '/extra.css';",
      '/src/main.js': "import '/src/lib.js';\nimport { x } from './lib.js';\n",
      '/src/lib.js': 'export const x = 1;\n',
    });
    const dev = createHandler({ files, base: '/admin', packages: { '@xoong/ui': { prefix: '/@xoong/ui', exports: { '.': './src/index.js' } } } });
    const home = await (await get(dev, '/admin/studio/pages')).text(); // no such file: 404 without spa. Use the page path.
    expect((await get(dev, '/admin/index.html')).status).toBe(200);
    const html = await (await get(dev, '/admin/index.html')).text();
    expect(html).toContain('href="/admin/app.css"');
    expect(html).toContain('src="/admin/src/main.js"');
    expect(html).toContain('href="/other"'); // a link is not an asset
    expect(html).toContain('"/admin/@xoong/ui/src/index.js"'); // the injected import map
    expect(await (await get(dev, '/admin/src/main.js')).text()).toContain("import '/admin/src/lib.js'");
    expect(await (await get(dev, '/admin/src/main.js')).text()).toContain("from './lib.js'"); // a relative import follows the module URL
    expect(await (await get(dev, '/admin/app.css')).text()).toContain('url(/admin/bg.png)');
    expect(await (await get(dev, '/src/main.js')).status).toBe(200); // the prefix was already stripped by a proxy
    const forwarded = await (await get(createHandler({ files }), '/index.html', { headers: { 'x-forwarded-prefix': '/apps/rainlet' } })).text();
    expect(forwarded).toContain('src="/apps/rainlet/src/main.js"');
    const again = await (await get(dev, '/admin/index.html', { headers: { 'x-forwarded-prefix': '/admin' } })).text();
    expect(again).not.toContain('/admin/admin/');
    expect(await (await get(dev, '/index.html', { headers: { 'x-forwarded-prefix': 'http://evil' } })).text()).toContain('src="/admin/src/main.js"'); // an unsafe header is ignored
    expect(home).toBe('Not found');
    expect(() => createHandler({ base: '../secret' })).toThrow(/base must be a path/);
  });

  it('serve() rejects unknown Host headers (DNS rebinding) and accepts localhost and allowedHosts', async () => {
    const handler = async () => new Response('secret');
    const s = await serve(handler, { port: 0, allowedHosts: ['dev.test'] });
    const ask = (host) => new Promise((resolve) => {
      http.get({ host: '127.0.0.1', port: s.port, path: '/', headers: { host } }, (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve([res.statusCode, b])); });
    });
    expect((await ask('evil.example'))[0]).toBe(403);
    expect((await ask('evil.example:5173'))[1]).toMatch(/not allowed/);
    expect(await ask(`localhost:${s.port}`)).toEqual([200, 'secret']);
    expect(await ask(`[::1]:${s.port}`)).toEqual([200, 'secret']);
    expect((await ask('dev.test:80'))[0]).toBe(200);
    const any = await serve(handler, { port: 0, allowedHosts: ['*'] });
    const askAny = (host, extra) => new Promise((resolve) => {
      http.get({ host: '127.0.0.1', port: any.port, path: '/', headers: { host, ...extra } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    });
    expect(await askAny('192.168.0.200:5173')).toBe(200); // "*" is the opt-in that disables the host check
    await any.close();
    expect((await ask('evil.example'))[0]).toBe(403); // X-Forwarded-Host is not consulted: Host is what is checked
    const forwarded = await new Promise((resolve) => {
      http.get({ host: '127.0.0.1', port: s.port, path: '/', headers: { host: 'evil.example', 'x-forwarded-host': 'localhost' } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    });
    expect(forwarded).toBe(403);
    await s.close();
  });

  it('serves WebAssembly and fonts with the right content type, and does not re-transform unchanged files', async () => {
    let runs = 0;
    const handler = createHandler({
      files: memory({ '/m.wasm': new Uint8Array([0]), '/f.woff2': 'x', '/a.ts': 'const a: number = 1' }),
      transform: { '.ts': (code) => { runs++; return code.replace(': number', ''); } },
    });
    expect((await get(handler, '/m.wasm')).headers.get('content-type')).toBe('application/wasm');
    expect((await get(handler, '/f.woff2')).headers.get('content-type')).toBe('font/woff2');
    await get(handler, '/a.ts'); await get(handler, '/a.ts'); await get(handler, '/a.ts');
    expect(runs).toBe(1);
  });
});
