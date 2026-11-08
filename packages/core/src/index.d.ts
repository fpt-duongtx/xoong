// Types for @xoong/core. The runtime is plain JavaScript; these files describe it (one per source module).
export { signal, computed, effect, batch, untracked, disposeComputed, Signal } from './signals.js';
export type { ReadonlySignal } from './signals.js';
export { html, render, TemplateResult } from './html.js';
export { XoElement, define } from './element.js';
export type { XoPropType } from './element.js';
export { XoControl } from './control.js';
export type { XoValidity } from './control.js';
export { text, setTextProvider } from './text.js';
export type { TextProvider } from './text.js';
