# Using xoong from another project

The packages are on npm under the tag `next`: `npm install @xoong/xoong@next` (or single `@xoong/*` packages). This page is for working from a release file instead: to try a tag that is not on npm yet, or without the registry. Each drop is a git tag (`v0.0.N`) with a GitHub Release in the public repository (https://github.com/fpt-duongtx/xoong/releases) that carries one
tarball per package and a `consume.json`. All packages share the version number.

## Install a drop

```bash
# in your project (the repository is public: `gh` needs no sign-in for it)
gh release download v0.0.54 -R fpt-duongtx/xoong -D vendor/xoong
```

Then copy `dependencies` (only what you import) and the whole `overrides` from `vendor/xoong/consume.json` into your `package.json`
(the overrides make the packages find each other as tarballs instead of looking on the registry), and run `npm install`:

```json
{
  "dependencies": { "@xoong/xoong": "file:./vendor/xoong/xoong-xoong-0.0.54.tgz", "@xoong/ui": "file:./vendor/xoong/xoong-ui-0.0.54.tgz" },
  "overrides": { "@xoong/core": "file:./vendor/xoong/xoong-core-0.0.54.tgz", "...": "every package listed in consume.json" }
}
```

`consume.json` also records the git commit the drop was built from. To move to a newer drop, download the new tag into the same folder,
update the version in the paths, and run `npm install` again.

## Build a drop yourself

```bash
node tools/pack.mjs dist-pack --prefix ./vendor/xoong   # tarballs and consume.json in dist-pack/
```

For a checkout on the same machine, `xoong new <folder> --spec <openapi> --link <path to the checkout>` makes a project that uses the
checkout directly (no tarballs).

## Serving an app in production

Use `xoong build` (it needs only your project, no bundler): `xoong build --root . --out dist [--base /admin] [--include public] [--exclude 'screens/**']` (`--help` prints the options; unknown options are refused, in every `xoong` command; an output folder inside the root is never read as input). It follows the
HTML pages, rewrites package imports to URLs (no import map), strips TypeScript, copies what is referenced, and prints the Content-Security-Policy
the output is tested with ([security.md](security.md)). Serve `dist` as static files, with the pages' routes answering the app's HTML if you use
`<xo-router>`. The default leaves every file as you wrote it, and `dist/build-report.json` lists sizes (also gzipped). `--minify` and `--bundle` are opt-in.
Every `.html` file under the root is a page. HTML that is not (partials, fixtures, drafts) is kept out with `--exclude <glob>` (repeatable) or `"build": { "exclude": ["screens/**", "*.draft.html"] }` in `xoong.config.json`: paths relative to the root, `*` stays in a folder, `**` crosses folders, a name without `/` matches at any depth, a trailing `/` is a folder. A file that a page references is still published. `xoong check` takes `--exclude` too, and `"check": { "exclude": [...] }` in the config.
The build also lists, on every page, the modules its scripts import as `<link rel="modulepreload">` (static imports only; a dynamic `import()` stays lazy), so the browser fetches the whole chain at once instead of one import level at a time. `--no-preload` or `"build": { "preload": false }` turns it off.
`--minify` (or `"build": { "minify": true }`) minifies the scripts, stylesheets and JSON with the **esbuild your project has installed** (`npm install --save-dev esbuild`); xoong does not depend on it. The imports are rewritten as before and the output still runs under the strict policy; without esbuild installed the build warns and writes the files as they are. The default stays unminified, so the output is the code you wrote. Two risks to know: esbuild renames local identifiers, so code that reads `Function.name` or a class's `name` sees the short names (keep such names explicit), and the flag does nothing without esbuild (the build only warns, so check that esbuild is in your `devDependencies` if the size matters in CI). On the benchmark screen it takes the 92 KB (gzip) of the shipped files to about 49 KB.
`--bundle` (or `"build": { "bundle": true }`) uses that same esbuild to emit CSP-clean ESM. Static imports are folded into the entry; a dynamic `import()` stays its own chunk, so a tag that loads on demand still does. CSS stays a separate file. A copied script is deleted only when esbuild actually bundled it: the metafile names inputs by their path on disk (`../../../packages/...` in this repository, `node_modules/@xoong/...` when the package is installed), and the build maps those paths back to the URL it copied (`/@xoong/ui/src/...`). A worker, a file fetched by URL, or a file passed to `--include` is not an input and stays. An import of `/.xoong/operations.json` is that file in the project, not a path from the filesystem root, so the JSON is bundled; the build still writes it at `/operations.json` and `/.xoong/operations.json`. Without esbuild the build warns and copies every module, as before (xoong does not depend on esbuild). The repository lists esbuild 0.28.2, the version the benchmark app uses, as a devDependency so those tests run in CI; a published package does not depend on it. When esbuild is installed and the bundle fails, the build throws and writes nothing. A URL that already starts with `--base` is not prefixed again.
An inline `<script>` (no `src`, and a JavaScript type) is removed and reported: `script-src 'self'` would block it. JSON and JSON-LD scripts stay. `--inline-scripts error` (or `"build": { "inlineScripts": "error" }`) does the same and exits 1. When `.xoong/operations.json` exists it is copied to `/.xoong/operations.json` and to `/operations.json` (a dot-directory is hidden by some servers), and an import of the dot path is rewritten to the root one, with `--base` applied once.
The build follows `src`, `poster`, a `<link>`'s `href` and every URL of a `srcset` (`<img>`, `<source>`, and `imagesrcset` of `<link rel="preload">`): each file is copied and, with `--base`, prefixed, and the descriptors (`1x`, `480w`) stay. `<a href>` is left as written on purpose: a link to another page is for the router, or a plain relative link, to resolve.

## What a drop promises

Versions are `0.0.N`: anything can change between drops, and breaking changes are listed in `CHANGELOG.md` with migration notes.
Attributes already shipped in an earlier drop are changed only when marked as such there.
