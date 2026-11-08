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

## More

* Documentation and demos: https://github.com/fpt-duongtx/xoong#readme
* Source: https://github.com/fpt-duongtx/xoong/tree/main/packages/i18n
* All packages share one version number and are released together: https://github.com/fpt-duongtx/xoong/releases
* xoong is a working prototype (0.0.x): the HTML syntax is still Draft.

MIT licence.
