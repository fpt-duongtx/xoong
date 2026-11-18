# @xoong/icons

The xoong icon set: rounded icons on a 24px grid in three weights (regular, fill, bold), used as `<i class="xi xi-edit">` through CSS masks. Size follows `font-size`, colour follows `currentColor`, nothing is text. A small tool writes the stylesheet for only the icons a project uses. No dependencies.

## Install

```bash
npm install @xoong/icons
```

## Use

```html
<link rel="stylesheet" href="/@xoong/icons/icons.css">   <!-- the whole set; see the subset command below -->
<i class="xi xi-edit" aria-hidden="true"></i>             <!-- regular -->
<i class="xi xi-fill xi-edit xi-lg" aria-hidden="true"></i>  <!-- filled, 1.25em -->
<i class="xi xi-bold xi-spin xi-2x xi-fw xi-settings" aria-hidden="true"></i>
```
Modifiers: `xi-sm`, `xi-lg`, `xi-xl`, `xi-2x`, `xi-3x`, `xi-fw` (fixed width), `xi-spin`; variants `xi-fill` and `xi-bold`. The old `<span class="ic" data-ic="edit">` keeps working.

Keep only what a project uses (a set of hundreds should not cost hundreds of kilobytes):

```bash
npx xoong-icons --scan src --scan index.html --out public/icons.css
npx xoong-icons --scan src --include star,heart   # names the scan cannot see (built at run time)
npx xoong-icons --list
```
The scan reads `xi-<name>`, `data-ic="<name>"` and `var(--ic-<name>)`, and adds the fill and bold weights only when `xi-fill` / `xi-bold` appear.

The set is also data: `import { names, icons, svgOf, buildCss, scan } from '@xoong/icons'` (the SVG of any icon, or the CSS for a list of names). The SVG files are the source: `src/svg/<name>.svg` (outline) and `src/svg/fill/<name>.svg`.

## More

* Documentation, guides and live demos: https://fpt-duongtx.github.io/xoong/
* Source: https://github.com/fpt-duongtx/xoong/tree/main/packages/icons
* All packages share one version number and are released together: https://github.com/fpt-duongtx/xoong/releases
* xoong is a working prototype (0.0.x): the HTML syntax is still Draft.

MIT licence.
