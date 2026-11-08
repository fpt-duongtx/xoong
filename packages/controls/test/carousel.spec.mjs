// <xo-carousel> structure and behaviour that do not need layout (happy-dom has none); controls.test.mjs checks scrolling in a real browser.
import { describe, it, expect, afterEach, vi } from 'vitest';
import '@xoong/controls';

const mountCarousel = async (attrs = '', slides = 5, extra = '') => {
  document.body.innerHTML = `<xo-carousel label="Services" ${attrs}>${Array.from({ length: slides }, (_, i) => `<article data-thumb="/t${i}.png"><h3>Slide ${i + 1}</h3></article>`).join('')}${extra}</xo-carousel>`;
  await new Promise((r) => setTimeout(r, 0));
  return document.querySelector('xo-carousel');
};
const q = (s) => document.querySelector(s);
const slides = () => [...document.querySelectorAll('.xo-carousel-track > article')];
const dots = () => [...document.querySelectorAll('.xo-carousel-dots button')];

afterEach(() => { document.body.innerHTML = ''; vi.useRealTimers(); });

describe('<xo-carousel>', () => {
  it('follows the WAI-ARIA carousel pattern: a named region, slides as groups, labelled buttons', async () => {
    const el = await mountCarousel();
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-roledescription')).toBe('carousel');
    expect(el.getAttribute('aria-label')).toBe('Services');
    expect(slides().map((s) => s.getAttribute('aria-label'))).toEqual(['1 of 5', '2 of 5', '3 of 5', '4 of 5', '5 of 5']);
    expect(slides().every((s) => s.getAttribute('role') === 'group' && s.getAttribute('aria-roledescription') === 'slide')).toBe(true);
    expect(q('.xo-carousel-track').tabIndex).toBe(0); // a scroll area the keyboard can reach
    expect(q('.xo-carousel-prev').getAttribute('aria-label')).toBe('Previous slide');
    expect(q('.xo-carousel-next').getAttribute('aria-label')).toBe('Next slide');
    expect(q('.xo-carousel-prev').disabled).toBe(true); // at the start
    expect(q('.xo-carousel-toggle').hidden).toBe(true); // nothing plays by itself
    expect(q('.xo-carousel-dots').hidden).toBe(true);
    expect(q('.xo-carousel-count').hidden).toBe(true);
  });

  it('keeps a slide label the author wrote', async () => {
    document.body.innerHTML = '<xo-carousel><section aria-label="Intro">a</section><section>b</section></xo-carousel>';
    await new Promise((r) => setTimeout(r, 0));
    expect([...document.querySelectorAll('section')].map((s) => s.getAttribute('aria-label'))).toEqual(['Intro', '2 of 2']);
  });

  it('next, previous and goTo move the index, update the counter, the dots and the disabled state, and fire xo-carousel-change', async () => {
    const el = await mountCarousel('dots counter');
    const seen = [];
    el.addEventListener('xo-carousel-change', (e) => seen.push(e.detail));
    expect(q('.xo-carousel-count').textContent).toBe('1 / 5');
    expect(dots().map((d) => d.getAttribute('aria-current'))).toEqual(['true', 'false', 'false', 'false', 'false']);
    q('.xo-carousel-next').click();
    expect(el.index).toBe(1);
    expect(q('.xo-carousel-count').textContent).toBe('2 / 5');
    expect(q('.xo-carousel-prev').disabled).toBe(false);
    dots()[4].click();
    expect(el.index).toBe(4);
    expect(q('.xo-carousel-next').disabled).toBe(true);
    expect(dots()[4].getAttribute('aria-current')).toBe('true');
    q('.xo-carousel-prev').click();
    el.goTo(0);
    el.goTo(99); // clamped
    expect(el.index).toBe(4);
    expect(seen).toEqual([{ index: 1, count: 5 }, { index: 4, count: 5 }, { index: 3, count: 5 }, { index: 0, count: 5 }, { index: 4, count: 5 }]);
  });

  it('loop: Next at the end returns to the first slide and the buttons stay enabled', async () => {
    const el = await mountCarousel('loop');
    el.goTo(4);
    expect(q('.xo-carousel-next').disabled).toBe(false);
    q('.xo-carousel-next').click();
    expect(el.index).toBe(0);
    q('.xo-carousel-prev').click();
    expect(el.index).toBe(4);
  });

  it('no-arrows hides the arrows; a single slide has nothing to move through', async () => {
    await mountCarousel('no-arrows');
    expect(q('.xo-carousel-prev').hidden && q('.xo-carousel-next').hidden).toBe(true);
    await mountCarousel('dots', 1);
    expect(q('.xo-carousel-next').hidden).toBe(true);
    expect(q('.xo-carousel-dots').hidden).toBe(true);
  });

  it('a slide with data-thumb shows that picture in its dot; the dot is still a labelled button', async () => {
    await mountCarousel('dots');
    expect(dots()[2].classList.contains('xo-carousel-thumb')).toBe(true);
    expect(dots()[2].querySelector('img').getAttribute('src')).toBe('/t2.png');
    expect(dots()[2].getAttribute('aria-label')).toBe('Go to slide 3');
  });

  it('items sets the number visible through --xo-carousel-items (the CSS object model), and clearing it falls back to the CSS default', async () => {
    const el = await mountCarousel('items="3"');
    expect(el.style.getPropertyValue('--xo-carousel-items')).toBe('3');
    el.removeAttribute('items');
    expect(el.style.getPropertyValue('--xo-carousel-items')).toBe('');
  });

  it('keys on the scroll area: arrows move, Home and End jump; keys inside a slide are left alone', async () => {
    const el = await mountCarousel('', 5, '');
    const key = (target, k) => { const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); target.dispatchEvent(e); return e; };
    expect(key(q('.xo-carousel-track'), 'ArrowRight').defaultPrevented).toBe(true);
    expect(el.index).toBe(1);
    key(q('.xo-carousel-track'), 'End');
    expect(el.index).toBe(4);
    key(q('.xo-carousel-track'), 'ArrowLeft');
    key(q('.xo-carousel-track'), 'Home');
    expect(el.index).toBe(0);
    expect(key(slides()[0], 'ArrowRight').defaultPrevented).toBe(false);
    expect(key(q('.xo-carousel-track'), 'x').defaultPrevented).toBe(false);
  });

  it('autoplay: moves on by itself, wraps around, pauses on hover and focus, stops with the pause button, and is polite only when still', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<xo-carousel label="News" autoplay="1000">${'<p>x</p>'.repeat(3)}</xo-carousel>`;
    await vi.advanceTimersByTimeAsync(0);
    const el = q('xo-carousel');
    expect(q('.xo-carousel-toggle').hidden).toBe(false);
    expect(q('.xo-carousel-toggle').getAttribute('aria-label')).toBe('Pause automatic slide show');
    expect(q('.xo-carousel-track').getAttribute('aria-live')).toBe('off'); // not announced while it moves by itself
    await vi.advanceTimersByTimeAsync(1000);
    expect(el.index).toBe(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(el.index).toBe(0); // 1 -> 2 -> back to 0
    el.dispatchEvent(new Event('pointerenter'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(el.index).toBe(0); // held by the pointer
    el.dispatchEvent(new Event('pointerleave'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(el.index).toBe(1);
    q('.xo-carousel-toggle').click();
    expect(q('.xo-carousel-toggle').getAttribute('aria-label')).toBe('Start automatic slide show');
    expect(q('.xo-carousel-track').getAttribute('aria-live')).toBe('polite');
    await vi.advanceTimersByTimeAsync(5000);
    expect(el.index).toBe(1); // stopped
    q('.xo-carousel-toggle').click();
    await vi.advanceTimersByTimeAsync(1000);
    expect(el.index).toBe(2);
  });

  it('autoplay does not run under prefers-reduced-motion', async () => {
    vi.useFakeTimers();
    const original = globalThis.matchMedia;
    globalThis.matchMedia = (query) => ({ matches: /reduce/.test(query), addEventListener() {}, removeEventListener() {} });
    try {
      document.body.innerHTML = `<xo-carousel autoplay="500">${'<p>x</p>'.repeat(3)}</xo-carousel>`;
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(3000);
      expect(q('xo-carousel').index).toBe(0);
    } finally { globalThis.matchMedia = original; }
  });

  it('follows its children: slides added later (data arriving) are labelled and counted, and a slide put straight into the element joins the track', async () => {
    const el = await mountCarousel('counter', 2);
    expect(q('.xo-carousel-count').textContent).toBe('1 / 2');
    const late = document.createElement('article');
    el.append(late);
    q('.xo-carousel-track').append(document.createElement('article'));
    await new Promise((r) => setTimeout(r, 0));
    expect(slides().length).toBe(4);
    expect(q('.xo-carousel-count').textContent).toBe('1 / 4');
    expect(slides()[3].getAttribute('aria-label')).toBe('4 of 4');
    expect(late.parentElement).toBe(q('.xo-carousel-track'));
  });

  it('a label or counter set after the element is built is applied', async () => {
    const el = await mountCarousel('', 3);
    el.setAttribute('label', 'Gallery');
    el.setAttribute('counter', '');
    expect(el.getAttribute('aria-label')).toBe('Gallery');
    expect(q('.xo-carousel-count').hidden).toBe(false);
  });

  it('a copy of a carousel that was already built (a view clones its content) is built again, not nested', async () => {
    const built = await mountCarousel('counter', 3);
    const copy = built.cloneNode(true);
    document.body.innerHTML = '';
    document.body.append(copy);
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelectorAll('.xo-carousel-track').length).toBe(1);
    expect(document.querySelectorAll('.xo-carousel-controls').length).toBe(1);
    expect(slides().length).toBe(3);
    expect(q('.xo-carousel-count').textContent).toBe('1 / 3');
  });
});
