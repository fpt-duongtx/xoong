# Using xoong from another project (before it is published)

Nothing is published to npm. Each drop is a git tag (`v0.0.N`) with a GitHub Release in the private repository that carries one
tarball per package and a `consume.json`. All packages share the version number.

## Install a drop

```bash
# in your project (needs `gh` signed in to the private repository)
gh release download v0.0.19 -R fpt-duongtx/xoong -D vendor/xoong
```

Then copy `dependencies` (only what you import) and the whole `overrides` from `vendor/xoong/consume.json` into your `package.json`
(the overrides make the packages find each other as tarballs instead of looking on the registry), and run `npm install`:

```json
{
  "dependencies": { "xoong": "file:./vendor/xoong/xoong-0.0.19.tgz", "@xoong/ui": "file:./vendor/xoong/xoong-ui-0.0.19.tgz" },
  "overrides": { "@xoong/core": "file:./vendor/xoong/xoong-core-0.0.19.tgz", "...": "every package listed in consume.json" }
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

Use `xoong build` (it needs only your project, no bundler): `xoong build --root . --out dist [--base /admin] [--include public]` (`--help` prints the options; unknown options are refused; an output folder inside the root is never read as input). It follows the
HTML pages, rewrites package imports to URLs (no import map), strips TypeScript, copies what is referenced, and prints the Content-Security-Policy
the output is tested with ([security.md](security.md)). Serve `dist` as static files, with the pages' routes answering the app's HTML if you use
`<xo-router>`. Nothing is minified or bundled yet: the files are the ones you wrote, and `dist/build-report.json` lists sizes (also gzipped).

## What a drop promises

Versions are `0.0.N`: anything can change between drops, and breaking changes are listed in `CHANGELOG.md` with migration notes.
Attributes already shipped in an earlier drop are changed only when marked as such there.
