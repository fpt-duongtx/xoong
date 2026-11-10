# ADR-0013: Row actions stay on screen in a narrow table

Status: Accepted

## Context

At a 390px width the actions cell of `<xo-table>` sits past the right edge of the frame, and a pointer drag across the table selects the cell text. The frame is `.xo-table` (`overflow-x: auto` in `packages/ui/src/xoong.css`). The actions are the last cell, `td.xo-actions`, with `white-space: nowrap`. The header for that column is a `th` whose only child is `.xo-visually-hidden`. Nothing pins that column, and nothing stops a drag from selecting text.

The rainlet repository that holds the full QA-3 write-up is not readable from this checkout. The behaviour above is the owner's statement of that item (rainlet PR #4, `docs/qa-report.md`, QA-3). QA-12 is a different change and is not part of this decision.

`@xoong/ui` is 13209 bytes gzip of the comment-stripped JavaScript, and the budget is 12.9 KB (13209.6 bytes). CSS is not in that figure. `mist.css` is generated from `design/brand-kit/css` and that kit is not part of this change. `<xo-table cards>` already asks a theme to stack rows; the default table stays a table.

## What the others do

| Library | How row actions stay reachable when the table is wider than the pane | How a drag avoids selecting text |
| --- | --- | --- |
| GitHub Primer DataTable | The overflowing table is wrapped in a focusable region (`role="region"`, `tabindex`) so a keyboard user can scroll to the actions ([primer/react#3030](https://github.com/primer/react/pull/3030)). The documented DataTable does not pin the actions column. | Not a selection mode. Scrolling the region is separate from selecting text. |
| MUI X Data Grid | Pro pins columns. `pinnedColumns: { right: ['actions'] }` keeps the actions column visible while the rest scrolls ([Column pinning](https://mui.com/x/react-data-grid/column-pinning/)). The free DataGrid does not pin. | A pointer drag adds `MuiDataGrid-root--disableUserSelection` on the root ([Data Grid API](https://mui.com/x/api/data-grid/data-grid/)). That class is applied from script. |
| Carbon | The core data table puts row actions in an overflow menu in the last column, and the table scrolls ([guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines)). The IBM Products Datagrid pins that column to the right and draws a 1px rule as the seam ([carbon-addons-iot-react#3636](https://github.com/carbon-design-system/carbon-addons-iot-react/issues/3636)). A sticky column that would cover the pane is unfrozen on a small screen. | Not suppressed on the core table. The pinned column is the reachability fix. |
| Shopify Polaris IndexTable | `condensed` replaces the row on a small screen and hides bulk actions under 490px ([Index table](https://polaris.shopify.com/components/tables/index-table)). The same component also has a sticky last column, which keeps that column in view without replacing the table. | Condensed layout is script and a different row. The sticky column is CSS. |
| Open Props, Pico | Open Props is custom properties and has no table. Pico's table is a semantic table at `width: 100%` ([Pico table](https://picocss.com/docs/table)). Neither pins a column or stops selection. | Neither. |
| modern-web-guidance | A scroll wrapper, a sticky header, and (optionally) a container-query card. Swipe-to-reveal is a two-column snap track per row, which needs markup the row does not have today. | Not specified. Swipe-to-reveal hides the actions until the row is dragged, which is a different control. |

## Decision

Do this in `xoong.css` only.

* Pin the actions cell and its header to the inline end (`position: sticky; inset-inline-end: 0`) with an opaque background and a 1px inline-start edge, so the buttons stay inside the frame and the cells that scroll under them do not show through. The table uses `border-collapse: separate; border-spacing: 0` so that edge stays with the cell (with `collapse`, the shared border can be left behind).
* While the pointer is down on the frame (`.xo-table:active`), set `user-select: none`. A field in the frame (`input`, `textarea`, `[contenteditable="true"]`) keeps `user-select: text`.

Not done, and why:

* A `pointermove` listener that turns selection off only after the pointer has moved, so a double-click can still select a word. Appended to the comment-stripped `@xoong/ui` sources (the budget's own measurement) that listener is 13323 bytes, 114 over the 13209 measured today and 113 over the 13209.6 budget.
* `tabindex="0"`, `role="region"` and a name on the frame, which is Primer's keyboard scrollport. The same measurement is 13226 bytes, 17 over today and 16 over the budget. With the actions pinned, the buttons are on screen and in tab order. The other columns still scroll with the pointer.
* Making `cards` the default, or a swipe-to-reveal row. Both change the markup or the layout of every table. Cards stay opt-in, drawn by the theme.
* Editing `design/brand-kit/**` or hand-editing `mist.css`. The framework rule is in an earlier cascade layer, so the Mist skin can still paint the header, the hover and the selected row. The card layout already puts the actions in the card.

## Consequences

The actions column stays at the inline end while the other columns scroll. A pointer drag across the table does not select text. Because the suppression is `:active`, a double-click on a cell does not select a word either. A field inside the table still does. An actions cell wider than the frame itself still overflows the frame; the column is only pinned, not shrunk.

This is a change to the default table. The user-facing rule is in [docs/admin.md](../admin.md).
