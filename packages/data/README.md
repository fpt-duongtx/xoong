# @xoong/data

The data layer of xoong: a typed client generated from your OpenAPI document, a query cache keyed by operation and parameters, a shared entity store, `<xo-view>` and live updates over server-sent events.

## Install

```bash
npm install @xoong/data
```

## Use

```js
import { configure } from '@xoong/data';
import '@xoong/data/view';
import operations from './.xoong/operations.json' with { type: 'json' };   // written by `npx xoong sync openapi.json`

configure({ api: operations, baseUrl: '/api' });
```
```html
<xo-view get="listPeople">
  <p xo-if="$loading">Loading…</p>
  <ul><li xo-each="items">{name}</li></ul>
</xo-view>
```

## More

* Documentation, guides and live demos: https://fpt-duongtx.github.io/xoong/
* Source: https://github.com/fpt-duongtx/xoong/tree/main/packages/data
* All packages share one version number and are released together: https://github.com/fpt-duongtx/xoong/releases
* xoong is a working prototype (0.0.x): the HTML syntax is still Draft.

MIT licence.
