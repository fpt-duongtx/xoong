# xoong brand kit (design handoff)

Input for the dev side: static **HTML, CSS and assets**. Nothing here is wired into `site/` or `tools/site`. Take what you need and rebuild it with xoong's own elements and tokens.

Open `index.html`, `docs.html` and `brand.html` directly in a browser (no build, no server).

## Files

| Path | What |
|---|---|
| `index.html` | Home: hero with the pot, ingredient cards, stat band, recipe steps, call to action |
| `docs.html` | One documentation page in the brand (sidebar, callout, code tabs, table, pager) to judge long reading |
| `brand.html` | Brand guide: logo, colour, type, voice, downloads |
| `css/brand.css` | All styles. Tokens at the top; everything below reads them |
| `js/palette.js` | Reference only: toggles `<html data-palette="ember">` (replace with `xo-menu` + CSSOM) |
| `assets/` | `mark.svg`, `mark-reverse.svg`, `mark-mono.svg`, `favicon.svg`, Ember variants (`*-ember*.svg`), `lockup.png`, `og.png` |

## Identity in one paragraph

*Xoong* is the Vietnamese word for a saucepan. The mark is a two-handled pot whose steam is a pair of angle brackets. Tagline: **One pot. Whole app.** Wordmark: lowercase `xoong`, weight 800, tracking −0.045em (system fonts only, no font files). Voice: practical, warm, a little cheeky.

## Palettes = token overrides

**Calm** is the default (`:root`), **Ember** is `:root[data-palette="ember"]`. A palette is only values for these custom properties:

`--ember` (the pot) · `--ember-deep` (text-safe accent) · `--ember-soft` · `--bg` · `--surface` · `--broth` · `--text` · `--muted` · `--line` · `--herb` · `--sesame` · `--glow` · `--dots` · `--soot` · `--rice`

The CSS also sets the xoong tokens from the brand ones, so the real components pick the palette up:
`--xo-color-bg/surface/text/muted/border/accent/accent-text`, `--xo-radius`, `--xo-font`, `--xo-font-mono`.

Suggested mapping when you rebuild on `--xo-*`: `--bg`→`--xo-color-bg`, `--surface`→`--xo-color-surface`, `--text`→`--xo-color-text`, `--muted`→`--xo-color-muted`, `--line`→`--xo-color-border`, `--ember-deep`→`--xo-color-accent`. Keep `--ember` (pot), `--glow`, `--ember-soft`, `--sesame`, `--herb` as small `--brand-*` extras.

## The logo follows the palette

The mark is inline SVG with classes `.m-ink` (text colour), `.m-body` (`--ember`), `.m-hi` (page background) and `.m-steam`. Steam animates only with `.mark.steam`, and not under `prefers-reduced-motion`. The files in `assets/` are fixed colour (Calm by default).

## Where the design is hand-built but xoong has an element

Replace these with the xoong piece (my sketch is only the look):

| Here | In xoong |
|---|---|
| `.palette-toggle` button | `<xo-menu>` with Calm / Ember items, `xo-tooltip` as the hint |
| `.tabs` in `docs.html` | `<xo-tabs>` |
| `table.data` | plain table is fine for static docs; `<xo-table>` for data |
| `.btn`, `.btn.primary` | native `<button>` / `button.primary` on `--xo-*` tokens |
| `.window` code card | the code block (highlighted at generation time) |

## Constraints respected

No inline `<script>` or `<style>`, no `style=""` attributes, no web fonts, no external requests. The only script is `js/palette.js`.

## Open question for the dev side

Pages are off for now and the domain is undecided, so the wordmark is just `xoong` (no `.dev`).

## Update: states, 404, social cards, contrast (branch `ux/states-404-social`)

- `states.html`: card hover/focus/active; code tabs; carousel (cards + arrows, dots, thumbnails, counter); loading skeleton, empty state and error state for the data demos; mobile note.
- `404.html`: the Pages not-found page. `docs.html` now has the mobile **Menu** disclosure (`<details class="docs-menu">`, shown below 52rem, sidebar hidden).
- `assets/og-guides.png`, `og-controls.png`, `og-demo.png`, `og-brand.png` (1200x630, one per section) next to `og.png`.
- Contrast (checked with a script for Calm/Ember x light/dark): Calm `--muted` light is now `#675f56`; new `--line-strong` (control borders, 3:1) and `--danger` tokens in both palettes; the focus ring and the selected-tab underline use `--ember-deep` instead of `--ember`, because the pot colour is only 2.4:1 on Paper (a focus indicator needs 3:1). `--ember` stays a fill/decoration colour, never text or a lone indicator.
- Please take the same ring colour on the site (`@layer xoong.base { :focus-visible { outline: 3px solid var(--ember-deep) } }`).

## Update 3: fluid shell, controls standard, icons (branch `ux/fluid-shell-controls-icons`)

Split proposed to the dev (framework vs site-only):

| File | Goes where | What |
|---|---|---|
| `css/controls.css` | **framework candidate** (controls.css / xoong.css) | height scale (`--xo-control-h`, `-sm`, `-lg`), padding, gap, `--xo-control-border` (3:1), `--xo-ring`; buttons (default/primary/danger/ghost, sm/lg, icon-only, group; hover/focus/active/disabled/busy), inputs/select/textarea/checkbox/radio, `.field` (label, control, hint/error), badge, chip, toolbar, tabs (underline + pills), menu panel, tooltip, table (`table.std`), notices, toast, `.icon` |
| `assets/icons.svg` | **framework candidate** | 45-icon sprite on a 24px grid, 1.75 stroke, round, `currentColor`; use `<svg class="icon"><use href="#name"/></svg>` |
| `css/shell.css` | **site/demo only** | fluid page shell (nav \| content \| right rail; no max-width; container queries inside the content), the demo frame (`.example`: tab bar, dotted preview, code panel), people cards, std/icon sheets |
| `css/brand.css` | **site only** | palettes, hero, cards, brand page |

Pages: `docs.html` is now the fluid shell sample (left nav, full-width content, right rail "On this page", demo frames, standard table and form); `components.html` shows every control and state; `icons.html` shows the set and the rules. The `.is-hover/.is-focus/.is-active` classes only exist to display states statically.
Fixes found on the live site: nested tab bars with a different look, form fields of different heights, plain vs primary save buttons, tiny badges, glyph icons in the rich-text toolbar and row buttons, empty space right of a 50rem column.

## Update 4: the full component standard + a demo of every control

- `css/components.css`: the standard look of the DOM the framework really renders (`xo-tabs`, `xo-menu`, tooltip, `xo-combobox`/`xo-tags`, `xo-carousel`, `.xo-table`/`.xo-filters`/`.xo-bulk`/`.xo-pager`, `.xo-form`/`.xo-field`/`.xo-array`/`.xo-row`/`.xo-handle`, `xo-dialog`, `.xo-confirm`, `.xo-toast`, `xo-richtext`). It was checked against the real components: I built the current site and loaded these files over it (forms, data, carousel, combobox, rich text pages), and fixed what broke (framework `all: unset` on sort buttons, `[hidden]` toasts, the carousel play/pause glyph).
- `css/icons.css`: the 45 icons as CSS masks (`--ic-<name>` custom properties + `.ic`). This is how glyphs the framework draws itself (carousel arrows, rich-text toolbar faces `B I U • 1. “ 🔗 🖼 ↶ ↷ ⋯`, sort arrows, chip close, drag handle, error mark, menu check) become icons without changing a line of JS. `data:` images are allowed by the strict CSP.
- `css/controls.css` now also defines the two tokens it needs (`--line-strong`, `--danger`), so it stands alone.
- `css/xoong/*`: a snapshot of the framework CSS (`xoong.css`, `controls.css`, `richtext.css`) so the static kit pages render like the real site. Delete it when you wire these into the site; it only exists for `file://` preview.
- `controls-demo.html`: every control, filled with realistic content, in the demo frame: tabs (underline + `.tabs-pills`), menu and tooltip (open state), combobox and tags (open list), carousel (cards, banner, thumbnails), data table, form, rich text, dialog, confirm, toast. The markup inside each frame is what the framework renders, copied from the live pages; replace it with the real element and logic, the look stays.
- Class-name note: the pill tabs class is `tabs-pills` (`pills` is taken by the hero chips in `brand.css`).
- For the dev: `site.css` has `xo-tabs.code-tabs [role="tablist"]` rules that also hit nested tabs (the "Written by hand" form demo); scope them with `>` so nested tab bars use the standard look.

## Update 5: framework-ready tokens (the dev's naming)

`controls.css` and `components.css` now use only `--xo-*` tokens, no brand colours: `--xo-control-height` (+ `-sm`, `-lg`), `--xo-control-padding`, `--xo-color-control-border`, `--xo-focus` (3px proposal), `--xo-touch` (44px option: `.touch`), `--xo-radius`, plus the new colour tokens listed at the top of `css/xo-map.css` (`--xo-color-accent-soft`, `-subtle`, `-success`, `-warning`, `-danger`, `-inverse`, `-inverse-text`). `xo-map.css` maps them to the Calm/Ember palettes. Brand flourishes (offset shadows on carousel arrows and the primary button) moved to the end of `shell.css`. Icons: ids are kebab-case; one path or a few primitives, `fill: none`, stroke only (dots are tiny stroked circles); added `pause`, `play`, `heading`, `paragraph`; `external` is now `external-link`.

## Update 6: Mist (the Rainlet design system) on xoong

The user asked to reuse the Rainlet/Mist design (owner: the Designer session) and keep the xoong pot logo. What changed in the kit:

- **Palette**: `brand.css` now defines **Mist** as the default (light and a derived dark, approved by the Mist owner); **Calm** and **Ember** stay as selectable palettes (`data-palette="calm|ember"`). New palette vars: `--text-2`, `--accent-strong`, `--primary` / `--primary-text` (the fill of the primary button; stays #0B63CE in dark). `xo-map.css` maps them to `--xo-color-primary`, `--xo-color-primary-text`, `--xo-color-accent-strong`, `--xo-color-text-2`, and `--xo-radius` is 8px.
- **Skin**: `css/mist.css` (load it last): 14px Mist controls (40/32), grey page, white 12px cards with one 1px line, accent tint + accent text + 3px bar for the current item, glyph badges (diamond, dot, square, triangle), tinted notices without frames, floating things with the soft float shadow, segmented control for `.tabs-pills`, sentence-case table headers, tooltips in ink, toasts as white cards; landing page without the heavy blocks. Docs variant: prose 16px/1.65, h1 40 / h2 28 / h3 20 at weight 600.
- **Logo**: `assets/mist/*` and `brand-mist.html` (option B chosen by the user: the clay pot on the Mist tint tile, wordmark drawn with the round stroke, simple mark at 24px and below). Headers use `xoong-lockup.svg` (`xoong-lockup-dark.svg` in dark).
- **Checks**: axe (WCAG 2.1 AA) on 12 kit pages in Mist light, Mist dark, Calm light and Ember dark: 0 violations; no page scrolls sideways at 390px. Not yet run on the built site (needs your layer and the palette menu wiring).
- **Palette menu**: Mist (default, current mark), Calm, Ember; localStorage key `xoong-palette`, values `mist|calm|ember`.

## Update 7: new controls (UI only), from the Rainlet design

`controls-new.html` + `css/controls-new.css` (Rainlet's control CSS, `a-*` renamed `xo-*`, on `--xo-*` tokens) + `js/controls-new-demo.js` (demo behaviour only) + `CONTROLS-SPEC.md` (proposed elements, keyboard, ARIA, value and events for 25 controls: switch, radio cards, slider, range slider, stepper, date, date range, time, password, one-time code, copy field, textarea counter, inline edit, search with filters, button group, split button, toggle, busy button, spinner/skeleton/progress, steps, accordion, avatars, command palette, scrollbars). Load `controls-new.css` after `states.css`.
