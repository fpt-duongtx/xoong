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
