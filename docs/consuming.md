# Using xoong from another project

The packages are on npm under the tag `next`: `npm install @xoong/xoong@next` (or single `@xoong/*` packages). This page is for working from a release file instead: to try a tag that is not on npm yet, or without the registry. Each drop is a git tag (`v0.0.N`) with a GitHub Release in the public repository (https://github.com/fpt-duongtx/xoong/releases) that carries one
tarball per package and a `consume.json`. All packages share the version number.

## Install a drop

```bash
# in your project (the repository is public: `gh` needs no sign-in for it)
gh release download v0.0.48 -R fpt-duongtx/xoong -D vendor/xoong
```

Then copy `dependencies` (only what you import) and the whole `overrides` from `vendor/xoong/consume.json` into your `package.json`
(the overrides make the packages find each other as tarballs instead of looking on the registry), and run `npm install`:

```json
{
  "dependencies": { "@xoong/xoong": "file:./vendor/xoong/xoong-xoong-0.0.48.tgz", "@xoong/ui": "file:./vendor/xoong/xoong-ui-0.0.48.tgz" },
  "overrides": { "@xoong/core": "file:./vendor/xoong/xoong-core-0.0.48.tgz", "...": "every package listed in consume.json" }
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
`<xo-router>`. Nothing is minified or bundled yet: the files are the ones you wrote, and `dist/build-report.json` lists sizes (also gzipped).
Every `.html` file under the root is a page. HTML that is not (partials, fixtures, drafts) is kept out with `--exclude <glob>` (repeatable) or `"build": { "exclude": ["screens/**", "*.draft.html"] }` in `xoong.config.json`: paths relative to the root, `*` stays in a folder, `**` crosses folders, a name without `/` matches at any depth, a trailing `/` is a folder. A file that a page references is still published. `xoong check` takes `--exclude` too, and `"check": { "exclude": [...] }` in the config.
The build also lists, on every page, the modules its scripts import as `<link rel="modulepreload">` (static imports only; a dynamic `import()` stays lazy), so the browser fetches the whole chain at once instead of one import level at a time. `--no-preload` or `"build": { "preload": false }` turns it off.
The build follows `src`, `poster`, a `<link>`'s `href` and every URL of a `srcset` (`<img>`, `<source>`, and `imagesrcset` of `<link rel="preload">`): each file is copied and, with `--base`, prefixed, and the descriptors (`1x`, `480w`) stay. `<a href>` is left as written on purpose: a link to another page is for the router, or a plain relative link, to resolve.

## What a drop promises

Versions are `0.0.N`: anything can change between drops, and breaking changes are listed in `CHANGELOG.md` with migration notes.
Attributes already shipped in an earlier drop are changed only when marked as such there.
