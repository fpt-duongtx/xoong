# @xoong/server

The server behind `xoong dev` and `xoong build`: one `(Request) => Response` handler for static files, an API proxy and TypeScript type stripping, with a Node adapter. Never shipped to the browser.

## Install

```bash
npm install @xoong/server
```

## Use

```js
import { createHandler } from '@xoong/server';
import { serve } from '@xoong/server/node';
```
See the docs for the options.

## More

* Documentation and demos: https://github.com/fpt-duongtx/xoong#readme
* Source: https://github.com/fpt-duongtx/xoong/tree/main/packages/server
* All packages share one version number and are released together: https://github.com/fpt-duongtx/xoong/releases
* xoong is a working prototype (0.0.x): the HTML syntax is still Draft.

MIT licence.
