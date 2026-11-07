import { test } from 'vitest';
import assert from 'node:assert/strict';
import { withBrowser } from '../../../tools/browser.mjs';

const run = (body) => withBrowser(async (page, base, errors) => {
  const result = await page.evaluate(`(async () => {
    const core = await import('/packages/core/src/index.js');
    const { signal, html, render, XoElement, define } = core;
    ${body}
  })()`);
  assert.deepEqual(errors, []);
  return result;
});

test('child, attribute, boolean, property and event bindings', async () => {
  const r = await run(`
    const name = signal('Ada'), cls = signal('a'), on = signal(false), clicks = signal(0);
    const root = document.body.appendChild(document.createElement('div'));
    render(html\`<h3 class=\${() => cls.value}>\${() => name.value}</h3>
      <input ?disabled=\${() => on.value} .value=\${'x'}>
      <button @click=\${() => clicks.value++}>go</button>\`, root);
    const h3 = root.querySelector('h3'), input = root.querySelector('input');
    const first = [h3.textContent, h3.className, input.disabled, input.value];
    name.value = 'Grace'; cls.value = 'b'; on.value = true;
    root.querySelector('button').click();
    return { first, after: [h3.textContent, h3.className, input.disabled], clicks: clicks.value };
  `);
  assert.deepEqual(r.first, ['Ada', 'a', false, 'x']);
  assert.deepEqual(r.after, ['Grace', 'b', true]);
  assert.equal(r.clicks, 1);
});

test('quoted attribute expression, arrays and nested templates', async () => {
  const r = await run(`
    const items = signal(['a','b']);
    const root = document.body.appendChild(document.createElement('div'));
    render(html\`<ul title="\${() => items.value.length}">\${() => items.value.map((x) => html\`<li>\${x}</li>\`)}</ul>\`, root);
    const before = [root.querySelectorAll('li').length, root.querySelector('ul').title];
    items.value = ['a','b','c'];
    return { before, after: [root.querySelectorAll('li').length, root.querySelector('ul').title] };
  `);
  assert.deepEqual(r.before, [2, '2']);
  assert.deepEqual(r.after, [3, '3']);
});

test('dispose removes listeners and stops updates', async () => {
  const r = await run(`
    const n = signal(1);
    const root = document.body.appendChild(document.createElement('div'));
    const stop = render(html\`<p>\${() => n.value}</p>\`, root);
    stop();
    n.value = 2;
    return root.textContent;
  `);
  assert.equal(r, '');
});

test('XoElement: props reflect attributes, render owns content, effect disposed on disconnect', async () => {
  const r = await run(`
    let effectRuns = 0;
    class UserCard extends XoElement {
      static props = { name: String, count: Number, active: Boolean };
      render() { return html\`<b>\${() => this.name}:\${() => this.count}:\${() => String(this.active)}</b>\`; }
      connected() { this.effect(() => { this.count; effectRuns++; }); }
    }
    define('user-card', UserCard);
    const el = document.createElement('user-card');
    el.setAttribute('name', 'Ada'); el.setAttribute('count', '2'); el.setAttribute('active', '');
    document.body.append(el);
    const a = el.textContent;
    el.count = 5;
    const b = el.textContent;
    el.remove();
    const runsAtRemove = effectRuns;
    el.count = 9;
    return { a, b, disposed: effectRuns === runsAtRemove, attrToProp: el.getAttribute('count') };
  `);
  assert.equal(r.a, 'Ada:2:true');
  assert.equal(r.b, 'Ada:5:true');
  assert.equal(r.disposed, true);
});

test('define is idempotent and enhancement mode keeps server HTML', async () => {
  const r = await run(`
    class Counter extends XoElement { connected() { this.dataset.ready = '1'; } }
    define('x-counter', Counter); define('x-counter', Counter);
    document.body.innerHTML = '<x-counter><span>server</span></x-counter>';
    const el = document.querySelector('x-counter');
    return [el.dataset.ready, el.innerHTML];
  `);
  assert.deepEqual(r, ['1', '<span>server</span>']);
});
