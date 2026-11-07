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
