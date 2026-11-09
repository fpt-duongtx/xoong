// Right-to-left pages (Arabic, Hebrew): the first tab, segment, digit box and day of the week sit on the right, so ArrowRight goes to the
// previous one and ArrowLeft to the next, as on screen. (happy-dom does not turn the `dir` attribute into a computed direction, so these use
// `direction: rtl`, which every browser also honours; a real-browser run with `dir="rtl"` is in the browser checks.)
import { describe, it, expect, afterEach } from 'vitest';
import '@xoong/controls';

const wait = () => new Promise((r) => setTimeout(r, 0));
const mount = async (html, rtl) => { document.body.innerHTML = `<div style="direction: ${rtl ? 'rtl' : 'ltr'}">${html}</div>`; await wait(); };
const press = (el, k) => { const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); el.dispatchEvent(e); return e; };
afterEach(() => { document.body.innerHTML = ''; });

describe.each([[false, 'ArrowRight', 'ArrowLeft'], [true, 'ArrowLeft', 'ArrowRight']])('rtl=%s: %s goes to the next, %s to the previous', (rtl, next, prev) => {
  it('<xo-tabs>, wrapping at both ends', async () => {
    await mount('<xo-tabs label="A"><section xo-tab="One">1</section><section xo-tab="Two">2</section><section xo-tab="Three">3</section></xo-tabs>', rtl);
    const tabs = () => [...document.querySelectorAll('[role=tab]')];
    press(tabs()[0], next);
    expect(document.activeElement).toBe(tabs()[1]);
    press(tabs()[1], next);
    press(tabs()[2], next);
    expect(document.activeElement).toBe(tabs()[0]); // wrapped
    press(tabs()[0], prev);
    expect(document.activeElement).toBe(tabs()[2]);
    press(tabs()[2], 'Home');
    expect(document.activeElement).toBe(tabs()[0]); // Home and End stay logical
    press(tabs()[0], 'End');
    expect(document.activeElement).toBe(tabs()[2]);
  });

  it('<xo-segmented>', async () => {
    await mount('<xo-segmented label="B" value="a"><button value="a">A</button><button value="b">B</button><button value="c">C</button></xo-segmented>', rtl);
    const b = [...document.querySelectorAll('xo-segmented button')];
    b[0].focus();
    press(b[0], next);
    expect(document.activeElement).toBe(b[1]);
    press(b[1], 'ArrowDown'); // up and down are not mirrored
    expect(document.activeElement).toBe(b[2]);
    press(b[2], prev);
    expect(document.activeElement).toBe(b[1]);
  });

  it('<xo-otp>', async () => {
    await mount('<xo-otp label="Code" length="4"></xo-otp>', rtl);
    const b = [...document.querySelectorAll('xo-otp input')];
    b[1].focus();
    press(b[1], next);
    expect(document.activeElement).toBe(b[2]);
    press(b[2], prev);
    press(b[1], prev);
    expect(document.activeElement).toBe(b[0]);
  });

  it('<xo-date>: the arrows move by day as on screen, up and down by week', async () => {
    await mount('<xo-date label="D" value="2026-11-12"></xo-date>', rtl);
    document.querySelector('.xo-date-open').click();
    press(document.activeElement, next);
    expect(document.activeElement.dataset.date).toBe('2026-11-13');
    press(document.activeElement, prev);
    press(document.activeElement, prev);
    expect(document.activeElement.dataset.date).toBe('2026-11-11');
    press(document.activeElement, 'ArrowDown');
    expect(document.activeElement.dataset.date).toBe('2026-11-18');
  });
});
