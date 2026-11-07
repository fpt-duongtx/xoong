// @ts-check
/**
 * Display formats for interpolation: `{publishedAt | datetime}`, `{total | number}`, `{createdAt | relative}`.
 * They use Intl (the platform), the page language (`<html lang>`, else the browser's), and never throw on bad input: a value that
 * cannot be formatted is shown as it is. Add your own with `setFormat('money', (v) => ...)`.
 */

/** @type {(() => string) | null} */
let localeSource = null;
/** The i18n package says which language is active; without it the page language (`<html lang>`) or the browser's is used. */
export function setLocaleSource(fn) { localeSource = fn; }
export function locale() {
  return localeSource?.() || globalThis.document?.documentElement?.lang || globalThis.navigator?.language || 'en';
}
const asDate = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };

const UNITS = /** @type {[Intl.RelativeTimeFormatUnit, number][]} */ ([['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]]);

/** @type {Map<string, (value: any) => string>} */
const formats = new Map([
  ['date', (v) => { const d = asDate(v); return d ? new Intl.DateTimeFormat(locale(), { dateStyle: 'medium' }).format(d) : String(v); }],
  ['datetime', (v) => { const d = asDate(v); return d ? new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(d) : String(v); }],
  ['time', (v) => { const d = asDate(v); return d ? new Intl.DateTimeFormat(locale(), { timeStyle: 'short' }).format(d) : String(v); }],
  ['relative', (v) => {
    const d = asDate(v);
    if (!d) return String(v);
    const seconds = Math.round((d.getTime() - Date.now()) / 1000);
    const [unit, size] = UNITS.find(([, s]) => Math.abs(seconds) >= s) ?? ['second', 1];
    return new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' }).format(Math.round(seconds / size), unit);
  }],
  ['number', (v) => (Number.isFinite(Number(v)) && v !== '' ? new Intl.NumberFormat(locale()).format(Number(v)) : String(v))],
  ['json', (v) => JSON.stringify(v)],
  // content in several languages: { en: 'Hello', vi: 'Xin chào' } -> the active language, then its base language, then English, then whatever is filled
  ['localized', (v) => {
    if (v === null || typeof v !== 'object') return String(v);
    const loc = locale();
    const pick = v[loc] ?? v[loc.split('-')[0]] ?? v.en ?? Object.values(v).find((x) => x !== '' && x != null);
    return pick == null ? '' : String(pick);
  }],
]);
const warned = new Set();

/** Register or replace a format. @param {string} name @param {(value: any) => string} fn */
export function setFormat(name, fn) { formats.set(name, fn); }

/** Format a value; nothing (null, undefined) is an empty string; an unknown format name is reported once and shows the plain value. */
export function format(name, value) {
  if (value === undefined || value === null) return '';
  const fn = formats.get(name);
  if (!fn) {
    if (!warned.has(name)) { warned.add(name); console.error(`xoong: unknown format "${name}" in {path | ${name}} (known: ${[...formats.keys()].join(', ')})`); }
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
  try { return fn(value); } catch { return String(value); }
}
