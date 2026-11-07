import { test } from 'vitest';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as core from '@xoong/core';
import * as data from '@xoong/data';
import * as umbrella from '../src/index.js';

const run = promisify(execFile);

test('`xoong` re-exports the runtime of core and data without clashes', () => {
  for (const name of [...Object.keys(core), ...Object.keys(data)]) assert.equal(typeof umbrella[name], typeof (core[name] ?? data[name]), name);
  assert.equal(umbrella.signal, core.signal);
  assert.equal(umbrella.configure, data.configure);
});

test('no export name is shared by core and data (an `export *` clash would silently drop it)', () => {
  const shared = Object.keys(core).filter((k) => k in data);
  assert.deepEqual(shared, []);
});

test('the `xoong` command is the xoong CLI', async () => {
  const { stdout } = await run(process.execPath, [new URL('../src/cli.js', import.meta.url).pathname]);
  assert.match(stdout, /xoong <command>/);
  assert.match(stdout, /sync <openapi/);
});
