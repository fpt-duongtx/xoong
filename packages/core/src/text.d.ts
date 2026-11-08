// Types for the text hook of @xoong/core.

/** A provider answers with the translated message for a key, or undefined when it has none. `@xoong/i18n` installs one. */
export type TextProvider = (key: string, args?: Record<string, any>) => string | undefined;

/** Install (or remove, with null) the provider that translates the framework's own texts. */
export function setTextProvider(fn: TextProvider | null): void;

/**
 * The text for a stable key such as "xoong.table.next": the provider's translation, else the English `fallback`
 * (`{name}` placeholders and the simple `{n, plural, one {# thing} other {# things}}` form are filled from `args`).
 * Applications use `t()` from @xoong/i18n instead.
 */
export function text(key: string, fallback: string, args?: Record<string, any>): string;
