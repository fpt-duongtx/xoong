// @ts-check
/**
 * <xo-inline-edit> is a piece of text (a title, a name) that the person can rename in place.
 *
 *   <xo-inline-edit name="title" value="Greece Golden Visa" label="Rename"></xo-inline-edit>
 *
 * - At rest it draws `.xo-inline-edit` with the text and a ghost icon button (a pencil) named by `label` ("Rename" by default). A click on the
 *   text or on the button starts editing: the text is replaced by an input (named by `label`), focused with everything selected.
 * - Enter saves, Escape cancels, leaving the input (blur) saves. Focus goes back to the button after Enter and Escape.
 *   An empty text cancels (the old value stays). The text is trimmed.
 * - `value` is the string. When the person saves a changed text: `input`, `change` and `save` (detail `{ value }`) fire. `cancel` fires when
 *   editing is abandoned (Escape, or an empty text). Saving an unchanged text just closes the editor with no event.
 * - `edit()` starts editing from code. `disabled` and `readonly` hide the pencil's action: the text is shown and nothing can be edited.
 */
import { XoControl, define, text } from '@xoong/core';

class XoInlineEdit extends XoControl {
  static props = { ...XoControl.props, label: String };

  /** @type {HTMLElement | null} */ #root = null;
  /** @type {HTMLElement | null} */ #text = null;
  /** @type {HTMLButtonElement | null} */ #button = null;
  /** @type {HTMLInputElement | null} */ #input = null;

  setValue(v) { super.setValue(v == null ? '' : String(v)); this.#paintText(); }
  reset() { super.reset(); this.#paintText(); }
  get focusTarget() { return this.#input ?? this.#button; }
  /** True while the input is shown. */
  get editing() { return !!this.#input; }

  connected() {
    const root = document.createElement('span');
    root.className = 'xo-inline-edit';
    const label = document.createElement('span');
    label.className = 'xo-inline-edit__text';
    label.addEventListener('click', () => this.edit());
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ghost icon-only sm';
    button.innerHTML = '<span class="ic" data-ic="edit" aria-hidden="true"></span>';
    button.addEventListener('click', () => this.edit());
    root.append(label, button);
    this.#root = root; this.#text = label; this.#button = button;
    this.replaceChildren(root);
    queueMicrotask(() => this.#paintText());
  }

  attributeChangedCallback(attr, old, value) { super.attributeChangedCallback(attr, old, value); this.#paintText(); }

  /** Start editing: an input replaces the text, focused with the text selected. */
  edit() {
    const root = this.#root, label = this.#text, button = this.#button;
    if (!root || !label || !button || this.#input || this.isDisabled || this.readonly) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = String(super.value);
    input.setAttribute('aria-label', this.label || text('xoong.inlineEdit.rename', 'Rename'));
    input.addEventListener('input', (e) => e.stopPropagation());
    input.addEventListener('change', (e) => e.stopPropagation());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.#finish(true, true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.#finish(false, true); }
    });
    input.addEventListener('blur', () => this.#finish(true, false));
    this.#input = input;
    root.replaceChildren(input); // removed rather than hidden: a button's own display rule would beat [hidden]
    input.focus();
    input.select();
  }

  /** @param {boolean} save @param {boolean} refocus */
  #finish(save, refocus) {
    const input = this.#input, label = this.#text, button = this.#button;
    if (!input || !label || !button) return;
    this.#input = null; // first: removing the focused input may fire blur
    const next = input.value.trim();
    this.#root?.replaceChildren(label, button);
    if (save && next !== '') {
      if (next !== super.value) {
        this.userInput(next);
        this.userChange();
        this.emit('save', { value: next });
      }
    } else this.emit('cancel', {});
    this.#paintText();
    if (refocus) button.focus();
  }

  #paintText() {
    const label = this.#text, button = this.#button;
    if (!label || !button) return;
    label.textContent = String(super.value);
    const name = this.label || text('xoong.inlineEdit.rename', 'Rename');
    button.setAttribute('aria-label', name);
    button.title = name;
    button.disabled = this.isDisabled || this.readonly;
  }
}
define('xo-inline-edit', XoInlineEdit);
