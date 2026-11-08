// @ts-check
/**
 * <xo-copy> shows a read-only value (an API key, a link) with a Copy button.
 *
 *   <xo-copy value="xo_live_4f9a7f3a" label="API key"></xo-copy>
 *
 * - The button says "Copy", then "Copied" for 1.6 s (`data-state="copied"`, announced politely); the `copied` event fires with the text.
 *   When the browser refuses the clipboard the text in the field is selected so Ctrl/Cmd+C works, and `copy-failed` fires.
 */
import { XoControl, define, text } from '@xoong/core';

class XoCopy extends XoControl {
  static props = { ...XoControl.props, label: String };

  /** @type {HTMLInputElement | null} */ #input = null;
  /** @type {HTMLButtonElement | null} */ #button = null;
  /** @type {ReturnType<typeof setTimeout> | undefined} */ #timer;

  setValue(v) { super.setValue(v == null ? '' : String(v)); if (this.#input) this.#input.value = super.value; }
  get focusTarget() { return this.#button; }

  connected() {
    const wrap = document.createElement('div');
    wrap.className = 'xo-copyfield';
    const input = document.createElement('input');
    input.readOnly = true;
    input.setAttribute('aria-label', this.label || this.name || text('xoong.controls.value', 'Value'));
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-live', 'polite');
    button.addEventListener('click', () => this.#copy());
    wrap.append(input, button);
    this.#input = input; this.#button = button;
    this.replaceChildren(wrap);
    queueMicrotask(() => { input.value = super.value; this.#paint(false); });
  }
  disconnected() { clearTimeout(this.#timer); }

  async #copy() {
    const value = String(super.value);
    try {
      await navigator.clipboard.writeText(value);
      this.#paint(true);
      this.dispatchEvent(new CustomEvent('copied', { bubbles: true, detail: { text: value } }));
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => this.#paint(false), 1600);
    } catch {
      this.#input?.select();
      this.dispatchEvent(new CustomEvent('copy-failed', { bubbles: true, detail: { text: value } }));
    }
  }
  #paint(done) {
    const b = this.#button;
    if (!b) return;
    b.innerHTML = `<span class="ic" data-ic="${done ? 'check' : 'copy'}" aria-hidden="true"></span>`;
    b.append(done ? text('xoong.controls.copied', 'Copied') : text('xoong.controls.copy', 'Copy'));
    if (done) b.dataset.state = 'copied'; else delete b.dataset.state;
  }
}
define('xo-copy', XoCopy);
