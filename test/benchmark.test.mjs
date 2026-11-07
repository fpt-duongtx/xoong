// The first-attempt-correctness scorer (tools/benchmark) must accept the reference solutions and reject typical mistakes,
// otherwise a published pass rate would mean nothing.
import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { score, tasks } from '../tools/benchmark/score.mjs';

const ref = (task) => join('tools/benchmark/tasks', task, 'reference');
const attempt = async (task, files) => { const dir = await mkdtemp(join(tmpdir(), 'xoong-attempt-')); await cp(ref(task), dir, { recursive: true }); for (const [f, t] of Object.entries(files)) await writeFile(join(dir, f), t); return dir; };

describe('benchmark scorer', () => {
  for (const task of Object.keys(tasks)) {
    it(`the reference solution of "${task}" passes`, async () => {
      const r = await score(task, ref(task));
      expect(r.failures).toEqual([]);
    });
  }

  it('rejects a typo in an operation (xoong check error), hand-written fetch and utility classes, and missing files', async () => {
    const typo = await score('crud-admin', await attempt('crud-admin', { 'index.html': '<xo-view get="/users"><tr xo-each="items"><button xo-click="POST /user/{id}/disable">x</button></tr></xo-view>' }));
    expect(typo.pass).toBe(false);
    expect(typo.failures.join('\n')).toMatch(/XO201/);
    const fetched = await score('live-updates', await attempt('live-updates', { 'index.html': '<xo-view live get="/users"><li xo-each="items">{name}<button xo-click="POST /users/{id}/disable">x</button></li></xo-view><script>fetch("/users")</script>' }));
    expect(fetched.failures).toContain('calls fetch() by hand');
    const utility = await score('shared-data', await attempt('shared-data', { 'index.html': ref('shared-data') && '<div class="flex p-4"><xo-view get="/orders"><i xo-each="items">{customer.name}</i></xo-view><xo-view get="/customers"><i xo-each=".">{name}</i></xo-view></div>' }));
    expect(utility.failures).toContain('uses utility classes');
    const missing = await score('small-site', await attempt('small-site', { 'post.html': '' }).then(async (d) => { await (await import('node:fs/promises')).rm(join(d, 'post.html')); return d; }));
    expect(missing.failures).toContain('missing file post.html');
  });

  it('requires the operations and constructs of the task', async () => {
    const r = await score('crud-admin', await attempt('crud-admin', { 'index.html': '<xo-view get="/users"><tr xo-each="items"><td>{name}</td></tr></xo-view>' }));
    expect(r.failures).toEqual(expect.arrayContaining(['does not use createUser', 'does not use deleteUser', 'does not contain "xo-submit"']));
  });
});
