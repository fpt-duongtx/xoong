import { describe, it, expect, afterEach } from 'vitest';
import '@xoong/controls';
import '../src/progress.js';

const mount = async (html) => { document.body.innerHTML = html; await new Promise((r) => setTimeout(r, 0)); return document.body.firstElementChild; };
afterEach(() => { document.body.innerHTML = ''; });

describe('<xo-progress>', () => {
  it('draws a progressbar with now, min, max and a name; the width is set through the CSS object model', async () => {
    const el = await mount('<xo-progress value="45" label="Upload"></xo-progress>');
    const bar = el.querySelector('.xo-progress');
    expect(bar.getAttribute('role')).toBe('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('45');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-label')).toBe('Upload');
    expect(bar.querySelector('i').style.width).toBe('45%');
    expect(bar.querySelector('i').getAttribute('style')).toBe('width: 45%;'); // CSSOM output; a template style attribute is not used
  });
  it('max scales, values are clamped, thin adds the modifier, updates follow attribute and property', async () => {
    const el = await mount('<xo-progress value="30" max="50" thin></xo-progress>');
    const bar = el.querySelector('.xo-progress');
    expect(bar.classList.contains('xo-progress--thin')).toBe(true);
    expect(bar.getAttribute('aria-valuemax')).toBe('50');
    expect(bar.querySelector('i').style.width).toBe('60%');
    el.setAttribute('value', '999');
    expect(bar.getAttribute('aria-valuenow')).toBe('50');
    expect(bar.querySelector('i').style.width).toBe('100%');
    el.value = 10;
    expect(bar.getAttribute('aria-valuenow')).toBe('10');
    expect(el.value).toBe(10);
    el.setAttribute('value', '-5');
    expect(bar.getAttribute('aria-valuenow')).toBe('0');
    expect(bar.getAttribute('aria-label')).toBe('Progress');
  });
  it('without a value it is indeterminate: no aria-valuenow', async () => {
    const el = await mount('<xo-progress label="Importing"></xo-progress>');
    const bar = el.querySelector('.xo-progress');
    expect(bar.hasAttribute('aria-valuenow')).toBe(false);
    expect(el.dataset.state).toBe('indeterminate');
    expect(el.value).toBe(null);
    el.setAttribute('value', '0');
    expect(bar.getAttribute('aria-valuenow')).toBe('0');
    el.value = null;
    expect(bar.hasAttribute('aria-valuenow')).toBe(false);
  });
});

describe('<xo-spinner>', () => {
  it('is a status with a name; size picks the class', async () => {
    const el = await mount('<xo-spinner></xo-spinner>');
    const s = el.querySelector('.xo-spinner');
    expect(s.getAttribute('role')).toBe('status');
    expect(s.getAttribute('aria-label')).toBe('Loading');
    el.setAttribute('label', 'Saving'); el.setAttribute('size', 'lg');
    expect(s.getAttribute('aria-label')).toBe('Saving');
    expect(s.classList.contains('xo-spinner--lg')).toBe(true);
    el.setAttribute('size', 'md');
    expect(s.classList.contains('xo-spinner--md')).toBe(true);
    expect(s.classList.contains('xo-spinner--lg')).toBe(false);
  });
  it('an empty label makes it decorative', async () => {
    const el = await mount('<xo-spinner label=""></xo-spinner>');
    const s = el.querySelector('.xo-spinner');
    expect(s.hasAttribute('role')).toBe(false);
    expect(s.getAttribute('aria-hidden')).toBe('true');
  });
});
