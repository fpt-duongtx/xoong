// The typed client (src/index.d.ts) is checked by the TypeScript compiler against a client generated from a real
// OpenAPI file: correct calls compile, mistakes fail (each `@ts-expect-error` in the fixture must be an error).
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtemp, copyFile, writeFile, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sync } from '../../cli/src/commands.js';

const run = promisify(execFile);
const repo = resolve(new URL('../../..', import.meta.url).pathname);

test('typed client: right calls compile, wrong calls are compile errors', async () => {
  const dir = await mkdtemp(join(repo, '.tmp-types-'));
  try {
    await sync(join(repo, 'examples/admin/openapi.json'), { out: dir });
    await copyFile(new URL('./types/typed-client.ts', import.meta.url), join(dir, 'typed-client.ts'));
    await copyFile(join(dir, 'operations.json'), join(dir, 'operations.json'));
    await writeFile(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: 'es2022', module: 'esnext', moduleResolution: 'bundler', resolveJsonModule: true, allowImportingTsExtensions: true, skipLibCheck: true, lib: ['es2022', 'dom'] }, files: ['typed-client.ts'] }));
    const tsc = join(repo, 'node_modules/.bin/tsc');
    const { stdout } = await run(tsc, ['-p', dir], { cwd: repo }).catch((e) => ({ stdout: `${e.stdout}${e.stderr}` }));
    assert.equal(stdout.trim(), '', `tsc reported:\n${stdout}`);
  } finally {
    const { rm } = await import('node:fs/promises');
    await rm(dir, { recursive: true, force: true });
  }
}, 60000);
