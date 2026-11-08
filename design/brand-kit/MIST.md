# Mist on xoong (reusing the Rainlet design system)

The xoong site uses the **Mist** design system made for Rainlet (owner: the Rainlet Designer session; source of truth: `fpt-duongtx/bloomoz`, `docs/design/admin-mist/`). The goal is that nothing is designed twice: tokens, rules and component manner come from Rainlet; xoong only adds what a documentation site and the xoong brand need.

## What is reused as is
| Rainlet file | Here | Use |
|---|---|---|
| `admin-mist.css` | `rainlet/admin-mist.css` (read-only copy) | The full design system with the `a-*` classes. Reference for components not yet in `mist.css`; the `:root` token block is copied verbatim into `css/mist-tokens.css`. |
| `DESIGN-BRIEF.md` | `rainlet/DESIGN-BRIEF.md` (read-only copy) | Every rule (one accent, 1px lines, 4px grid, 40/32 controls, 8/12 radius, toasts, tooltips, icon-first buttons, badges with glyphs, no colour-only status). |
| `brand/README.md` | `rainlet/brand-README.md` | Logo rules (tile, one blue, one ink, no gradients, smallest sizes). |
| Be Vietnam Pro 400/500/600 (OFL) | `assets/fonts/*.woff2`, `css/fonts.css` | Headings and brand surfaces (`--f-brand`). Source: npm `@fontsource/be-vietnam-pro` 5.3.0, Latin and Vietnamese subsets, self-hosted. |

Do not edit the copies in `rainlet/` or the light values in `css/mist-tokens.css`: change them upstream and re-copy.

## What xoong adds (agreed with the Mist owner)
- **Mist dark** (docs variant, derived): page `#121B22`, card `#1B2933`, sunken `#22313C`, text `#E8EEF2`, text-2 `#B4C2CD`, text-3 `#8FA0AD`, line `#2A3A46`, controls `#6B7D8A`, accent `#6AA8F0`, accent-strong `#9CC7F6`, tints `#16293B`/`#1F3A56`; ok `#5FC88F`, warn `#E0B04A`, danger `#F08A82`. The primary button fill stays `#0B63CE` with white text (`--primary`). No shadows in dark except floating things; borders instead.
- **Docs variant**: prose 16px/1.65, ~72ch, h1 40 / h2 28 / h3 20 at weight 600 (letter-spacing -0.01em); everything else as Mist admin.
- **The xoong logo in the Mist language** (`assets/mist/`, board `brand-mist.html`): the clay pot on the Mist tint tile, wordmark drawn with the round stroke, simple mark at 24px and below.
- **Calm and Ember** remain selectable palettes (`data-palette="calm|ember"`), and presets of the theme builder.

## Token map (Rainlet name -> xoong name -> framework token)
| Rainlet | xoong palette name | framework `--xo-*` |
|---|---|---|
| `--bg` | `--bg` | `--xo-color-bg` |
| `--card` | `--surface` | `--xo-color-surface` |
| `--sunken` | `--broth` | `--xo-color-subtle` |
| `--text` / `--text-2` / `--text-3` | `--text` / `--text-2` / `--muted` | `--xo-color-text` / `-text-2` / `-muted` |
| `--line` / `--line-strong` | `--line` / `--line-strong` | `--xo-color-border` / `--xo-color-control-border` |
| `--accent` | `--ember` `--ember-deep` | `--xo-color-accent` |
| `--accent-strong` | `--accent-strong` | `--xo-color-accent-strong` |
| `--accent-tint` | `--ember-soft` | `--xo-color-accent-soft` |
| (xoong) `--primary` | `--primary` | `--xo-color-primary` |
| `--ok` / `--warn` / `--danger` | `--herb` / `--sesame` / `--danger` | `--xo-color-success` / `-warning` / `-danger` |
| `--r` / `--r-lg` / `--h` | `--xo-radius` (8) / `--radius` (12) | `--xo-radius`, `--xo-control-height` (40) |
| `--shadow-float` | | `--xo-shadow-pop` |

## Load order
`fonts.css`, `mist-tokens.css`, `brand.css`, `xo-map.css`, `controls.css`, `icons.css`, `components.css`, `states.css`, `shell.css`, then `mist.css` last. (Font paths in `fonts.css` are relative to the css folder: `../assets/fonts/`.)

## Checked
axe (WCAG 2.1 AA) on 12 kit pages in Mist light, Mist dark, Calm light and Ember dark: 0 violations; no page scrolls sideways at 390px.

## For the Rainlet admin side: what xoong now provides (review and delete your duplicates)
Once xoong releases this kit, the Rainlet admin can stop carrying its own copy of anything xoong ships in the Mist look. Suggested audit (admin `a-*` class -> xoong equivalent):

| Admin (`a-*`) | xoong |
|---|---|
| `a-btn` (+ `--primary`, `--danger`, `--ghost`, `--sm`, `--icon`), `a-btn-group` | `button`, `.primary`, `.danger`, `.ghost`, `.sm`, `.icon-only`, `.button-group` (controls.css + mist.css) |
| `a-input`, `a-select`, `a-textarea`, `a-field`, `a-label`, `a-hint`, `a-err` | native fields + `.field`, `.hint`, `.error` |
| `a-badge`, `a-chip`, `a-count` | `.badge`, `.chip`, `.xo-count` |
| `a-tabs`, `a-seg` | `[role=tab]`, `.tabs-pills`, `.xo-seg` |
| `a-table`, `a-pager`, `a-bulk` | `table.std`, `.xo-table`, `.xo-pager`, `.table-bulk` |
| `a-menu`, `a-tip`, `a-toast`, `a-dialog`, `a-modal` | `xo-menu`, `.xo-tooltip`, `.xo-toast`, `xo-dialog`, `.xo-confirm` |
| `a-alert` | `.notice` |
| `a-toggle`, `a-range`, `a-stepper`, `a-otp`, `a-copy`, `a-acc`, `a-steps`, `a-avatar`, `a-cmd`, `a-choice`, `a-progress`, `a-skel`, `a-spin`, `a-opt`, `a-listbox`, `a-kbd`, `a-multi` | `.xo-switch`, `.xo-range`, `.xo-stepper`, `.xo-otp`, `.xo-copyfield`, `.xo-accordion`, `.xo-steps`, `.xo-avatar`, `.xo-command`, `.xo-choice`, `.xo-progress`, `.xo-skel`, `.xo-spinner`, `.xo-option`, `.xo-listbox`, `.xo-kbd`, `.xo-multi` (controls-new.css) |
| scrollbar rules | `.xo-scroll` |
| tokens (`--text`, `--bg`, `--card`, `--accent`, ...) | `css/mist-tokens.css`: the same block, plus dark |

What stays admin-only: sidebar and topbar shell, page header and Guide panel, the editors (blocks, rich-text chrome), media library, page tree and drag and drop, savebar, the Rainlet logo set.
Rule: tokens come from `mist-tokens.css`; a Mist component that exists in xoong is used from xoong, not re-implemented. Change a shared look upstream, once.
