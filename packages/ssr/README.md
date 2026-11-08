# @xoong/ssr

Prerender xoong pages: runs the real `<xo-view>` runtime in Node (happy-dom), waits for the data and writes HTML. There is no hydration step: the browser re-renders from the saved template.

## Install

```bash
npm install @xoong/ssr
```

## Use

```bash
npx xoong render page.html --api https://api.example.org --out page.prerendered.html
```
Public pages only: a page that needs the visitor's session is rendered in the browser.

## More

* Documentation and demos: https://github.com/fpt-duongtx/xoong#readme
* Source: https://github.com/fpt-duongtx/xoong/tree/main/packages/ssr
* All packages share one version number and are released together: https://github.com/fpt-duongtx/xoong/releases
* xoong is a working prototype (0.0.x): the HTML syntax is still Draft.

MIT licence.
