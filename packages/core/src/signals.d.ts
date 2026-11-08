// Types for @xoong/core/signals. The runtime is plain JavaScript; this file describes it.

/** A readable reactive value. Reading `value` inside a computed, an effect or a template function is tracked. */
export interface ReadonlySignal<T> {
  readonly value: T;
  /** Read without tracking. */
  peek(): T;
}

/** A writable reactive value. Writing a different value (by `Object.is`) runs the effects that read it. */
export class Signal<T> implements ReadonlySignal<T> {
  constructor(value: T);
  get value(): T;
  set value(next: T);
  /** Read without tracking. */
  peek(): T;
  /** Set the value from the previous one. */
  update(fn: (previous: T) => T): void;
}

export function signal<T>(value: T): Signal<T>;

/** A value derived from other signals; it recomputes lazily, when something it read has changed. */
export function computed<T>(fn: () => T): ReadonlySignal<T>;

/** Let a computed release its subscriptions when its owner is discarded. */
export function disposeComputed(c: { detach?: () => void }): void;

/**
 * Run `fn` now and again whenever a signal it read changes. `fn` may return a cleanup callback, which runs before the next run and on dispose.
 * Returns the dispose function. For side effects only: never fetch data in an effect, declare the operation on a view instead.
 */
export function effect(fn: () => void | (() => void)): () => void;

/** Group writes: effects run once, after the outermost batch ends. Returns what `fn` returns. */
export function batch<T>(fn: () => T): T;

/** Read signals inside `fn` without subscribing to them. */
export function untracked<T>(fn: () => T): T;
