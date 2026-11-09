# @xoong/richtext

A small rich text editor for xoong forms: sanitised HTML in and out, an accessible toolbar in two sizes, a media hook. Only depends on `@xoong/core`.

## Install

```bash
npm install @xoong/richtext
```

## Use

```js
import '@xoong/richtext';
```
```html
<xo-richtext name="body" label="Body" media></xo-richtext>
```
`@xoong/richtext/sanitize` exports the sanitiser, so your server can clean the HTML again on save.

## More

* Documentation, guides and live demos: https://fpt-duongtx.github.io/xoong/
* Source: https://github.com/fpt-duongtx/xoong/tree/main/packages/richtext
* All packages share one version number and are released together: https://github.com/fpt-duongtx/xoong/releases
* xoong is a working prototype (0.0.x): the HTML syntax is still Draft.

MIT licence.
