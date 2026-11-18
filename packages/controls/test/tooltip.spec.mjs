import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { tooltip } from '@xoong/controls';

const tip = () => document.querySelector('[role=tooltip]');
const key = (k = 'Tab') => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
const focusin = (el) => { key(); el.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); }; // focus that comes from the keyboard
const focusout = (el) => el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
const over = (el, related = null) => el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: related }));
const out = (el, related = null) => el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: related }));

let clock = 1_800_000_000_000;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime((clock += 60_000)); // each test starts outside the "just closed" window of the one before
  document.body.innerHTML = '<button id="a" xo-tooltip="Save the draft">Save</button><button id="b" xo-tooltip="Delete">x</button><p id="plain">plain</p>';
  tooltip.delay = 400;
});
afterEach(() => { document.dispatchEvent(new Event('pointerdown', { bubbles: true })); vi.useRealTimers(); document.body.innerHTML = ''; });

describe('xo-tooltip', () => {
  it('shows after a delay on hover and describes the element while shown', () => {
    const a = document.querySelector('#a');
    over(a);
    expect(tip()).toBeNull(); // not yet
    vi.advanceTimersByTime(450);
    expect(tip().hidden).toBe(false);
    expect(tip().textContent).toBe('Save the draft');
    expect(a.getAttribute('aria-describedby')).toBe(tip().id);
    out(a);
    expect(tip().hidden).toBe(true);
    expect(a.hasAttribute('aria-describedby')).toBe(false);
  });

  it('leaving before the delay shows nothing', () => {
    const a = document.querySelector('#a');
    over(a);
    vi.advanceTimersByTime(200);
    out(a);
    vi.advanceTimersByTime(500);
    expect(tip()).toBeNull();
  });

  it('keyboard focus shows it at once, blur hides it, and Escape or a press dismisses it', () => {
    const a = document.querySelector('#a');
    focusin(a);
    expect(tip().hidden).toBe(false);
    focusout(a);
    expect(tip().hidden).toBe(true);
    focusin(a);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(tip().hidden).toBe(true);
    focusin(document.querySelector('#b'));
    expect(tip().textContent).toBe('Delete'); // one shared element
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(tip().hidden).toBe(true);
    expect(document.querySelectorAll('[role=tooltip]').length).toBe(1);
  });

  it('the pointer may move onto the tooltip without closing it, and leaving the tooltip closes it', () => {
    const a = document.querySelector('#a');
    over(a);
    vi.advanceTimersByTime(450);
    out(a, tip());
    expect(tip().hidden).toBe(false);
    tip().dispatchEvent(new Event('pointerleave'));
    expect(tip().hidden).toBe(true);
  });

  it('elements without xo-tooltip are ignored, and moving inside the element keeps it shown', () => {
    over(document.querySelector('#plain'));
    vi.advanceTimersByTime(500);
    expect(tip()).toBeNull();
    const a = document.querySelector('#a');
    over(a);
    vi.advanceTimersByTime(450);
    out(a, a.firstChild ? a : a);
    expect(tip().hidden).toBe(false);
  });

  it('the delay is configurable: a default in script, an attribute on the element or on any ancestor, 0 for at once', () => {
    const a = document.querySelector('#a');
    tooltip.delay = 900;
    over(a);
    vi.advanceTimersByTime(800);
    expect(tip()).toBeNull();
    vi.advanceTimersByTime(150);
    expect(tip().hidden).toBe(false);
    out(a);
    tooltip.delay = 400;
    vi.advanceTimersByTime(1000); // outside the skip window, so the next hover waits again
    document.body.setAttribute('xo-tooltip-delay', '1200');
    over(a);
    vi.advanceTimersByTime(1100);
    expect(tip().hidden).toBe(true);
    vi.advanceTimersByTime(150);
    expect(tip().hidden).toBe(false);
    out(a);
    vi.advanceTimersByTime(1000);
    a.setAttribute('xo-tooltip-delay', '0'); // the element beats its ancestor
    over(a);
    expect(tip().hidden).toBe(false);
    document.body.removeAttribute('xo-tooltip-delay');
  });

  it('a hover right after a tooltip closed shows the next one at once (a toolbar does not wait on every button)', () => {
    const a = document.querySelector('#a');
    const b = document.querySelector('#b');
    over(a);
    vi.advanceTimersByTime(450);
    out(a);
    over(b);
    expect(tip().hidden).toBe(false);
    expect(tip().textContent).toBe('Delete');
  });

  it('focus that follows a click or a tap does not show it; keyboard focus does again after a key', () => {
    const a = document.querySelector('#a');
    a.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    a.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(tip()?.hidden ?? true).toBe(true);
    focusin(a); // a key was pressed first
    expect(tip().hidden).toBe(false);
  });

  it('touch has no hover: the mouseover a tap makes is ignored', () => {
    const a = document.querySelector('#a');
    const down = new Event('pointerdown', { bubbles: true });
    Object.defineProperty(down, 'pointerType', { value: 'touch' });
    a.dispatchEvent(down);
    over(a);
    vi.advanceTimersByTime(1000);
    expect(tip()?.hidden ?? true).toBe(true);
    const move = new Event('pointerover', { bubbles: true });
    Object.defineProperty(move, 'pointerType', { value: 'mouse' });
    a.dispatchEvent(move);
    over(a);
    vi.advanceTimersByTime(450);
    expect(tip().hidden).toBe(false);
  });

  it("aria-describedby keeps the author's ids and only our id comes and goes", () => {
    const a = document.querySelector('#a');
    a.setAttribute('aria-describedby', 'hint');
    focusin(a);
    expect(a.getAttribute('aria-describedby')).toBe(`hint ${tip().id}`);
    focusout(a);
    expect(a.getAttribute('aria-describedby')).toBe('hint');
  });

  it('the first Escape closes the tooltip and is not passed on (the dialog or menu around it stays open)', () => {
    const a = document.querySelector('#a');
    focusin(a);
    const first = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(first);
    expect(tip().hidden).toBe(true);
    expect(first.defaultPrevented).toBe(true);
    const second = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(second);
    expect(second.defaultPrevented).toBe(false); // nothing to close: the page's own Escape handling runs
  });

  it('closes when its element is removed, disabled or loses its text, and follows a changed text', async () => {
    vi.useRealTimers();
    const a = document.querySelector('#a');
    focusin(a);
    a.setAttribute('xo-tooltip', 'Save now');
    await new Promise((r) => setTimeout(r, 0));
    expect(tip().textContent).toBe('Save now');
    a.remove();
    await new Promise((r) => setTimeout(r, 0));
    expect(tip().hidden).toBe(true);
  });

  it('an element inside an open dialog gets the tip inside that dialog, any other element gets it back in the body', () => {
    document.body.insertAdjacentHTML('beforeend', '<dialog open id="dlg"><button id="in" xo-tooltip="Inside">in</button></dialog>');
    const dlg = document.querySelector('#dlg');
    focusin(document.querySelector('#in'));
    expect(tip().parentElement).toBe(dlg);
    focusout(document.querySelector('#in'));
    focusin(document.querySelector('#a'));
    expect(tip().parentElement).toBe(document.body);
  });
});
