import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import '@xoong/controls';

const tip = () => document.querySelector('[role=tooltip]');
const focusin = (el) => el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
const focusout = (el) => el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
const over = (el, related = null) => el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: related }));
const out = (el, related = null) => el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: related }));

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<button id="a" xo-tooltip="Save the draft">Save</button><button id="b" xo-tooltip="Delete">x</button><p id="plain">plain</p>';
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
});
