// @ts-check
/**
 * Language state and lookup (ADR-0010).
 *
 *   configureI18n({ locale: 'en', fallback: 'en', messages: { vi: {...} }, load: (code) => import(`/i18n/${code}.json`) });
 *   await setLocale('vi');             // loads the catalog if needed, updates <html lang dir>, re-translates the page
 *   t('articles.count', { count: 3 })  // "3 articles" (message from the catalog, in the active language)
 *   locale.value                       // a signal: read it inside an effect or a template
 */
import { signal, batch, effect, untracked } from '@xoong/core/signals';
import { setTextProvider } from '@xoong/core';
import { setLocaleSource } from '@xoong/data/format';
import { formatMessage } from './message.js';

/** @type {Record<string, Record<string, string>>} */
const catalogs = {};
/** @type {Record<string, Promise<void>>} */
const loading = {};
const state = { fallback: 'en', load: /** @type {((code: string) => Promise<any> | any) | null} */ (null) };
/** Counts language changes, so a `setLocale` that resolves after a later one knows it is stale and does nothing. */
let changes = 0;

/** The active language (BCP 47 tag, for example "vi" or "pt-BR"). A signal. */
export const locale = signal('en');
/** Bumped whenever catalogs change, so text that depends on them is re-read. */
const version = signal(0);

const RTL = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi', 'dv', 'ug', 'ckb']);
/** 'ltr' or 'rtl' for a language. */
export function directionOf(code) {
  try {
    const l = /** @type {any} */ (new Intl.Locale(code));
    const info = l.getTextInfo?.() ?? l.textInfo;
    if (info?.direction) return info.direction;
  } catch { /* an invalid tag: fall through */ }
  return RTL.has(code.split('-')[0].toLowerCase()) ? 'rtl' : 'ltr';
}

/** The tags to try for a language, most specific first: "pt-BR", "pt", then the fallback and its base language. */
function chain(code) {
  const list = [code, code.split('-')[0], state.fallback, state.fallback.split('-')[0]];
  return list.filter((c, i) => c && list.indexOf(c) === i);
}

/** Forget every catalog and go back to English (for tests and for applications that reconfigure at runtime). */
export function resetI18n() {
  for (const k of Object.keys(catalogs)) delete catalogs[k];
  for (const k of Object.keys(loading)) delete loading[k];
  state.fallback = 'en';
  state.load = null;
  changes++;
  batch(() => { locale.value = 'en'; version.value += 1; });
}

/** Add messages for a language (merged over what is there). Plain JSON: { "key": "message" }. */
export function addMessages(code, messages) {
  catalogs[code] = { ...(catalogs[code] ?? {}), ...messages };
  version.value += 1;
}

async function ensure(code) {
  if (catalogs[code] || !state.load) return;
  loading[code] ??= Promise.resolve(state.load(code)).then(
    (m) => { addMessages(code, m?.default ?? m ?? {}); },
    (e) => { catalogs[code] = {}; console.error(`xoong i18n: could not load the "${code}" catalog: ${e?.message ?? e}`); },
  );
  await loading[code];
}

/**
 * @param {{ locale?: string, fallback?: string, messages?: Record<string, Record<string, string>>, load?: (code: string) => Promise<any> | any }} [options]
 */
export function configureI18n(options = {}) {
  batch(() => {
    if (options.fallback) state.fallback = options.fallback;
    if (options.load !== undefined) state.load = options.load;
    for (const [code, messages] of Object.entries(options.messages ?? {})) addMessages(code, messages);
    if (options.locale) { changes++; locale.value = options.locale; applyDocument(options.locale); }
  });
  return Promise.all(chain(locale.peek()).map(ensure)).then(() => undefined);
}

function applyDocument(code) {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  root.setAttribute('lang', code);
  root.setAttribute('dir', directionOf(code));
}

/** Change the language: loads its catalog (and its base language's) first, so the page switches once, then updates `<html lang dir>`. The last call wins. */
export async function setLocale(code) {
  const mine = ++changes;
  await Promise.all(chain(code).map(ensure));
  if (mine !== changes) return; // a later call (or configureI18n) chose another language meanwhile
  batch(() => { locale.value = code; });
  applyDocument(code);
}

/** The message for a key in the active language, or undefined. Reading it inside an effect tracks the language and the catalogs. */
export function messageFor(key) {
  version.value; // track catalogs
  for (const code of chain(locale.value)) { const m = catalogs[code]?.[key]; if (m !== undefined) return m; }
  return undefined;
}

/**
 * Translate: `t('articles.count', { count: 3 })`. `fallbackText` is shown when the key is unknown in every language of the chain; without it the key is.
 * @param {string} key @param {Record<string, any>} [args] @param {string} [fallbackText]
 */
export function t(key, args = {}, fallbackText) {
  const message = messageFor(key) ?? fallbackText ?? key;
  return formatMessage(message, (name) => args[name], locale.value);
}

/** Run `fn(code)` after each language change (not for the current one); returns a function that stops it. */
export function onLocaleChange(fn) {
  let first = true;
  return effect(() => {
    const code = locale.value;
    if (first) { first = false; return; }
    untracked(() => fn(code));
  });
}

/**
 * Pick a supported language: the one in `?lang=`, a saved choice, then the browser's preferences, then `default`.
 * @param {string[]} supported @param {{ default?: string, query?: string, storageKey?: string }} [options]
 */
export function detectLocale(supported, { default: fallback = supported[0], query = 'lang', storageKey = 'xoong.locale' } = {}) {
  const base = (c) => c.split('-')[0].toLowerCase();
  const pick = (code) => (code ? supported.find((s) => s.toLowerCase() === code.toLowerCase()) ?? supported.find((s) => base(s) === base(code)) : undefined); // exact, then any variant of the same language
  const fromQuery = pick(new URLSearchParams(globalThis.location?.search).get(query) ?? '');
  if (fromQuery) return fromQuery;
  try { const saved = pick(globalThis.localStorage?.getItem(storageKey) ?? ''); if (saved) return saved; } catch { /* storage may be blocked */ }
  for (const code of globalThis.navigator?.languages ?? []) { const hit = pick(code); if (hit) return hit; }
  return fallback;
}

// xoong's own packages ask for words through the text hook; dates and numbers follow the active language
setTextProvider((key, args) => {
  const m = messageFor(key);
  return m === undefined ? undefined : formatMessage(m, (name) => args?.[name], locale.value);
});
setLocaleSource(() => locale.value);
