// Types for @xoong/i18n. The runtime is plain JavaScript; this file describes its exports.
import type { Signal } from '@xoong/core/signals';

/** The active language code ("en", "vi"); setting it with `setLocale` loads the catalog first. */
export const locale: Signal<string>;
export function directionOf(code: string): 'ltr' | 'rtl';
export function resetI18n(): void;
/** Add messages for a language, merged over what is there: `{ "key": "message" }`. */
export function addMessages(code: string, messages: Record<string, string>): void;
export function configureI18n(options?: { locale?: string; fallback?: string; messages?: Record<string, Record<string, string>>; load?: (code: string) => Promise<any> | any }): void;
export function setLocale(code: string): Promise<void>;
export function messageFor(key: string): string | undefined;
/** Translate: `t('articles.count', { count: 3 })`; `fallbackText` is shown when the key is unknown, else the key. */
export function t(key: string, args?: Record<string, any>, fallbackText?: string): string;
export function onLocaleChange(fn: (code: string) => void): () => void;
export function detectLocale(supported: string[], options?: { default?: string; query?: string; storageKey?: string }): string;

export function formatMessage(source: string, get: (name: string) => any, locale: string): string;
export function parse(source: string): unknown[];
export function argsOf(nodes: unknown[], out?: Set<string>): Set<string>;

export function apply(el: Element, get: (name: string) => any): void;
export function hasText(spec: string): boolean;
export function parseSpec(spec: string): { attr?: string; key: string }[];
export function startEnhancer(root?: Document | Element): void;

/** The English catalog of xoong's own strings (the starting point for translators). */
export const builtin: Record<string, string>;
