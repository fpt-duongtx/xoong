import { test } from 'vitest';
import assert from 'node:assert/strict';
import { signal, computed, effect, batch, untracked } from '../src/signals.js';

test('effect runs now and on change', () => {
  const a = signal(1);
  const seen = [];
  effect(() => seen.push(a.value));
  a.value = 2;
  a.value = 2; // no change, no run
  assert.deepEqual(seen, [1, 2]);
});

test('computed is lazy, cached and tracks', () => {
  const a = signal(2);
  let runs = 0;
  const double = computed(() => (runs++, a.value * 2));
  assert.equal(runs, 0);
  assert.equal(double.value, 4);
  assert.equal(double.value, 4);
  assert.equal(runs, 1);
  a.value = 3;
  assert.equal(double.value, 6);
  assert.equal(runs, 2);
});

test('effect depending on computed re-runs once per write', () => {
  const a = signal(1);
  const sq = computed(() => a.value * a.value);
  const seen = [];
  effect(() => seen.push(sq.value));
  a.value = 3;
  assert.deepEqual(seen, [1, 9]);
});

test('batch flushes once', () => {
  const a = signal(1), b = signal(1);
  const seen = [];
  effect(() => seen.push(a.value + b.value));
  batch(() => { a.value = 2; b.value = 3; });
  assert.deepEqual(seen, [2, 5]);
});

test('dependencies are re-tracked (conditional reads)', () => {
  const flag = signal(true), a = signal('a'), b = signal('b');
  const seen = [];
  effect(() => seen.push(flag.value ? a.value : b.value));
  b.value = 'b2'; // not read yet
  assert.deepEqual(seen, ['a']);
  flag.value = false;
  b.value = 'b3';
  assert.deepEqual(seen, ['a', 'b2', 'b3']);
});

test('dispose stops the effect and runs cleanup', () => {
  const a = signal(0);
  let cleaned = 0, runs = 0;
  const stop = effect(() => { runs++; a.value; return () => cleaned++; });
  stop();
  a.value = 1;
  assert.equal(runs, 1);
  assert.equal(cleaned, 1);
});

test('untracked does not subscribe', () => {
  const a = signal(0);
  let runs = 0;
  effect(() => { runs++; untracked(() => a.value); });
  a.value = 1;
  assert.equal(runs, 1);
});

test('runaway effect loop is stopped with a clear error', () => {
  const a = signal(0);
  assert.throws(() => effect(() => { a.value = a.value + 1; }), /did not settle/);
});

test('a throwing effect does not stop other effects from running', () => {
  const a = signal(0);
  const seen = [];
  effect(() => { if (a.value === 1) throw new Error('boom'); });
  effect(() => seen.push(a.value));
  assert.throws(() => { a.value = 1; }, /boom/);
  assert.deepEqual(seen, [0, 1]); // second effect still ran
  a.value = 2; // system still works
  assert.deepEqual(seen, [0, 1, 2]);
});

test('computed lets go of its sources when the last observer is disposed', () => {
  const a = signal(1);
  const c = computed(() => a.value * 2);
  const stop = effect(() => { c.value; });
  assert.equal(a.subs.size, 1);
  stop();
  assert.equal(a.subs.size, 0);
  a.value = 5;
  assert.equal(c.value, 10); // recomputes correctly after detaching
});
