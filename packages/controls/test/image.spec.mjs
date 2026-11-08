import { describe, it, expect, afterEach } from 'vitest';
import '@xoong/controls';

const mount = async (attrs) => { document.body.innerHTML = `<xo-image ${attrs}></xo-image>`; await new Promise((r) => setTimeout(r, 0)); return document.querySelector('xo-image'); };
afterEach(() => { document.body.innerHTML = ''; });

describe('<xo-image>', () => {
  it('draws a lazy, async img with alt, size and srcset; the box shows a loading state, then loaded', async () => {
    const el = await mount('src="/a.jpg" alt="Harbour" width="1200" height="800" srcset="/s.jpg 480w, /a.jpg 1200w" sizes="50vw"');
    const img = el.querySelector('img');
    expect(img.getAttribute('src')).toBe('/a.jpg');
    expect(img.alt).toBe('Harbour');
    expect(img.loading).toBe('lazy');
    expect(img.decoding).toBe('async');
    expect(img.getAttribute('width')).toBe('1200');
    expect(img.srcset).toContain('480w');
    expect(img.sizes).toBe('50vw');
    expect(el.style.aspectRatio.replace(/\s/g, '')).toBe('1200/800');
    expect(el.dataset.state).toBe('loading');
    let loads = 0;
    el.addEventListener('load', () => loads++);
    img.dispatchEvent(new Event('load'));
    expect(el.dataset.state).toBe('loaded');
    expect(loads).toBe(1);
  });
  it('priority is eager with high fetch priority; ratio, fit and position are set through the CSS object model', async () => {
    const el = await mount('src="/hero.jpg" alt="" priority ratio="16 / 9" fit="contain" position="top"');
    const img = el.querySelector('img');
    expect(img.loading).toBe('eager');
    expect(img.fetchPriority).toBe('high');
    expect(el.style.getPropertyValue('--xo-image-fit')).toBe('contain');
    expect(el.style.getPropertyValue('--xo-image-position')).toBe('top');
    expect(el.hasAttribute('style')).toBe(true);
  });
  it('an error tries the fallback once, then shows the alt text in the box and fires error', async () => {
    const el = await mount('src="/missing.jpg" alt="Harbour" fallback="/none.png"');
    const img = el.querySelector('img');
    img.dispatchEvent(new Event('error'));
    expect(img.getAttribute('src')).toBe('/none.png');
    expect(el.dataset.state).toBe('loading');
    let errors = 0;
    el.addEventListener('error', () => errors++);
    img.dispatchEvent(new Event('error'));
    expect(el.dataset.state).toBe('error');
    expect(el.querySelector('.xo-image-note').textContent).toBe('Harbour');
    expect(errors).toBe(1);
  });
  it('a changed src loads again; no src is the empty state', async () => {
    const el = await mount('src="/a.jpg" alt="x"');
    const img = el.querySelector('img');
    img.dispatchEvent(new Event('load'));
    el.setAttribute('src', '/b.jpg');
    expect(img.getAttribute('src')).toBe('/b.jpg');
    expect(el.dataset.state).toBe('loading');
    el.removeAttribute('src');
    expect(el.dataset.state).toBe('empty');
    expect(img.hasAttribute('src')).toBe(false);
  });
});
