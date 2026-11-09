// @ts-check
/**
 * The built-in dialogs, one native modal <dialog> each, created on first use and removed when answered:
 *
 *   await confirm('Delete 3 items?', { kind: 'danger', ok: 'Delete' })   // true or false
 *   await alert('Saved', { kind: 'success' })                            // one button; resolves when closed
 *   await prompt('Name this view', { value: 'My view', required: true }) // the text, or null
 *   await ask('Save changes?', { buttons: [{ label: 'Discard', value: 'no' }, { label: 'Save', value: 'yes', primary: true }] })
 *
 * `kind` ('info', 'success', 'warning', 'danger') adds an icon and the matching colour; `title` adds a heading; `detail` a second, quieter line.
 * Escape and the Cancel button answer "no" (false, null, or the value of the button marked `cancel`). The focus starts on the safe choice (Cancel for
 * a question, OK for a notice, the field for a prompt). `confirm` replaces the browser's confirm() as soon as @xoong/ui is imported, so `xo-confirm="..."`
 * and the leave-page question of a dirty form use it too; `xo-confirm-title`, `xo-confirm-ok`, `xo-confirm-cancel` and `xo-confirm-kind` on the button tune that one.
 */
import { text } from '@xoong/core';

/** The button texts; replace them for another wording or language. */
import { confirmLabels as labels } from './dialogs-lazy.js';
export { labels };

const ICONS = {
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  success: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16 9.5"/>',
  warning: '<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2h.01"/>',
  danger: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
};
/** @param {string | undefined} kind */
const kindOf = (kind) => { const k = kind === 'error' ? 'danger' : kind; return k && k in ICONS ? /** @type {keyof typeof ICONS} */ (k) : undefined; };

/** @type {(() => void) | null} dismisses the dialog on screen: a new one answers it "no" first */
let dismissOpen = null;
let counter = 0;

/**
 * @typedef {{ label: string, value?: any, primary?: boolean, danger?: boolean, cancel?: boolean }} Choice
 * @typedef {{ title?: string, kind?: 'info' | 'success' | 'warning' | 'danger' | 'error', detail?: string }} Look
 */

/**
 * @param {{ message: string, buttons: Choice[], choices?: boolean, input?: { value?: string, label?: string, placeholder?: string, type?: string, required?: boolean, pattern?: string }, focus: number | 'input' } & Look} o
 * @returns {Promise<{ choice: Choice | null, value: string }>}
 */
function present(o) {
  dismissOpen?.();
  return new Promise((resolve) => {
    const id = `xo-dialog-${++counter}`;
    const kind = kindOf(o.kind);
    const d = document.createElement('dialog');
    d.className = 'xo-confirm';
    if (kind) d.dataset.kind = kind;
    if (o.choices) d.dataset.buttons = 'choices'; // the primary button is the accent: the kind colours the icon, not a "Save"
    d.setAttribute('role', 'alertdialog');
    d.setAttribute('aria-labelledby', o.title ? `${id}-t` : `${id}-m`);
    if (o.title) d.setAttribute('aria-describedby', `${id}-m`);
    const content = document.createElement('div');
    content.className = 'xo-confirm-content';
    if (o.title) { const h = document.createElement('h2'); h.id = `${id}-t`; h.className = 'xo-confirm-title'; h.textContent = o.title; content.append(h); }
    const message = document.createElement('p');
    message.id = `${id}-m`;
    message.textContent = o.message;
    content.append(message);
    if (o.detail) { const p = document.createElement('p'); p.className = 'xo-hint'; p.textContent = o.detail; content.append(p); }
    /** @type {HTMLInputElement | null} */ let field = null;
    if (o.input) {
      const label = document.createElement('label');
      label.className = 'xo-confirm-field';
      if (o.input.label) { const s = document.createElement('span'); s.textContent = o.input.label; label.append(s); }
      field = document.createElement('input');
      field.type = o.input.type ?? 'text';
      field.value = o.input.value ?? '';
      if (o.input.placeholder) field.placeholder = o.input.placeholder;
      if (o.input.pattern) field.pattern = o.input.pattern;
      field.required = !!o.input.required;
      if (!o.input.label) field.setAttribute('aria-label', o.message);
      label.append(field);
      content.append(label);
    }
    const row = document.createElement('div');
    row.className = 'xo-confirm-actions';
    /** @type {Choice | null} */ let answer = o.buttons.find((b) => b.cancel) ?? null;
    let value = '';
    const finish = () => { if (dismissOpen === dismiss) dismissOpen = null; d.remove(); resolve({ choice: answer, value }); };
    const close = () => { if (d.close) d.close(); else finish(); };
    const dismiss = () => { answer = o.buttons.find((b) => b.cancel) ?? null; close(); };
    const buttons = o.buttons.map((b) => {
      const el = document.createElement('button');
      el.type = b.primary && field ? 'submit' : 'button';
      el.textContent = b.label;
      if (b.primary) el.className = 'xo-confirm-ok';
      if (b.danger) el.classList.add('xo-confirm-danger');
      el.addEventListener('click', (event) => {
        if (el.type === 'submit') return; // the form's submit handler answers (after the field is checked)
        event.preventDefault();
        answer = b; value = field?.value ?? '';
        close();
      });
      row.append(el);
      return el;
    });
    const body2 = document.createElement('div');
    body2.className = 'xo-confirm-body';
    if (kind) {
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('class', 'xo-confirm-icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = ICONS[kind]; // a fixed string from this file
      body2.append(icon);
    }
    body2.append(content);
    if (field) {
      const form = document.createElement('form'); // Enter in the field submits
      form.noValidate = true;
      form.append(body2, row);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!form.checkValidity()) { field?.setAttribute('aria-invalid', 'true'); field?.reportValidity?.(); return; }
        answer = o.buttons.find((b) => b.primary) ?? null; value = field?.value ?? '';
        close();
      });
      field.addEventListener('input', () => field?.removeAttribute('aria-invalid'));
      d.append(form);
    } else d.append(body2, row);
    d.addEventListener('close', finish); // Escape closes a native dialog: that answers "no"
    d.addEventListener('cancel', () => { answer = o.buttons.find((b) => b.cancel) ?? null; value = ''; });
    dismissOpen = dismiss;
    document.body.append(d);
    if (d.showModal) d.showModal(); else d.setAttribute('open', ''); // DOMs without <dialog> support (tests)
    (o.focus === 'input' ? field : buttons[o.focus])?.focus();
    if (o.focus === 'input') field?.select();
  });
}

const okText = () => (labels.ok === 'Confirm' ? text('xoong.confirm.ok', 'Confirm') : labels.ok);
const cancelText = () => (labels.cancel === 'Cancel' ? text('xoong.confirm.cancel', 'Cancel') : labels.cancel);

/**
 * Ask a yes or no question. Without a `kind` the confirming button is the red one of a destructive action; `kind: 'info'` or `'success'` makes it the accent.
 * @param {string} message @param {Look & { ok?: string, cancel?: string }} [options] @returns {Promise<boolean>}
 */
export function confirm(message, options = {}) {
  return present({ ...options, message, focus: 0, buttons: [{ label: options.cancel ?? cancelText(), value: false, cancel: true }, { label: options.ok ?? okText(), value: true, primary: true }] })
    .then((r) => r.choice?.value === true);
}

/**
 * Tell the person something; resolves when they close it. `kind` defaults to 'info'.
 * @param {string} message @param {Look & { ok?: string }} [options] @returns {Promise<void>}
 */
export function alert(message, options = {}) {
  return present({ kind: 'info', ...options, message, focus: 0, buttons: [{ label: options.ok ?? text('xoong.dialog.ok', 'OK'), primary: true, cancel: true }] }).then(() => undefined);
}

/**
 * Ask for a line of text: resolves with it, or null when cancelled. The field is native, so `required`, `pattern` and `type` are checked by the browser.
 * @param {string} message @param {Look & { value?: string, label?: string, placeholder?: string, type?: string, required?: boolean, pattern?: string, ok?: string, cancel?: string }} [options] @returns {Promise<string | null>}
 */
export function prompt(message, options = {}) {
  return present({ kind: undefined, ...options, message, focus: 'input', input: options, buttons: [{ label: options.cancel ?? cancelText(), value: null, cancel: true }, { label: options.ok ?? text('xoong.dialog.ok', 'OK'), primary: true }] })
    .then((r) => (r.choice?.primary ? r.value : null));
}

/**
 * Offer any set of choices (save, don't save, cancel): resolves with the `value` of the one pressed, or of the button marked `cancel` on Escape (null if none).
 * @param {string} message @param {Look & { buttons: Choice[] }} options @returns {Promise<any>}
 */
export function ask(message, options) {
  const buttons = options.buttons;
  const first = buttons.findIndex((b) => b.cancel);
  return present({ ...options, message, buttons, choices: true, focus: first < 0 ? Math.max(0, buttons.findIndex((b) => b.primary)) : first }).then((r) => (r.choice ? r.choice.value : null));
}
