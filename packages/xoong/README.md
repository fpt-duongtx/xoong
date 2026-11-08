# xoong

One install for xoong, a small standards-first web framework: signals and templates, the OpenAPI data layer, forms, the admin set and the `xoong` command.

## Use

```bash
npm install xoong
npx xoong sync openapi.json
```
```js
import { configure, signal, html } from 'xoong';
import 'xoong/view';
import 'xoong/ui';
```
More parts, installed separately: `@xoong/controls`, `@xoong/richtext`, `@xoong/i18n`, `@xoong/test`, `@xoong/ssr`, `@xoong/mcp`, `@xoong/lsp`.

## More

* Documentation and demos: https://github.com/fpt-duongtx/xoong#readme
* Source: https://github.com/fpt-duongtx/xoong/tree/main/packages/xoong
* All packages share one version number and are released together: https://github.com/fpt-duongtx/xoong/releases
* xoong is a working prototype (0.0.x): the HTML syntax is still Draft.

MIT licence.
