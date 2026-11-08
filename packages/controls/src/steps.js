// @ts-check
/**
 * <xo-steps> shows where the person is in a flow of a few steps.
 *
 *   <xo-steps current="1"><span>Account</span><span>Plan</span><span>Done</span></xo-steps>
 *   <xo-steps current="0"><ol><li>Choose</li><li>Details</li><li>Insert</li></ol></xo-steps>
 *
 * - The children are the data: each `li`, `[data-step]` or (when there are none of those) each child element is one step and its text is the title.
 *   The element replaces them with `.xo-steps > .xo-step(--done) + .xo-steps__line(--done) + ...`.
 * - `current` is the zero-based index of the step being worked on (0 by default). Steps before it are done: a check mark in the circle (named
 *   "Completed"), never colour alone, and the line before the current step is filled. The current step has `aria-current="step"`, its circle is
 *   marked (`is-current`) and its title is bold. A `current` equal to the number of steps (or more) marks everything done; no step is current.
 * - The container is a `role=list` of `role=listitem` steps. It is display only: nothing is clickable and there is no value.
 */
import { XoElement, define, text } from '@xoong/core';

class XoSteps extends XoElement {
  static props = { current: Number, label: String };

  /** @type {string[] | null} */ #titles = null;
  #built = false;

  connected() { void this.ready().then(() => this.#read()); }

  #read() {
    if (this.#built || !this.isConnected) return;
    this.#built = true;
    let items = [...this.querySelectorAll('li,[data-step]')];
    if (!items.length) items = [...this.children];
    this.#titles = items.map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    this.#paint();
  }

  attributeChangedCallback(attr, old, value) { super.attributeChangedCallback(attr, old, value); this.#paint(); }

  #paint() {
    const titles = this.#titles;
    if (!titles) return;
    const current = Math.floor(this.current) || 0;
    const root = document.createElement('div');
    root.className = 'xo-steps';
    root.setAttribute('role', 'list');
    if (this.label) root.setAttribute('aria-label', this.label);
    titles.forEach((title, i) => {
      const done = i < current;
      const here = i === current;
      if (i > 0) {
        const line = document.createElement('span');
        line.className = 'xo-steps__line' + (i <= current ? ' xo-steps__line--done' : '');
        line.setAttribute('aria-hidden', 'true');
        root.append(line);
      }
      const step = document.createElement('span');
      step.className = 'xo-step' + (done ? ' xo-step--done' : '');
      step.setAttribute('role', 'listitem');
      if (here) step.setAttribute('aria-current', 'step');
      const n = document.createElement('span');
      n.className = 'xo-step__n' + (here ? ' is-current' : '');
      if (done) {
        n.setAttribute('role', 'img');
        n.setAttribute('aria-label', text('xoong.steps.done', 'Completed'));
        n.innerHTML = '<span class="ic" data-ic="check" aria-hidden="true"></span>';
      } else n.textContent = String(i + 1);
      const name = document.createElement(here ? 'b' : 'span');
      if (!done && !here) name.className = 'muted';
      name.textContent = title;
      step.append(n, name);
      root.append(step);
    });
    this.replaceChildren(root);
  }
}
define('xo-steps', XoSteps);
