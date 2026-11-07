// @ts-check
/**
 * Minimal signals: signal, computed, effect, batch, untracked.
 *
 * Semantics (kept deliberately small):
 *  - Reads inside a computed/effect are tracked automatically.
 *  - Writes outside a batch flush effects synchronously.
 *  - Writes inside `batch` flush once at the end of the outermost batch.
 *  - `effect` is for side effects only. Never fetch data in an effect:
 *    declare the operation on a view instead.
 */

/** @typedef {{ run(): void }} Observer */

/** @type {Observer | null} */
let active = null;
let batchDepth = 0;
/** @type {Set<Effect>} */
const pending = new Set();
let flushing = false;

/** Track one source in the active observer. */
function track(source) {
  if (active) {
    source.subs.add(active);
    active.deps.add(source);
  }
}

function flush() {
  if (flushing) return;
  flushing = true;
  /** @type {unknown[]} */
  const errors = [];
  try {
    // Effects may schedule more effects while running; loop until stable.
    let guard = 0;
    while (pending.size) {
      if (++guard > 10000) {
        pending.clear();
        throw new Error('xoong: effect loop did not settle (an effect keeps writing a signal it reads)');
      }
      const [next] = pending;
      pending.delete(next);
      // One broken effect must not stop the others from running.
      try { next.run(); } catch (e) { errors.push(e); }
    }
  } finally {
    flushing = false;
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, `xoong: ${errors.length} effects threw`);
}

/** Remove `observer` from `source`; a computed nobody watches lets go of its sources. */
function unsubscribe(source, observer) {
  source.subs.delete(observer);
  if (source.subs.size === 0 && source instanceof Computed) source.detach();
}

/**
 * @template T
 */
export class Signal {
  /** @type {T} */ #value;
  /** @type {Set<any>} */ subs = new Set();
  /** @param {T} value */
  constructor(value) {
    this.#value = value;
  }
  get value() {
    track(this);
    return this.#value;
  }
  set value(next) {
    if (Object.is(next, this.#value)) return;
    this.#value = next;
    for (const sub of [...this.subs]) sub.notify();
    if (batchDepth === 0) flush();
  }
  /** Read without tracking. */
  peek() {
    return this.#value;
  }
  /** Update from the previous value. */
  update(fn) {
    this.value = fn(this.#value);
  }
}

/**
 * @template T
 * @param {T} value
 * @returns {Signal<T>}
 */
export const signal = (value) => new Signal(value);

class Computed {
  /** @type {Set<any>} */ deps = new Set();
  /** @type {Set<any>} */ subs = new Set();
  dirty = true;
  /** @type {any} */ #value;
  /** @type {() => any} */ #fn;
  constructor(fn) {
    this.#fn = fn;
  }
  notify() {
    if (this.dirty) return;
    this.dirty = true;
    for (const sub of [...this.subs]) sub.notify();
  }
  /** Stop listening to sources (no observers left, or the owner is discarding it). */
  detach() {
    for (const dep of this.deps) dep.subs.delete(this);
    this.deps.clear();
    this.dirty = true; // next read recomputes and re-attaches
  }
  run() {
    // Called when re-evaluation is needed.
    for (const dep of this.deps) dep.subs.delete(this);
    this.deps.clear();
    const prev = active;
    active = this;
    try {
      this.#value = this.#fn();
      this.dirty = false;
    } finally {
      active = prev;
    }
  }
  get value() {
    if (this.dirty) this.run();
    track(this);
    return this.#value;
  }
  peek() {
    if (this.dirty) this.run();
    return this.#value;
  }
}

/**
 * @template T
 * @param {() => T} fn
 * @returns {{ readonly value: T, peek(): T }}
 */
export const computed = (fn) => new Computed(fn);

/** Release a computed's subscriptions when its owner is discarded. @param {{detach?: () => void}} c */
export const disposeComputed = (c) => c.detach?.();

class Effect {
  /** @type {Set<any>} */ deps = new Set();
  disposed = false;
  /** @type {void | (() => void)} */ cleanup;
  /** @param {() => void | (() => void)} fn */
  constructor(fn) {
    this.fn = fn;
  }
  notify() {
    if (!this.disposed) pending.add(this);
  }
  run() {
    if (this.disposed) return;
    this.cleanup?.();
    for (const dep of [...this.deps]) unsubscribe(dep, this);
    this.deps.clear();
    const prev = active;
    active = this;
    try {
      const out = this.fn();
      this.cleanup = typeof out === 'function' ? out : undefined;
    } finally {
      active = prev;
    }
  }
  dispose() {
    this.disposed = true;
    pending.delete(this);
    this.cleanup?.();
    for (const dep of [...this.deps]) unsubscribe(dep, this);
    this.deps.clear();
  }
}

/**
 * Run `fn` now and again whenever a signal it read changes.
 * The function may return a cleanup callback.
 * @param {() => void | (() => void)} fn
 * @returns {() => void} dispose
 */
export function effect(fn) {
  const e = new Effect(fn);
  // Run inside a batch so an effect created within a write sees a stable graph.
  batchDepth++;
  try {
    e.run();
  } finally {
    batchDepth--;
  }
  if (batchDepth === 0) flush();
  return () => e.dispose();
}

/**
 * Group writes; effects flush once after the outermost batch.
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
export function batch(fn) {
  batchDepth++;
  try {
    return fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) flush();
  }
}

/**
 * Read signals without tracking them.
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
export function untracked(fn) {
  const prev = active;
  active = null;
  try {
    return fn();
  } finally {
    active = prev;
  }
}
