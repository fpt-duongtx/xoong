import { describe, it, expect, afterEach } from 'vitest';
import '@xoong/controls';

const mount = async (attrs = '') => {
  document.body.innerHTML = `<form><xo-date name="d" label="Publish on" week-start="1" ${attrs}></xo-date></form>`;
  await new Promise((r) => setTimeout(r, 0));
  return document.querySelector('xo-date');
};
const day = (s) => document.querySelector(`button[data-date="${s}"]`);
afterEach(() => { document.body.innerHTML = ''; });

describe('<xo-date>', () => {
  it('shows the value in the field and opens a named dialog with the month', async () => {
    const el = await mount('value="2026-11-12"');
    const input = el.querySelector('input');
    expect(input.value).toMatch(/12/);
    expect(el.value).toBe('2026-11-12');
    el.querySelector('.xo-date-open').click();
    const panel = el.querySelector('[role=dialog]');
    expect(panel.getAttribute('aria-label')).toBe('Choose date');
    expect(day('2026-11-12').getAttribute('aria-pressed')).toBe('true');
    expect(panel.querySelectorAll('.xo-calendar button').length).toBe(42);
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });
  it('a click on a day chooses it, fires input and change, and closes', async () => {
    const el = await mount('value="2026-11-12"');
    const seen = [];
    el.addEventListener('input', () => seen.push('input'));
    el.addEventListener('change', () => seen.push('change'));
    el.querySelector('.xo-date-open').click();
    day('2026-11-20').click();
    expect(el.value).toBe('2026-11-20');
    expect(seen).toEqual(['input', 'change']);
    expect(el.querySelector('input').getAttribute('aria-expanded')).toBe('false');
    expect(el.dirty).toBe(true);
  });
  it('keys move the focus: arrows by day and week, PageDown by month, Home/End within the week, Escape closes', async () => {
    const el = await mount('value="2026-11-12"');
    el.querySelector('.xo-date-open').click();
    const press = (k) => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    press('ArrowRight'); expect(document.activeElement.dataset.date).toBe('2026-11-13');
    press('ArrowDown'); expect(document.activeElement.dataset.date).toBe('2026-11-20');
    press('PageDown'); expect(document.activeElement.dataset.date).toBe('2026-12-20');
    press('Home'); expect(document.activeElement.dataset.date).toBe('2026-12-14'); // Monday
    press('End'); expect(document.activeElement.dataset.date).toBe('2026-12-20'); // Sunday
    press('Escape');
    expect(el.querySelector('input').getAttribute('aria-expanded')).toBe('false');
  });
  it('typing ISO or a locale date sets the value; nonsense keeps the old one', async () => {
    const el = await mount('value="2026-11-12"');
    const input = el.querySelector('input');
    input.value = '2026-12-01'; input.dispatchEvent(new Event('change'));
    expect(el.value).toBe('2026-12-01');
    input.value = 'tomorrow'; input.dispatchEvent(new Event('change'));
    expect(el.value).toBe('2026-12-01');
    input.value = ''; input.dispatchEvent(new Event('change'));
    expect(el.value).toBe('');
  });
  it('min and max disable days and make the value invalid', async () => {
    const el = await mount('value="2026-11-12" min="2026-11-10" max="2026-11-15"');
    el.querySelector('.xo-date-open').click();
    expect(day('2026-11-09').disabled).toBe(true);
    expect(day('2026-11-16').disabled).toBe(true);
    expect(day('2026-11-11').disabled).toBe(false);
    el.setValue('2026-12-01');
    expect(el.valid).toBe(false);
  });
  it('a range takes two clicks, shows its length, and Apply commits', async () => {
    const el = await mount('range');
    el.querySelector('.xo-date-open').click();
    const m = document.querySelector('.xo-calendar button:not(.is-out)').dataset.date.slice(0, 8);
    day(`${m}16`).click();
    day(`${m}12`).click(); // before the start: swapped
    expect(el.querySelector('.cal-foot .hint').textContent).toMatch(/5/);
    expect(day(`${m}14`).classList.contains('is-range')).toBe(true);
    [...el.querySelectorAll('.cal-foot button')].find((b) => b.textContent === 'Apply').click();
    expect(el.value).toEqual({ start: `${m}12`, end: `${m}16` });
    expect(el.serialize(el.value)).toBe(JSON.stringify({ start: `${m}12`, end: `${m}16` }));
  });
  it('required: empty is invalid; disabled blocks opening', async () => {
    const el = await mount('required');
    expect(el.valid).toBe(false);
    const d = await mount('disabled');
    expect(d.querySelector('.xo-date-open').disabled).toBe(true);
  });
});
