# Live demos: live-admin.html and live-landing.html

Two pages built only from the Mist kit, to find what every project needs and the kit still lacks. Open them from a static server (or the file). `js/live-demo.js` is demo behaviour only; the numbers in the pages are fake.
`css/demo-pages.css` holds the new patterns (plain CSS, `--xo-*` tokens, no `@layer`). Regenerate nothing by hand: the pages are plain HTML.

## What the pages show
- **Admin**: shell, dashboard (KPI tiles, bar chart with a table fallback, activity feed), articles (filter, search, sort, select, bulk bar, pagination, confirm delete, editor modal with validation), settings (switches, dropzone), command palette (Cmd/Ctrl+K), notifications popover, toasts, dark toggle.
- **Landing**: nav with mobile drawer, hero with product shot, logo strip, feature grid, pricing with monthly/yearly toggle, testimonial carousel, FAQ, signup with validation, cookie banner, footer.

Checks: axe 0 violations (light and dark, both pages), no sideways scroll at 390px, 20 interaction checks pass. Not run: repo `npm test`, the built-site gates.

## Gaps found: UI is done here, logic is the dev's
| Need | UI in the kit | Wanted from dev |
|---|---|---|
| Toast stack | `.xo-toasts` + `.xo-toast` | `xo-toast` API: `toast(msg, {kind, action})`, region with `aria-live`, auto-dismiss, pause on hover/focus |
| Chart | `.xo-chart` (SVG bars/line, table fallback) | `xo-chart` from data (`<xo-chart type="bar" data="{rows}">`), keyboard focus on bars, table fallback generated |
| KPI tile | `.xo-kpi` (+ sparkline) | optional `xo-stat` (value, delta, trend, sparkline from series) |
| Data table behaviour | `table.std` + `.xo-cards`, sort buttons, bulk bar | `xo-table` sort, select, bulk-action slot, pagination, empty state (partly exists) |
| Notifications / popover | `.xo-popover`, `.xo-notify` | `xo-popover` (anchor, Escape, outside click, focus return) |
| Command palette | `.xo-command` + `.xo-listbox` | `xo-command` (global shortcut, filter, arrows, run) |
| Dropzone | `.xo-dropzone` | `xo-file` (drag and drop, click, accept, size limit, preview, progress) |
| Confirm dialog | `dialog.xo-modal` | `xo-dialog` confirm helper returning a promise |
| Pricing/billing toggle | `.xo-seg` | nothing new; plain `xo-seg` logic |
| Carousel for quotes | buttons + counter | reuse `xo-carousel` |
| FAQ | `details` | `xo-accordion` (already planned) |
| Cookie consent | `.lp-cookie` | `xo-consent` (categories, persistence, reopen) |
| Theme toggle | `data-theme` on html | `xo-theme-toggle` (persist, follow system) |
| Form validation messages | `.field .error` | `xo-form` shows errors, focuses the first invalid field |
| Skip link | `.xo-skip` | include in the shell layout |
