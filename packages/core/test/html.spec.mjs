// The same behaviours as dom.test.mjs (which runs in real Chromium), executed in happy-dom so that
// coverage is measured and the two environments cross-check each other.
import { describe, it, expect, beforeEach } from 'vitest';
import { signal, html, render, XoElement, define } from '../src/index.js';

beforeEach(() => { document.body.innerHTML = ''; });
const mount = () => document.body.appendChild(document.createElement('div'));

describe('html templates', () => {
  it('child, attribute, boolean, property and event bindings', () => {
    const name = signal('Ada'), cls = signal('a'), on = signal(false), clicks = signal(0);
    const root = mount();
    render(html`<h3 class=${() => cls.value}>${() => name.value}</h3>
      <input ?disabled=${() => on.value} .value=${'x'}>
      <button @click=${() => clicks.value++}>go</button>`, root);
    const h3 = root.querySelector('h3'), input = root.querySelector('input');
    expect([h3.textContent, h3.className, input.disabled, input.value]).toEqual(['Ada', 'a', false, 'x']);
    name.value = 'Grace'; cls.value = 'b'; on.value = true;
    root.querySelector('button').click();
    expect([h3.textContent, h3.className, input.disabled, clicks.value]).toEqual(['Grace', 'b', true, 1]);
  });

  it('quoted attribute expression, arrays and nested templates', () => {
    const items = signal(['a', 'b']);
    const root = mount();
    render(html`<ul title="${() => items.value.length}">${() => items.value.map((x) => html`<li>${x}</li>`)}</ul>`, root);
    expect([root.querySelectorAll('li').length, root.querySelector('ul').title]).toEqual([2, '2']);
    items.value = ['a', 'b', 'c'];
    expect([root.querySelectorAll('li').length, root.querySelector('ul').title]).toEqual([3, '3']);
  });

  it('null, false and true render nothing; text is not parsed as HTML', () => {
    const root = mount();
    render(html`<p>${null}${false}${true}${'<b>x</b>'}</p>`, root);
    expect(root.querySelector('p').textContent).toBe('<b>x</b>');
    expect(root.querySelector('b')).toBeNull();
  });

  it('null/false remove an attribute, true sets it empty', () => {
    const v = signal(null);
    const root = mount();
    render(html`<i data-x=${() => v.value}></i>`, root);
    const i = root.querySelector('i');
    expect(i.hasAttribute('data-x')).toBe(false);
    v.value = true; expect(i.getAttribute('data-x')).toBe('');
    v.value = 'on'; expect(i.getAttribute('data-x')).toBe('on');
    v.value = false; expect(i.hasAttribute('data-x')).toBe(false);
  });

  it('dispose removes listeners and stops updates', () => {
    const n = signal(1);
    const root = mount();
    const stop = render(html`<p>${() => n.value}</p>`, root);
    stop();
    n.value = 2;
    expect(root.textContent).toBe('');
  });

  it('an expression that is not a whole attribute value is rejected with a clear error', () => {
    expect(() => render(html`<p class="a ${'b'} c"></p>`, mount())).toThrow(/whole attribute value/);
    expect(() => render(html`<p class="${'b'}"></p>`, mount())).not.toThrow(); // a quoted expression on its own is fine
  });
});

describe('XoElement', () => {
  it('props reflect attributes, render owns content, effect is disposed on disconnect', () => {
    let effectRuns = 0;
    class UserCard extends XoElement {
      static props = { name: String, count: Number, active: Boolean };
      render() { return html`<b>${() => this.name}:${() => this.count}:${() => String(this.active)}</b>`; }
      connected() { this.effect(() => { this.count; effectRuns++; }); }
    }
    define('user-card-spec', UserCard);
    const el = document.createElement('user-card-spec');
    el.setAttribute('name', 'Ada'); el.setAttribute('count', '2'); el.setAttribute('active', '');
    document.body.append(el);
    expect(el.textContent).toBe('Ada:2:true');
    el.count = 5;
    expect(el.textContent).toBe('Ada:5:true');
    el.active = false;
    expect(el.textContent).toBe('Ada:5:false');
    el.remove();
    const at = effectRuns;
    el.count = 9;
    expect(effectRuns).toBe(at);
  });

  it('define is idempotent; enhancement mode keeps server HTML; emit bubbles', () => {
    let heard = null;
    class Counter extends XoElement { connected() { this.dataset.ready = '1'; this.emit('counter-ready', 7); } }
    define('x-counter-spec', Counter); define('x-counter-spec', Counter);
    document.body.addEventListener('counter-ready', (e) => { heard = e.detail; });
    document.body.innerHTML = '<x-counter-spec><span>server</span></x-counter-spec>';
    const el = document.querySelector('x-counter-spec');
    expect([el.dataset.ready, el.innerHTML, heard]).toEqual(['1', '<span>server</span>', 7]);
  });

  it('property set before upgrade survives, and number/boolean coercion works', () => {
    class P extends XoElement { static props = { n: Number, flag: Boolean, s: String }; }
    const pre = document.createElement('x-pre-spec');
    pre.n = '41';
    define('x-pre-spec', P);
    document.body.append(pre);
    pre.n = '42'; pre.flag = 'false'; pre.s = null;
    expect([pre.n, pre.flag, pre.s]).toEqual([42, false, '']);
    pre.setAttribute('flag', ''); pre.setAttribute('n', '3');
    expect([pre.flag, pre.n]).toEqual([true, 3]);
  });

  it('style:name=${...} sets a CSS property through the CSS object model (custom properties too), and removes it for null', () => {
    const x = signal('10px'), w = signal(null);
    const root = mount();
    render(html`<i style:--x=${() => x.value} style:width=${() => w.value} style:color=${'red'}></i>`, root);
    const el = root.querySelector('i');
    expect(el.hasAttribute('style:--x')).toBe(false);
    expect(el.style.getPropertyValue('--x')).toBe('10px');
    expect(el.style.width).toBe('');
    expect(el.style.color).toBe('red');
    x.value = '2rem'; w.value = '50%';
    expect([el.style.getPropertyValue('--x'), el.style.width]).toEqual(['2rem', '50%']);
    w.value = null;
    expect(el.style.width).toBe('');
  });

  it('ready() resolves with the element once its children can be read', async () => {
    class R extends XoElement {}
    define('x-ready-spec', R);
    document.body.innerHTML = '<x-ready-spec><b>child</b></x-ready-spec>';
    const el = document.querySelector('x-ready-spec');
    expect(await el.ready()).toBe(el);
    expect(el.querySelector('b').textContent).toBe('child');
  });
});
