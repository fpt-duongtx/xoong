---
name: icon-svg-pipeline
description: Where xoong icon SVGs live, what a valid source file looks like, and which commands generate and check everything. Use when adding, editing or removing an icon.
---

# SVG pipeline

Source of truth: `packages/icons/src/svg/<name>.svg` (outline) and `packages/icons/src/svg/fill/<name>.svg` (filled drawing, optional), plus an entry in `packages/icons/src/meta.json`: `"name": { "category": "arrows|actions|status|people|interface|content|communication", "tags": ["synonym", "..."] }` (tags are what the library search matches: add the words people would type).

Outline file, one line:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="..."/></svg>
```
Allowed elements: `path circle rect line polyline polygon ellipse g mask`. No `style`, `class`, scripts, text, images, `use`, `href`, event attributes (a strict CSP and a test reject them). Numbers stay within 0 to 24. Names: kebab-case, never `sm lg xl 2x 3x spin fw fill bold`.

Generate and check (generated files are committed, never edited by hand):
```bash
node tools/build-icons.mjs          # icons.json, icons.css, the Mist icon CSS, the blocks in controls.css / richtext.css / xoong.css, the library page data (run twice after adding an icon the first time)
node tools/kit-css.mjs && node tools/build-mist.mjs   # copy the kit CSS to the site and rebuild mist.css when design/brand-kit/css/icons.css changed
npx vitest run --project logic packages/icons test/mist.test.mjs
```
How it is used: `<i class="xi xi-name" aria-hidden="true"></i>`, `xi-fill`, `xi-bold`; the CSS is a mask made from the SVG, so colour is `currentColor` and size is `font-size`. A new name used by a control appears in that package's CSS block automatically (the scan reads `xi-<name>` in its sources).
