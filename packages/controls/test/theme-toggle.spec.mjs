import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import '@xoong/controls';

const mount = async (attrs = '') => { document.body.innerHTML = `<xo-theme-toggle ${attrs}></xo-theme-toggle>`; await new Promise((r) => setTimeout(r, 0)); return document.querySelector('xo-theme-toggle'); };
beforeEach(() => { localStorage.clear(); delete document.documentElement.dataset.theme; });
afterEach(() => { document.body.innerHTML = ''; localStorage.clear(); delete document.documentElement.dataset.theme; });

describe('<xo-theme-toggle>', () => {
  it('toggles data-theme on <html>, saves the choice, is pressed when dark, and fires xo-theme-change', async () => {
    const el = await mount();
    const b = el.querySelector('button');
    const seen = [];
    el.addEventListener('xo-theme-change', (e) => seen.push(e.detail.theme));
    expect(b.getAttribute('aria-label')).toBe('Dark theme');
    b.click(); // from the system theme (light in the test DOM) to dark
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('xoong-theme')).toBe('dark');
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(b.firstElementChild.dataset.ic).toBe('sun');
    b.click();
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(b.getAttribute('aria-pressed')).toBe('false');
    expect(seen).toEqual(['dark', 'light']);
  });
  it('a saved choice is applied on connect; reset follows the system again', async () => {
    localStorage.setItem('xoong-theme', 'dark');
    const el = await mount();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(el.querySelector('button').getAttribute('aria-pressed')).toBe('true');
    el.reset();
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem('xoong-theme')).toBeNull();
  });
});
