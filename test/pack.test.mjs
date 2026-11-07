// The tarballs rainlet (or any project) installs must contain what a package needs and nothing it does not.
import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pack } from '../tools/pack.mjs';

const run = promisify(execFile);

describe('tools/pack.mjs', () => {
  it('packs every package, lists them in consume.json, and a project can install them from tarballs', async () => {
    const out = await mkdtemp(join(tmpdir(), 'xoong-pack-'));
    const packed = await pack(out);
    const dirs = (await readdir('packages')).sort();
    expect(packed.map((p) => p.name).sort()).toEqual(dirs.map((d) => JSON.parse(require_('packages/' + d + '/package.json')).name).sort());

    const consume = JSON.parse(await readFile(join(out, 'consume.json'), 'utf8'));
    expect(Object.keys(consume.overrides)).toEqual(expect.arrayContaining(['@xoong/core', '@xoong/data', '@xoong/ui', 'xoong']));
    expect(consume.commit).toMatch(/^[0-9a-f]{7,}$/);

    // tarballs contain source and manifest, not tests
    const { stdout } = await run('tar', ['-tzf', packed.find((p) => p.name === '@xoong/data').file]);
    expect(stdout).toContain('package/src/client.js');
    expect(stdout).toContain('package/src/index.d.ts');
    expect(stdout).not.toMatch(/package\/test\//);

    // a fresh project installs them from the tarballs alone (external dependencies such as parse5 come from the registry, so this test needs network)
    const app = await mkdtemp(join(tmpdir(), 'xoong-consumer-'));
    await mkdir(app, { recursive: true });
    await writeFile(join(app, 'package.json'), JSON.stringify({ name: 'consumer', private: true, type: 'module', dependencies: { xoong: consume.dependencies.xoong, '@xoong/ui': consume.dependencies['@xoong/ui'] }, overrides: consume.overrides }));
    await run('npm', ['install', '--no-audit', '--no-fund'], { cwd: app, timeout: 120000 });
    const { stdout: ok } = await run(process.execPath, ['--input-type=module', '-e', "import { signal, configure } from 'xoong'; console.log(typeof signal(1).value, typeof configure)"], { cwd: app });
    expect(ok.trim()).toBe('number function');
  }, 180000);
});

import { readFileSync } from 'node:fs';
function require_(path) { return readFileSync(path, 'utf8'); }
