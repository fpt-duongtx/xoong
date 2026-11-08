import { describe, it, expect, afterEach } from 'vitest';
import '@xoong/controls';
import '../src/steps.js';

const mount = async (html) => { document.body.innerHTML = html; await new Promise((r) => setTimeout(r, 0)); return document.body.firstElementChild; };
afterEach(() => { document.body.innerHTML = ''; });

describe('<xo-steps>', () => {
  it('draws steps and lines from its children; the current one has aria-current and earlier ones a check', async () => {
    const el = await mount('<xo-steps current="1"><span>Account</span><span>Plan</span><span>Done</span></xo-steps>');
    const root = el.querySelector('.xo-steps');
    expect(root.getAttribute('role')).toBe('list');
    const steps = [...root.querySelectorAll('.xo-step')];
    expect(steps.length).toBe(3);
    expect(root.querySelectorAll('.xo-steps__line').length).toBe(2);
    expect(steps.map((s) => s.classList.contains('xo-step--done'))).toEqual([true, false, false]);
    expect(steps.map((s) => s.getAttribute('aria-current'))).toEqual([null, 'step', null]);
    expect(steps[0].querySelector('.ic[data-ic=check]')).toBeTruthy();
    expect(steps[0].querySelector('.xo-step__n').getAttribute('aria-label')).toBe('Completed');
    expect(steps[1].querySelector('.xo-step__n').textContent).toBe('2');
    expect(steps[1].querySelector('.xo-step__n').classList.contains('is-current')).toBe(true);
    expect(steps[1].querySelector('b').textContent).toBe('Plan');
    expect(steps[2].querySelector('.muted').textContent).toBe('Done');
    expect([...root.querySelectorAll('.xo-steps__line')].map((l) => l.classList.contains('xo-steps__line--done'))).toEqual([true, false]);
  });
  it('reads li and [data-step] children, and follows current', async () => {
    const el = await mount('<xo-steps><ol><li>Choose</li><li>Details</li></ol></xo-steps>');
    expect(el.querySelectorAll('.xo-step').length).toBe(2);
    expect(el.querySelector('[aria-current=step]').textContent).toContain('Choose');
    el.setAttribute('current', '2');
    expect(el.querySelector('[aria-current]')).toBe(null);
    expect(el.querySelectorAll('.xo-step--done').length).toBe(2);
    const d = await mount('<xo-steps current="0"><div data-step>One</div><div data-step>Two</div></xo-steps>');
    expect([...d.querySelectorAll('.xo-step')].map((s) => s.textContent)).toEqual(['1One', '2Two']);
  });
});
