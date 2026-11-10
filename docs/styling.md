# Styling

Status: **Draft**. Package: `@xoong/ui` (`xoong.css`).

Principle: **CSS is CSS.** If you know CSS or SCSS, you already know xoong
styling. There is no utility-class vocabulary, no CSS-in-JS and no Shadow DOM.

## 1. Layers

`xoong.css` declares the cascade order once:

```css
@layer reset, tokens, base, components, app, overrides;
```

Your own styles go in `app` (or `overrides`). Because layer order beats
specificity, you never need `!important` or selector wars to override xoong.

## 2. Design tokens

Tokens are plain CSS custom properties on `:root`:

```css
:root {
  --xo-color-bg: #fff;
  --xo-color-fg: #111;
  --xo-color-accent: #0b5fff;
  --xo-space-1: .25rem;  --xo-space-2: .5rem;  --xo-space-3: 1rem;
  --xo-radius: .375rem;
  --xo-font: system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root { --xo-color-bg: #121212; --xo-color-fg: #eee; }
}
```

A brand is a small file that redefines tokens. A whole organization shares one
token file across every project; that is the intended reuse path.

## 3. Class and element conventions

* Component tags are the namespace: `xo-table`, `xo-dialog`.
* Inner parts use short, documented class names: `xo-table .head`, `.row`.
* State uses attributes, not modifier-class explosions: `[aria-selected]`,
  `[data-state="loading"]`.

## 4. Locality with `@scope`

Without Shadow DOM, locality comes from the platform:

```css
@scope (app-card) {
  .title { font-weight: 600; }
}
```

`xoong check` flags selectors that leak (bare element selectors in the `app`
layer outside an `@scope`).

## 5. SCSS

SCSS works as usual; compile it with any tool (or the optional `xoong build`).
Because everything resolves to custom properties and layers, SCSS is optional,
not required.

## 6. Native elements over widget libraries

| Need | Use |
|---|---|
| Modal | `<dialog>` |
| Menu / popover / tooltip | Popover API (+ anchor positioning where supported) |
| Disclosure / accordion | `<details>` |
| Select | native `<select>`; `xo-select` only when search/multi is required |

Each platform feature used by xoong lists its browser-support status in the
docs and its fallback, so a team can decide against its own browser matrix.

## 7. What xoong will not provide

* A utility-class system.
* A large pre-themed component catalog. The built-in set stays small and
  focused on admin needs: table, form, dialog, layout.

## Control size and state tokens

Buttons, fields and selects share one scale: `--xo-control-height` (2.5rem; `-sm` 2rem for toolbars and table rows, `-lg` 3rem), `--xo-control-padding`, `--xo-control-gap` between an icon and a label, `--xo-field-gap` between a label, a control and its hint, and `--xo-touch` (2.75rem) as the smallest comfortable target: on a touch layout set `--xo-control-height: var(--xo-touch)`. Edges use `--xo-color-control-border` (3:1 against the page, WCAG 1.4.11), the focus ring is `--xo-focus` (3px in the accent, which must reach 3:1 too). Neutral tokens for state colours: `--xo-color-accent-soft` (the current item, a selected row), `--xo-color-subtle` (table header, tab bar), `--xo-color-success`, `--xo-color-warning`, `--xo-color-danger`, `--xo-color-inverse` and `--xo-color-inverse-text` (tooltip, toast), `--xo-shadow-pop`.

Your own unlayered CSS always beats the framework's layers, which is the point, with one thing to know: a rule such as `button { ... }` also reaches the buttons the framework draws (the sort buttons in table headers, the chip close buttons). Scope your button styles (`.btn`, `:where()`), or restyle those few again.

## A look of your own, or a theme

The framework's files are in cascade layers; a stylesheet that restyles the components as a whole (this site's look is one) should be in a layer of its own, declared after them: `@layer xoong.tokens, xoong.base, xoong.components, xoong-controls, xoong-richtext, my-theme;`. Then your own unlayered CSS, and any theme in a later layer, always wins without specificity fights. Tokens work the same way: set `--xo-*` on `:root`, or on any element for a region (a token such as `--xo-color-accent` that you map from your own variable is resolved where it is declared, so map it on `:root`).

## The Mist look for an app: `@xoong/ui/mist.css`

One stylesheet, self-sufficient, that gives an app the Mist look (the Rainlet design system): the tokens (`--text`, `--card`, `--accent`, `--line`, ..., 40px controls, 8px and 12px radii) with a dark scheme (`prefers-color-scheme`, or `data-theme="dark"` / `"light"` on `<html>` to force one), the mapping of the framework's `--xo-*` tokens from them, and the look of the buttons, fields, form rhythm (`.xo-form`, `.xo-fields`), badges and chips, tabs, the segmented control (`.xo-seg`), menus, tooltips, toasts, dialogs (`dialog.xo-modal`), tables (and `<xo-table cards>` as row cards under 768px), notices, skeleton/empty/error states and the controls of the Mist spec. It has none of a page's chrome (no header, shell, hero or prose styles).

```html
<link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
<link rel="stylesheet" href="/@xoong/controls/controls.css">
<link rel="stylesheet" href="/@xoong/richtext/richtext.css">
<link rel="stylesheet" href="/@xoong/ui/src/mist.css">   <!-- last: nothing else is needed -->
```

It is one cascade layer (`xoong-mist`, after the framework's), so your own CSS wins. The icons are CSS masks made of `data:` images (`--ic-grid`, `--ic-file`, `--ic-layers`, `--ic-sliders` among them): a strict CSP needs `img-src 'self' data:`. A button's centering, `white-space: nowrap` and 40px minimum live on `:where(button:not([role="switch"]))` (the same exclusion is in `xoong.css` for the minimum), so a switch keeps the height it sets and any rule of yours (even `button { min-height: 0 }` in the same layer) can opt out; the rest of the button look stays on `button`. The app shell (`.xo-app`) does not wrap: from 768px the sidebar stays beside the main column. The file is generated from the design kit (`node tools/build-mist.mjs`) and a test keeps it in step; the kit's `MIST.md` has the token map and the table of Rainlet admin classes and their xoong equivalents.
