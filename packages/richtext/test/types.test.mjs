// The declarations of @xoong/richtext (src/*.d.ts) are checked by the TypeScript compiler against a consumer file (test/types/consumer.ts):
// correct code compiles, mistakes fail (each `@ts-expect-error` in the file must be an error), and the declarations themselves are checked (no skipLibCheck).
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtemp, copyFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const repo = resolve(new URL('../../..', import.meta.url).pathname);

test('richtext types: right code compiles, wrong code is a compile error', async () => {
  const dir = await mkdtemp(join(repo, '.tmp-types-richtext-'));
  try {
    await copyFile(new URL('./types/consumer.ts', import.meta.url), join(dir, 'consumer.ts'));
    await writeFile(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: 'es2022', module: 'esnext', moduleResolution: 'bundler', lib: ['es2022', 'dom'] }, files: ['consumer.ts'] }));
    const { stdout } = await run(join(repo, 'node_modules/.bin/tsc'), ['-p', dir], { cwd: repo }).catch((e) => ({ stdout: `${e.stdout}${e.stderr}` }));
    assert.equal(stdout.trim(), '', `tsc reported:\n${stdout}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 60000);
