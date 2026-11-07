// @ts-check
// @xoong/i18n: importing it turns translation on for the page (xo-t, the text hook of xoong's own packages, locale-aware formats).
export { locale, configureI18n, setLocale, addMessages, resetI18n, t, messageFor, onLocaleChange, detectLocale, directionOf } from './i18n.js';
export { formatMessage, parse, argsOf } from './message.js';
export { apply, hasText, parseSpec, startEnhancer } from './xo-t.js';
export { builtin } from './builtin.js';

import { setTranslator } from '@xoong/data/view';
import { apply, hasText, startEnhancer } from './xo-t.js';
import { addMessages } from './i18n.js';
setTranslator({ apply, hasText }); // views translate their own `xo-t` elements with their scope
if (globalThis.document) startEnhancer();
void addMessages;
