# ADR-0013: A table column sticks only when the author opts in

Status: Accepted

## Context

Rainlet QA-3 (PR #4, `docs/qa-report.md`, round 1, commit `0ef186b`) records these two cells:

Actual: Edit/Actions/Delete start outside the viewport inside a horizontal scroller.

Expected: The row action is on screen, or a sideways drag reveals it.

The frame is `.xo-table` (`overflow-x: auto` in `packages/ui/src/xoong.css`). The actions are the last cell, `td.xo-actions`, with `white-space: nowrap`. At 390px that cell starts past the right edge of the frame.

Rainlet closed the item in round 2 by adding `cards` to the articles, pages and inbox tables. `<xo-table cards>` asks the theme to stack each row, so the actions sit in the card. That remains the narrow-screen answer. This decision does not pin the actions column on every table. With no sticky class, the table matches `main` at `0be00e5`: no pinned column, no scroll padding, no scroll margin, and no seam border from this change. QA-12 is a different change and is not part of this decision.

`@xoong/ui` is 13209 bytes gzip of the comment-stripped JavaScript, and the budget is 12.9 KB (13209.6 bytes). CSS is not in that figure. `mist.css` is generated from `design/brand-kit/css` and that kit is not part of this change.

## What the others do

| Library | How a column is pinned | How many, and which edge | Header, border, shadow |
| --- | --- | --- | --- |
| AG Grid | `pinned: 'left'`, `'right'`, or `true` (`true` means left) on the column definition. `initialPinned` is the same, applied only when the column is created. | Several columns on each side. Left and right are physical. | The header is pinned with the column. The pinned block is its own section, with a rule at the seam. |
| MUI X Data Grid (Pro) | `pinnedColumns: { left: ['name'], right: ['actions'] }`, or `pinColumn(field, side)`. | Several field names on each side. Left and right are physical. | The header cell is pinned with the body cell. The outer pinned cell gets a shadow. Offsets are computed in script. |
| TanStack Table | v8 state is `columnPinning: { left, right }`. v9 uses `start` and `end` only (`column.pin('start' \| 'end')`). The library does not write CSS. | Several columns on each side. v9 is logical. | The app sets `position: sticky` and `inset-inline-start: column.getStart('start')` or `inset-inline-end: column.getAfter('end')`. Those numbers are the widths of the columns already pinned on that side. A shadow goes on the last column of the group (`getIsLastColumn` / `getIsFirstColumn`). |
| GitHub Primer DataTable | No column-pinning prop. The overflowing table sits in a focusable region so a keyboard user can scroll to the actions. | None. | No pinned-column border. |
| Carbon | The core data table has `stickyHeader` and does not pin a column ([carbon#13874](https://github.com/carbon-design-system/carbon/issues/13874)). IBM Products Datagrid sets `sticky: 'left' \| 'right'` on a column. | One side or both, by column. Left and right are physical. | The products grid draws a 1px rule at the seam. |
| Cloudscape Table | `stickyColumns={{ first: 1, last: 1 }}`. `first` and `last` are counts of leading and trailing columns. The feature turns off when the scrollable area is below an internal threshold. | Several, by position rather than by id. | The header sticks with the column. The sticky edge uses a shadow. Widths are measured in script. |
| Open Props, Pico | Neither pins a column. | None. | None. |

## Focus under a sticky column

A browser scrolls a focused element when its border box lies outside the scrollport. It does not scroll an element that is already inside the frame and painted over by a sticky column. `scroll-padding` does not change that. In an 8-column table at 390px whose actions cell is wider than the open space, Chromium and Firefox leave cells that sit inside the frame overlapping that cell, including links that are entirely under it.

Libraries that clear the overlap do it in script. AG Grid skips `ensureColumnVisible` for a pinned column and scrolls a sticky row itself. MUI changed `useGridScroll` so the viewport accounts for pinned columns ([mui/mui-x#14545](https://github.com/mui/mui-x/issues/14545)). TanStack only supplies offsets; an app that keeps the focused cell clear calls `focus({ preventScroll: true })` and adds the pinned width itself. Primer does not pin. Cloudscape leaves keyboard focus to the browser.

That script does not fit here. A pointer listener measured 13323 bytes gzip. `tabindex="0"` and `role="region"` measured 13226. Both are over the 13209 measured today. This decision does not add scroll padding, a scroll margin, or any other rule that changes how the frame or an ancestor scrolls. WCAG 2.2 SC 2.4.11 (Focus Not Obscured, Minimum) is the documented risk: a sticky column can cover a focused cell. Keep the sticky column narrow, or use `cards` on a narrow pane, which is how Rainlet closed QA-3.

A negative scroll margin was tried on an earlier revision (`scroll-margin-inline-end: -100vw`, and a `40cqi` cancel the size of a padding band). One margin applies to every ancestor scroller, so the page and a nested wrapper then leave the focused control off-screen. Those rules are not part of this decision.

## Decision

Do this in `xoong.css` only. Do not suppress text selection. Do not change scrolling for the cells that are not sticky: they move with the table, as they do on `main`.

* The opt-in is a class on the header and on each cell of that column. `xo-sticky-start` uses `position: sticky; inset-inline-start: 0`. `xo-sticky-end` uses `position: sticky; inset-inline-end: 0`. Logical insets follow the writing direction, so right-to-left mirrors both. The cell has an opaque background and a 1px border on the edge that meets the scrolling cells (`border-inline-end` for start, `border-inline-start` for end), and `z-index: 1`, so the cells that scroll under it do not show through. A frame that has either class sets `border-collapse: separate; border-spacing: 0` on its table, because a collapsed border does not stay with the sticky cell. A frame with neither class keeps `border-collapse: collapse`, as on `main`.
* One column per side. A second cell with the same class uses the same inset and paints on top of the first. Stacking would need the width of the column already stuck, and this stylesheet does not know that width. `anchor-size()` is not used: anchor positioning is not in every browser this project supports ([browser-support.md](../browser-support.md)). TanStack, MUI, AG Grid and Cloudscape measure those widths in script.
* `<xo-table>` does not add the class. The smallest change that would, a fourth `:` part on `columns` (`field:Label:format:start`), is 13233 bytes gzip of the comment-stripped `@xoong/ui` sources: 24 over the 13209 measured today, and past the 13209.6 budget. A `pin="name:start,actions:end"` attribute, which would also mark the generated actions cell, measured 13262. Neither is added. A generated column sticks when the table is written by hand (`xo-each`, or a `.xo-table` of your own) and the class is on that column's `th` and `td`. The same classes are the whole API. The actions cell is not sticky unless it carries one.

Not done, and why:

* Pinning `td.xo-actions` on every table. That was the first cut of this change. The owner chose an opt-in instead, so a table that does not ask for a sticky column matches `main`.
* Scroll padding or a scroll margin, to pull a focused neighbour out from under the sticky column or to stop the frame moving. Both change scrolling for every ancestor, which is the bug the padding band introduced. The overlap is documented, not scripted around.
* `tabindex="0"` and `role="region"` on the frame. 13226 bytes, over the budget. Cards stay opt-in.
* Editing `design/brand-kit/**` or hand-editing `mist.css`.

## Consequences

A table with no sticky class scrolls as it does on `main`, including the actions column. A column marked `xo-sticky-start` or `xo-sticky-end` stays at that edge while the other columns scroll under it, in either writing direction. The header sticks when it has the same class. Focusing or clicking a control in the sticky column does not move the frame, because the sticky box is already inside it and this CSS adds no scroll padding. A focused cell in another column can sit under the sticky column (WCAG 2.2 SC 2.4.11). Two sticky columns on one side share one edge.

The user-facing rule is in [docs/admin.md](../admin.md).
