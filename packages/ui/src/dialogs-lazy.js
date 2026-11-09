// @ts-check
/**
 * confirm, alert, prompt and ask for the page: dialogs.js (the built-in question dialogs, 10 KB) loads on the first call, so a page that never asks does not fetch it.
 * Each was already asynchronous. The first call waits for the module; once it has loaded they present at once, as before.
 */
import { setConfirm } from '@xoong/data/view';

/** The default button texts of confirm() (here, so `confirmLabels` exists before the dialogs load). */
export const confirmLabels = { ok: 'Confirm', cancel: 'Cancel' };
/** @type {typeof import('./dialogs.js') | null} */
let mod = null;
const via = (/** @type {'confirm' | 'alert' | 'prompt' | 'ask'} */ name) => (/** @type {any[]} */ ...args) => (mod ? mod[name](...args) : import('./dialogs.js').then((m) => (mod = m)[name](...args)));
export const confirm = /** @type {typeof import('./dialogs.js').confirm} */ (via('confirm'));
export const alert = /** @type {typeof import('./dialogs.js').alert} */ (via('alert'));
export const prompt = /** @type {typeof import('./dialogs.js').prompt} */ (via('prompt'));
export const ask = /** @type {typeof import('./dialogs.js').ask} */ (via('ask'));

// `xo-confirm="Delete {name}?"` and the leave-the-page question use the built-in dialog
setConfirm((message, context) => {
  const el = context?.element;
  const attr = (/** @type {string} */ name) => el?.getAttribute(name) ?? undefined;
  return confirm(message, { title: attr('xo-confirm-title'), ok: attr('xo-confirm-ok'), cancel: attr('xo-confirm-cancel'), kind: /** @type {any} */ (attr('xo-confirm-kind')) });
});
