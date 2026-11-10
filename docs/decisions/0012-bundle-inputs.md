# ADR-0012: A bundle deletes a module by the URL it was copied to

Status: Accepted

## Context

`xoong build --bundle` copies the module graph, then asks the project's esbuild to bundle the page entries and deletes the copies the bundle replaces. A worker, a file fetched by URL, or a file named with `--include` is not a bundle input and has to stay ([consuming.md](../consuming.md)).

esbuild's metafile lists each input by its path on disk, relative to the project. That path is not the URL the build copied the file to:

* In this repository the packages are linked, and esbuild reports the real path: `../../../packages/ui/src/router.js`.
* In an installed app it reports the path under `node_modules`: `node_modules/@xoong/ui/src/router.js`.

Neither equals `/@xoong/ui/src/router.js`, which is the name in the output. Comparing the two strings deletes nothing, so the package sources are shipped beside the bundle.

The documented app also imports `/.xoong/operations.json`. esbuild treats a specifier that starts with `/` as a path from the filesystem root, so the bundle fails with `Could not resolve "/.xoong/operations.json"`. The build then warned and wrote the unbundled copies, and the command exited 0.

`@xoong/data` sets `"sideEffects": false`. esbuild then drops `import '@xoong/data/view'` and the side-effect import of `options.js` inside that file, so `define('xo-view')` and the `options-op` listener never run. The other runtime packages were checked. `@xoong/core` is also `sideEffects: false`, and that is right: its entries only export functions, and `define()` registers an element when called. `@xoong/forms`, `@xoong/i18n`, `@xoong/ui`, `@xoong/controls` and `@xoong/richtext` are `sideEffects: true`, because importing them registers behaviour.

## Decision

Map each metafile input back to an output URL. Resolve the reported path against the project, then use the same package directories the build already uses to name a copied file (`/@xoong/ui` plus the path inside that package, in the repository and under `node_modules`). A `.ts` input is the `.js` file that was written. Delete a copied script only when that URL matches. CSS is not a script and stays.

A root-absolute import that names a file in the project (including `/.xoong/operations.json`) is handed to esbuild as that file, so the JSON is bundled instead of looked up from the filesystem root.

When esbuild is not installed, the build warns and copies every module. xoong does not depend on esbuild, and that warning is the documented result. When esbuild is installed and the bundle fails, the build throws and writes nothing: a warning plus the unbundled files exits 0, which hides a broken bundle.

`@xoong/data` lists `src/view.js` and `src/options.js` as the files with side effects. The rest of that package stays free of them, so an import of the client can still be tree-shaken.

## Consequences

+ The benchmark screen's bundle no longer carries a copy of every package module it folded in.
+ `import '@xoong/data/view'` still defines `<xo-view>` after a bundle, and `options-op` still listens.
+ A failed bundle fails the command.
- An app that imported `/.xoong/operations.json` and relied on the unbundled fallback now has to fix the import or install a working esbuild. The file is still published at `/operations.json` and `/.xoong/operations.json`.
