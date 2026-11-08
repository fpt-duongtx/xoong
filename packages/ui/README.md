# @xoong/ui

The admin set of xoong: design tokens in cascade layers, `<xo-table>`, a form generated from the request schema, `<xo-dialog>`, toasts, confirm dialogs and `<xo-router>`.

## Install

```bash
npm install @xoong/ui
```

## Use

```js
import '@xoong/ui';
```
```html
<link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
<link rel="stylesheet" href="/@xoong/ui/src/mist.css">   <!-- optional: the Mist look (the Rainlet design system), one self-sufficient file -->
<xo-view get="listPeople">
  <xo-table columns="name,email:E-mail,role" sortable filters="name:Search" page-size="10"></xo-table>
</xo-view>
```

## More

* Documentation and demos: https://github.com/fpt-duongtx/xoong#readme
* Source: https://github.com/fpt-duongtx/xoong/tree/main/packages/ui
* All packages share one version number and are released together: https://github.com/fpt-duongtx/xoong/releases
* xoong is a working prototype (0.0.x): the HTML syntax is still Draft.

MIT licence.
