import { describe, it, expect, afterEach } from 'vitest';
import '@xoong/controls';

const mountTabs = async (attrs = '', extra = '') => {
  document.body.innerHTML = `<form><xo-tabs label="Article" ${attrs}>
    <section xo-tab="General"><input name="title"></section>
    <section xo-tab="SEO" id="seo"><input name="seo.title" required></section>
    <section xo-tab="Extra"><p>Extra</p>${extra}</section>
  </xo-tabs></form>`;
  await new Promise((r) => setTimeout(r, 0));
  return document.querySelector('xo-tabs');
};
const tabs = () => [...document.querySelectorAll('[role=tab]')];
const hidden = () => [...document.querySelectorAll('[role=tabpanel]')].map((p) => p.hidden);
const key = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

afterEach(() => { document.body.innerHTML = ''; });

describe('<xo-tabs>', () => {
  it('builds a tablist from the sections: roles, labels, the first tab selected, panels linked to their tabs', async () => {
    await mountTabs();
    const list = document.querySelector('[role=tablist]');
    expect(list.getAttribute('aria-label')).toBe('Article');
    expect(tabs().map((t) => t.textContent)).toEqual(['General', 'SEO', 'Extra']);
    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(tabs().map((t) => t.tabIndex)).toEqual([0, -1, -1]); // roving tabindex
    expect(hidden()).toEqual([false, true, true]);
    const panel = document.querySelector('#seo');
    expect(panel.getAttribute('role')).toBe('tabpanel');
    expect(tabs()[1].getAttribute('aria-controls')).toBe('seo');
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs()[1].id);
  });

  it('a click selects, sets `value` (the section id, or the position) and fires xo-tab-change once', async () => {
    const el = await mountTabs();
    const seen = [];
    el.addEventListener('xo-tab-change', (e) => seen.push(e.detail.value));
    tabs()[1].click();
    tabs()[1].click(); // already selected: no second event
    tabs()[2].click();
    expect(seen).toEqual(['seo', '2']);
    expect(el.getAttribute('value')).toBe('2');
    expect(hidden()).toEqual([true, true, false]);
  });

  it('`value` picks the first tab, and changing the attribute selects', async () => {
    const el = await mountTabs('value="seo"');
    expect(hidden()).toEqual([true, false, true]);
    el.setAttribute('value', '0');
    expect(hidden()).toEqual([false, true, true]);
    el.setAttribute('value', 'nothing'); // unknown keys are ignored
    expect(hidden()).toEqual([false, true, true]);
  });

  it('arrow keys, Home and End move the selection and the focus, wrapping around', async () => {
    await mountTabs();
    key(tabs()[0], 'ArrowRight');
    expect(hidden()).toEqual([true, false, true]);
    expect(document.activeElement).toBe(tabs()[1]);
    key(tabs()[1], 'End');
    expect(hidden()).toEqual([true, true, false]);
    key(tabs()[2], 'ArrowRight');
    expect(hidden()).toEqual([false, true, true]); // wrapped to the first
    key(tabs()[0], 'ArrowLeft');
    expect(hidden()).toEqual([true, true, false]);
    key(tabs()[2], 'Home');
    expect(hidden()).toEqual([false, true, true]);
    const ev = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    tabs()[0].dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false); // other keys are left alone
  });

  it('xo-reveal selects the tab that holds the invalid field and answers the event', async () => {
    await mountTabs();
    const ev = new CustomEvent('xo-reveal', { detail: { path: 'seo.title' }, cancelable: true, bubbles: true });
    document.querySelector('form').dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(hidden()).toEqual([true, false, true]);
    const here = new CustomEvent('xo-reveal', { detail: { path: 'seo.title' }, cancelable: true });
    document.querySelector('form').dispatchEvent(here);
    expect(here.defaultPrevented).toBe(false); // already visible: nothing to answer
    const unknown = new CustomEvent('xo-reveal', { detail: { path: 'not.here' }, cancelable: true });
    document.querySelector('form').dispatchEvent(unknown);
    expect(unknown.defaultPrevented).toBe(false);
  });

  it('a tab whose panel holds an aria-invalid control is marked data-invalid', async () => {
    await mountTabs();
    const input = document.querySelector('[name="seo.title"]');
    input.setAttribute('aria-invalid', 'true');
    await new Promise((r) => setTimeout(r, 0));
    expect(tabs().map((t) => t.hasAttribute('data-invalid'))).toEqual([false, true, false]);
    input.removeAttribute('aria-invalid');
    await new Promise((r) => setTimeout(r, 0));
    expect(tabs().some((t) => t.hasAttribute('data-invalid'))).toBe(false);
  });
});
