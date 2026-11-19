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
      expect(r.behaviour, 'the page must also WORK (the behaviour stage)').toEqual([]);
      expect(r.pass).toBe(true);
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

  it('the behaviour stage catches a page that passes the static stage but does not work', async () => {
    // right constructs and operations, but the form has no field named name or role, and Delete is wired to Disable
    const page = '<xo-view get="/users"><table><tr xo-each="items"><td>{name}</td><td>{email}</td><td>{role}</td><td>{status}</td><td><button xo-click="POST /users/{id}/disable">Disable</button><button xo-click="POST /users/{id}/disable">Delete</button><button xo-click="DELETE /users/{id}" hidden>x</button></td></tr></table></xo-view><xo-view><form xo-submit="POST /users"><input name="fullname"><input name="email"><button>Add</button></form></xo-view>';
    const r = await score('crud-admin', await attempt('crud-admin', { 'index.html': page }));
    expect(r.staticPass).toBe(true);
    expect(r.pass).toBe(false);
    expect(r.behaviour.join('\n')).toMatch(/Delete on the first row did not call deleteUser/);
    expect(r.behaviour.join('\n')).toMatch(/the form has no field for: name, role/);
  });

  it('the three later tasks reject their typical mistakes', async () => {
    // edit-article: the id is written into the page, not read from the page address
    const noFill = await score('edit-article', await attempt('edit-article', { 'edit.html': '<xo-view get="getArticle" p-id="3"><form xo-submit="updateArticle"><input name="title"><textarea name="body"></textarea><button>Save</button></form></xo-view>' }));
    expect(noFill.pass).toBe(false);
    expect(noFill.behaviour.join('\n')).toMatch(/ask getArticle for the id in the page address/);
    // bulk-delete: one Delete per row instead of one request for the ticked rows
    const perRow = await score('bulk-delete', await attempt('bulk-delete', { 'index.html': '<xo-view get="listTasks"><table><tr xo-each="items"><td><input type="checkbox" xo-select></td><td>{title}</td><td><button xo-click="deleteTasks" xo-selected="ids">Delete selected</button></td></tr></table></xo-view>' }));
    expect(perRow.pass).toBe(false);
    // error-retry: no Retry button, and the error never shown
    const silent = await score('error-retry', await attempt('error-retry', { 'index.html': '<xo-view get="listNotes"><p xo-if="$loading">Loading…</p><p xo-if="$error">Something went wrong</p><ul><li xo-each=".">{text}</li></ul></xo-view>' }));
    expect(silent.pass).toBe(false);
    expect(silent.behaviour.join('\n')).toMatch(/does not show the message the server sent/);
    expect(silent.behaviour.join('\n')).toMatch(/no Retry button/);
  });

  it('an empty page and a hard-coded table fail with reasons a person can act on', async () => {
    const hard = await score('crud-admin', await attempt('crud-admin', { 'index.html': '<table><tr><td>Ada Lovelace</td><td><button>Disable</button><button>Delete</button></td></tr></table>' }));
    expect(hard.pass).toBe(false);
    expect(hard.behaviour.join('\n')).toMatch(/never asked for the users/);
  });

  it('requires the operations and constructs of the task', async () => {
    const r = await score('crud-admin', await attempt('crud-admin', { 'index.html': '<xo-view get="/users"><tr xo-each="items"><td>{name}</td></tr></xo-view>' }));
    expect(r.failures).toEqual(expect.arrayContaining(['does not use createUser', 'does not use deleteUser', 'does not contain "xo-submit|xo-form"']));
  });
});

describe('the suite is repeatable', async () => {
  const { parseFiles, promptOf, fingerprint, tasks: suiteTasks, SUITE_VERSION } = await import('../tools/benchmark/suite.mjs');

  it('every task has an OpenAPI file, a task text, a reference and a prompt that holds the spec, the operations and the task', async () => {
    for (const name of Object.keys(suiteTasks)) {
      const prompt = await promptOf(name);
      expect(prompt, name).toContain('===== 1. THE XOONG SPEC =====');
      expect(prompt, name).toContain('## Rules (follow all of them)'); // llms.txt itself
      expect(prompt, name).toContain('"call": ');                       // the operations list
      expect(prompt, name).toContain(`Files to write: ${suiteTasks[name].files.join(', ')}.`);
    }
  });

  it('the fingerprint is stable: the same inputs give the same hashes', async () => {
    const a = await fingerprint();
    const b = await fingerprint();
    expect(a).toEqual(b);
    expect(a.suiteVersion).toBe(SUITE_VERSION);
    expect(Object.keys(a.prompts).sort()).toEqual(Object.keys(suiteTasks).sort());
  });

  it('files are taken from an answer in the form the instructions ask for, and never from outside the folder', () => {
    const answer = 'Sure.\n\nFILE: index.html\n```html\n<p>a</p>\n```\n\n**FILE: `app.css`**\n```css\np { color: red }\n```\n\nFILE: ../evil.txt\n```\nx\n```\nFILE: /abs.txt\n```\nx\n```\n\nFILE: src/main.ts\n~~~ts\nconst a = 1;\n~~~\n';
    expect(parseFiles(answer)).toEqual({ 'index.html': '<p>a</p>\n', 'app.css': 'p { color: red }\n', 'abs.txt': 'x\n', 'src/main.ts': 'const a = 1;\n' }); // a leading / is read as the folder root; .. is refused
    expect(parseFiles('no files here')).toEqual({});
  });
});
