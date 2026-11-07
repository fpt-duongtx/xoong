// @ts-check
/**
 * The confirmation dialog behind `xo-confirm="Delete {title}?"` (and the leave-page question of a dirty form): a native modal <dialog>,
 * created on first use. Escape or Cancel answers no, Confirm answers yes; the focus starts on Cancel, the safe choice for a
 * destructive action. Replaces the browser's confirm() as soon as @xoong/ui is imported.
 *
 *   // from the package entry: confirm(message, { ok, cancel }) resolves true or false
 *   if (await confirm('Discard the draft?', { ok: 'Discard' })) ...
 */
import { setConfirm } from '@xoong/data/view';
import { text } from '@xoong/core';

/** The button texts; replace them for another wording or language. */
export const labels = { ok: 'Confirm', cancel: 'Cancel' };

/** @type {HTMLDialogElement | null} */
let dialog = null;

/** @param {string} message @param {{ ok?: string, cancel?: string }} [options] @returns {Promise<boolean>} */
export function confirm(message, options = {}) {
  return new Promise((resolve) => {
    dialog?.remove();
    const d = document.createElement('dialog');
    d.className = 'xo-confirm';
    d.setAttribute('aria-labelledby', 'xo-confirm-text');
    const text = document.createElement('p');
    text.id = 'xo-confirm-text';
    text.textContent = message;
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = options.cancel ?? (labels.cancel === 'Cancel' ? text('xoong.confirm.cancel', 'Cancel') : labels.cancel);
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'xo-confirm-ok';
    ok.textContent = options.ok ?? (labels.ok === 'Confirm' ? text('xoong.confirm.ok', 'Confirm') : labels.ok);
    const row = document.createElement('div');
    row.className = 'xo-confirm-actions';
    row.append(cancel, ok);
    d.append(text, row);
    let answer = false;
    const finish = () => { d.remove(); if (dialog === d) dialog = null; resolve(answer); };
    cancel.addEventListener('click', () => { answer = false; d.close ? d.close() : finish(); });
    ok.addEventListener('click', () => { answer = true; d.close ? d.close() : finish(); });
    d.addEventListener('close', finish); // Escape closes a native dialog: that answers no
    d.addEventListener('cancel', () => { answer = false; });
    document.body.append(d);
    dialog = d;
    if (d.showModal) d.showModal(); else d.setAttribute('open', ''); // DOMs without <dialog> support (tests)
    cancel.focus();
  });
}

setConfirm((message) => confirm(message));
