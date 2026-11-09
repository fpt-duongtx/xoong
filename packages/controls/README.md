# @xoong/controls

Accessible controls for xoong as Light DOM custom elements: tabs, menu, tooltip, combobox, tags and carousel. Only depends on `@xoong/core`.

## Install

```bash
npm install @xoong/controls
```

## Use

```js
import '@xoong/controls';          // everything, or one: '@xoong/controls/carousel'
```
```html
<xo-tabs label="Page"><section xo-tab="General">…</section><section xo-tab="SEO">…</section></xo-tabs>
<xo-combobox name="author" multiple><option value="1">Ada</option></xo-combobox>
<xo-carousel label="Services" items="3" dots counter>…</xo-carousel>
```

## More

* Documentation, guides and live demos: https://fpt-duongtx.github.io/xoong/
* Source: https://github.com/fpt-duongtx/xoong/tree/main/packages/controls
* All packages share one version number and are released together: https://github.com/fpt-duongtx/xoong/releases
* xoong is a working prototype (0.0.x): the HTML syntax is still Draft.

MIT licence.
