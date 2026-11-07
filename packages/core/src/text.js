// @ts-check
/**
 * The text hook: how xoong's own packages (validation messages, table labels, confirm buttons) ask for words without knowing about
 * translation. `text('xoong.table.next', 'Next')` returns the English default, unless a provider is installed (`@xoong/i18n` installs one) that
 * knows a translation for the key in the active language. Applications never call this directly: they use `t()` from @xoong/i18n.
 */

/** @type {((key: string, args?: Record<string, any>) => string | undefined) | null} */
let provider = null;

/** Install (or remove, with null) the provider. It returns undefined for a key it has no message for. */
export function setTextProvider(fn) { provider = fn; }

/**
 * @param {string} key a stable key such as "xoong.table.next"
 * @param {string} fallback the English text; `{name}` placeholders are filled from `args` when no provider answers
 * @param {Record<string, any>} [args]
 */
export function text(key, fallback, args) {
  const translated = provider?.(key, args);
  if (translated !== undefined) return translated;
  if (!args) return fallback;
  // The English defaults use `{name}` and the simple form `{n, plural, one {# thing} other {# things}}`; @xoong/i18n handles the whole message language.
  return fallback.replace(/\{(\w+), plural, one \{([^{}]*)\} other \{([^{}]*)\}\}|\{(\w+)\}/g, (m, n, one, other, name) => {
    if (n) { const v = Number(args[n]); return (v === 1 ? one : other).replace('#', String(v)); }
    return name in args ? String(args[name]) : m;
  });
}
