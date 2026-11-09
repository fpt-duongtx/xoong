# @xoong/cli

The `xoong` command: turns an OpenAPI document into typed operations, lints your screens, runs the dev server and builds static output that runs under a strict Content-Security-Policy.

## Install

```bash
npm install @xoong/cli
```

## Use

```bash
npx xoong sync openapi.json        # writes .xoong/operations.json, api.d.ts and the editor data
npx xoong doctor openapi.json      # what in the document (and in xoong.hints.json) limits xoong
npx xoong check index.html         # lint screens against the API (--format json, --exclude)
npx xoong dev                      # static server with an API proxy
npx xoong build --out dist         # strict-CSP static output (--base, --include, --exclude, --no-preload)
npx xoong render page.html --api http://localhost:8080   # prerender a page (needs @xoong/ssr)
npx xoong i18n extract src --out catalogs/en.json         # the xo-t messages; i18n check <catalog> --source <en.json>
npx xoong --help                   # every command and option; an option that does not exist is refused
```
Exit code: 0 done, 1 findings or a failure, 2 an unknown command or a missing argument.

## More

* Documentation and demos: https://github.com/fpt-duongtx/xoong#readme
* Source: https://github.com/fpt-duongtx/xoong/tree/main/packages/cli
* All packages share one version number and are released together: https://github.com/fpt-duongtx/xoong/releases
* xoong is a working prototype (0.0.x): the HTML syntax is still Draft.

MIT licence.
