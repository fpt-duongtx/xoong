# @xoong/cli

The `xoong` command: turns an OpenAPI document into typed operations, lints your screens, runs the dev server and builds static output that runs under a strict Content-Security-Policy.

## Install

```bash
npm install @xoong/cli
```

## Use

```bash
npx xoong sync openapi.json        # writes .xoong/operations.json and api.d.ts
npx xoong check index.html         # lint screens against the API
npx xoong dev                      # static server with an API proxy
npx xoong build --out dist         # strict-CSP static output
```

## More

* Documentation and demos: https://github.com/fpt-duongtx/xoong#readme
* Source: https://github.com/fpt-duongtx/xoong/tree/main/packages/cli
* All packages share one version number and are released together: https://github.com/fpt-duongtx/xoong/releases
* xoong is a working prototype (0.0.x): the HTML syntax is still Draft.

MIT licence.
