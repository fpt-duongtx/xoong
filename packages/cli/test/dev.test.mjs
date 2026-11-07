import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startDev, parseProxyFlags, loadConfig } from '../src/dev.js';

const repo = new URL('../../..', import.meta.url).pathname;
const cleanup = [];
afterEach(async () => { await Promise.all(cleanup.splice(0).map((f) => f())); });

describe('xoong dev', () => {
  it('parses --proxy flags and rejects malformed ones', () => {
    expect(parseProxyFlags(['/api=http://a:1', '/x=http://b:2/base'])).toEqual({ '/api': 'http://a:1', '/x': 'http://b:2/base' });
    expect(() => parseProxyFlags(['nonsense'])).toThrow(/--proxy expects/);
  });

  it('reads xoong.config.json and reports a broken one clearly', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'xoong-cfg-'));
    expect(await loadConfig(dir)).toEqual({});
    await writeFile(join(dir, 'xoong.config.json'), '{"port": 4000, "proxy": {"/api": "http://x"}}');
    expect(await loadConfig(dir)).toEqual({ port: 4000, proxy: { '/api': 'http://x' } });
    await writeFile(join(dir, 'xoong.config.json'), '{ nope');
    await expect(loadConfig(dir)).rejects.toThrow(/could not read xoong\.config\.json/);
  });

  it('serves a project over http, strips TypeScript, injects the import map and proxies the API', async () => {
    const backend = http.createServer((req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ path: req.url })); });
    await new Promise((r) => backend.listen(0, '127.0.0.1', r));
    cleanup.push(() => new Promise((r) => backend.close(r)));

    const root = await mkdtemp(join(tmpdir(), 'xoong-app-'));
    await writeFile(join(root, 'index.html'), '<h1>app</h1><script type="module" src="/main.ts"></script>');
    await writeFile(join(root, 'main.ts'), 'export const answer: number = 42;');
    await writeFile(join(root, 'xoong.config.json'), JSON.stringify({ proxy: { '/api': `http://127.0.0.1:${backend.address().port}` } }));

    const dev = await startDev({ root, resolveFrom: repo, port: 0, quiet: true });
    cleanup.push(() => dev.close());

    const page = await (await fetch(dev.url + '/')).text();
    expect(page).toContain('<h1>app</h1>');
    expect(page).toContain('"@xoong/data":"/@xoong/data/src/index.js"');
    expect(await (await fetch(dev.url + '/main.ts')).text()).toMatch(/export const answer\s+= 42;/);
    expect(await (await fetch(dev.url + '/api/users?x=1')).json()).toEqual({ path: '/users?x=1' });
  });

  it('flags override the config file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'xoong-app-'));
    await writeFile(join(root, 'xoong.config.json'), JSON.stringify({ proxy: { '/api': 'http://127.0.0.1:1' } }));
    await writeFile(join(root, 'index.html'), 'x');
    const dev = await startDev({ root, resolveFrom: repo, port: 0, quiet: true, proxy: { '/api': 'http://127.0.0.1:2' } });
    cleanup.push(() => dev.close());
    const res = await fetch(dev.url + '/api/x');
    expect(res.status).toBe(502);
    expect(await res.text()).toContain('127.0.0.1:2'); // the flag, not the config, was used
  });
});
