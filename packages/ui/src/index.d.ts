export interface RouteLocation {
  /** The path without the router's `base`, e.g. "/users/3". */
  path: string;
  /** Path parameters of the matched route: { id: "3" }. */
  params: Record<string, string>;
  query: URLSearchParams;
  /** Path, query and hash as in the address bar. */
  url: string;
  /** The matched route template, or null when nothing matched (a 404). */
  route: { pattern: string; layout: string | null; title: string; template: HTMLTemplateElement } | null;
}

/** true or undefined: continue. false: cancel. A string: redirect to that path. */
export type GuardResult = boolean | string | void;

/** What a confirmation is about: an `xo-confirm` action, or leaving a page that has unsaved changes. */
export interface ConfirmContext { kind: 'action' | 'leave'; element?: Element; forms?: Element[] }
/** Replace the native confirmation dialog (for `xo-confirm` and the leave guard) with your own; resolve to true to go on. */
export function setConfirm(fn: (message: string, context?: ConfirmContext) => boolean | Promise<boolean>): void;
/** What the built-in dialogs share: `kind` adds an icon and the matching colour, `title` a heading, `detail` a second, quieter line. */
export interface DialogLook { title?: string; kind?: 'info' | 'success' | 'warning' | 'danger' | 'error'; detail?: string }
/** One button of `ask()`: its `value` is what the promise resolves with; `cancel` marks the answer for Escape. */
export interface DialogChoice { label: string; value?: unknown; primary?: boolean; danger?: boolean; cancel?: boolean }
/** Ask a yes or no question with the built-in dialog (a native modal). Without a `kind` the confirming button is red, as for a destructive action. */
export function confirm(message: string, options?: DialogLook & { ok?: string; cancel?: string }): Promise<boolean>;
/** Tell the person something; resolves when they close it. `kind` defaults to 'info'. */
export function alert(message: string, options?: DialogLook & { ok?: string }): Promise<void>;
/** Ask for a line of text: the text, or null when cancelled. The field is native: `required`, `pattern` and `type` are checked by the browser. */
export function prompt(message: string, options?: DialogLook & { value?: string; label?: string; placeholder?: string; type?: string; required?: boolean; pattern?: string; ok?: string; cancel?: string }): Promise<string | null>;
/** Offer any set of choices; resolves with the `value` of the one pressed (of the `cancel` one on Escape, null if none). */
export function ask(message: string, options: DialogLook & { buttons: DialogChoice[] }): Promise<unknown>;
/** The default button texts of confirm(): `confirmLabels.ok = 'Delete'`. */
export const confirmLabels: { ok: string; cancel: string };
/** Show a notice in <xo-toast>. */
export const toast: { show(notice: { message: string; kind?: string; action?: { label: string; run: () => unknown }; timeout?: number }): void };

/**
 * The router. It is an object from the start; router.js loads when a <xo-router> is on the page or when `router` is first used.
 * Until then `current` is null, `navigate()` waits for the module, and `guard()` / `beforeNavigate()` return the remover at once and register when it has loaded.
 */
export const router: {
  /** Go to a path relative to the base. Resolves with true when the navigation happened. */
  navigate(path: string, options?: { replace?: boolean }): Promise<boolean>;
  /** Run before every navigation; returns a function that removes the guard. */
  guard(fn: (to: RouteLocation, from: RouteLocation | null) => GuardResult | Promise<GuardResult>): () => void;
  /** Run before leaving the current location (links, back/forward, navigate); return false to stay. */
  beforeNavigate(fn: (to: RouteLocation, from: RouteLocation | null, type: 'link' | 'api' | 'popstate') => boolean | void | Promise<boolean | void>): () => void;
  readonly current: RouteLocation | null;
};
