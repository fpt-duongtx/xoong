import { describe, it, expect, afterEach } from 'vitest';
import '@xoong/controls';

const mount = async (attrs = '') => {
  document.body.innerHTML = `<form><xo-time name="t" label="Time" ${attrs}></xo-time></form>`;
  await new Promise((r) => setTimeout(r, 0));
  return document.querySelector('xo-time');
};
const pick = (sel, v) => { sel.value = v; sel.dispatchEvent(new Event('change', { bubbles: true })); };
afterEach(() => { document.body.innerHTML = ''; });

describe('<xo-time>', () => {
  it('two named selects show the value; step sets the minutes', async () => {
    const el = await mount('value="09:30" step="15"');
    const [h, m] = el.querySelectorAll('select');
    expect(h.getAttribute('aria-label')).toBe('Hour');
    expect(m.getAttribute('aria-label')).toBe('Minute');
    expect([h.value, m.value]).toEqual(['09', '30']);
    expect([...m.options].map((o) => o.value)).toEqual(['', '00', '15', '30', '45']);
  });
  it('choosing an hour on an empty field sets minutes to 00; events fire; clearing the hour empties', async () => {
    const el = await mount();
    const seen = [];
    el.addEventListener('input', () => seen.push('input'));
    el.addEventListener('change', () => seen.push('change'));
    const [h, m] = el.querySelectorAll('select');
    pick(h, '14');
    expect(el.value).toBe('14:00');
    expect(m.value).toBe('00');
    pick(m, '35');
    expect(el.value).toBe('14:35');
    expect(seen).toEqual(['input', 'change', 'input', 'change']);
    pick(h, '');
    expect(el.value).toBe('');
  });
  it('a value off the step is kept; min/max and required validate', async () => {
    const el = await mount('value="10:07" min="09:00" max="12:00" required');
    expect(el.querySelectorAll('select')[1].value).toBe('07');
    expect(el.valid).toBe(true);
    el.setValue('13:00');
    expect(el.valid).toBe(false);
    el.setValue('');
    expect(el.valid).toBe(false);
  });
});
