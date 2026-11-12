# @xoong/i18n

Internationalisation for xoong: JSON catalogs with an ICU subset, `xo-t` in markup, a locale signal and Intl formats. Built-in strings come with an English catalog and Vietnamese.

## Install

```bash
npm install @xoong/i18n
```

## Use

```js
import { configureI18n, setLocale } from '@xoong/i18n';

configureI18n({ locale: 'en', load: (code) => fetch(`/i18n/${code}.json`).then((r) => r.json()) });
await setLocale('vi');
```
```html
<h1 xo-t="home.title">Welcome</h1>
```

## Change xoong's own words

Tables, pagers, forms and dialogs ask for their words by key (`xoong.table.next`, `xoong.form.add`, ...; the list is `builtin` in `@xoong/i18n`). Your catalog is read first, so a message you add replaces the built-in one for that language:

```js
configureI18n({ messages: { en: { 'xoong.table.next': 'Onward', 'xoong.form.add': 'Plus' } } });
```

A `submit="..."` or `<button>` text you write yourself is yours and is not translated by xoong.

## More

* Documentation, guides and live demos: https://fpt-duongtx.github.io/xoong/
* Source: https://github.com/fpt-duongtx/xoong/tree/main/packages/i18n
* All packages share one version number and are released together: https://github.com/fpt-duongtx/xoong/releases
* xoong is a working prototype (0.0.x): the HTML syntax is still Draft.

MIT licence.
