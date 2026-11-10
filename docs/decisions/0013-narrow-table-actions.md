# ADR-0013: Row actions stay on screen in a narrow table

Status: Accepted

## Context

Rainlet QA-3 (PR #4, `docs/qa-report.md`, round 1, commit `0ef186b`) says:

> Edit/Actions/Delete start outside the viewport inside a horizontal scroller. The row action is on screen, or a sideways drag reveals it.

The frame is `.xo-table` (`overflow-x: auto` in `packages/ui/src/xoong.css`). The actions are the last cell, `td.xo-actions`, with `white-space: nowrap`. The header for that column is a `th` whose only child is `.xo-visually-hidden`. At 390px that cell starts past the right edge of the frame.

Rainlet closed the item in round 2 by adding `cards` to the articles, pages and inbox tables. `<xo-table cards>` asks the theme to stack each row, so the actions sit in the card. This decision is the default table, the one without `cards`, so another app gets the same reach without that workaround. QA-12 is a different change and is not part of this decision.

`@xoong/ui` is 13209 bytes gzip of the comment-stripped JavaScript, and the budget is 12.9 KB (13209.6 bytes). CSS is not in that figure. `mist.css` is generated from `design/brand-kit/css` and that kit is not part of this change.

## What the others do

| Library | How row actions stay reachable when the table is wider than the pane | Text selection |
| --- | --- | --- |
| GitHub Primer DataTable | The overflowing table is wrapped in a focusable region (`role="region"`, `tabindex`) so a keyboard user can scroll to the actions ([primer/react#3030](https://github.com/primer/react/pull/3030)). The documented DataTable does not pin the actions column. | `user-select` is set on buttons and on pagination, not on the table. |
| MUI X Data Grid | Pro pins columns. `pinnedColumns: { right: ['actions'] }` keeps the actions column visible while the rest scrolls ([Column pinning](https://mui.com/x/react-data-grid/column-pinning/)). The free DataGrid does not pin. | `MuiDataGrid-root--disableUserSelection` is for Premium cell-range selection and the fill-drag handle. An ordinary pointer drag does not add it. |
| Carbon | The core data table puts row actions in an overflow menu in the last column, and the table scrolls ([guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines)). The IBM Products Datagrid pins that column to the right and draws a 1px rule as the seam ([carbon-addons-iot-react#3636](https://github.com/carbon-design-system/carbon-addons-iot-react/issues/3636)). A sticky column that would cover the pane is unfrozen on a small screen. | No `user-select` rule on the table. |
| Shopify Polaris IndexTable | `condensed` replaces the row on a small screen and hides bulk actions under 490px ([Index table](https://polaris.shopify.com/components/tables/index-table)). The same component also has a sticky last column, which keeps that column in view without replacing the table. | No `user-select` rule on the table. |
| Open Props, Pico | Open Props is custom properties and has no table. Pico's table is a semantic table at `width: 100%` ([Pico table](https://picocss.com/docs/table)). Neither pins a column. | Neither sets `user-select` on a table. |
| modern-web-guidance | A scroll wrapper, a sticky header, and (optionally) a container-query card. Swipe-to-reveal is a two-column snap track per row, which needs markup the row does not have today. | Not specified. Swipe-to-reveal hides the actions until the row is dragged, which is a different control. |

## Decision

Do this in `xoong.css` only. Do not suppress text selection. A double-click and a drag still select cell text, in every app. QA-3 asks for the row action to be on screen (or for a sideways drag to reveal it). Pinning does the first. Carbon and Polaris leave selection alone, and Primer's `user-select` is on buttons and pagination.

* Pin `td.xo-actions` and the actions header to the inline end (`position: sticky; inset-inline-end: 0`) with an opaque background and a 1px inline-start edge, so the buttons stay inside the frame and the cells that scroll under them do not show through. The header is `thead th:has(> .xo-visually-hidden)`, the cell that carries the "Actions" label, rather than whichever `th` is last. The table uses `border-collapse: separate; border-spacing: 0` so that edge stays with the cell (with `collapse`, the shared border can be left behind). The border is visible at every width.
* Set `scroll-padding-inline-end: 20rem` on a frame that has an actions cell. Focusing a control in the column beside the pinned cell then scrolls that control clear of the cell, left-to-right and right-to-left (WCAG 2.4.12). 20rem clears Edit, Actions and Delete (about 274px in `xoong.css`). `anchor-size()` would track the column's own width, and it is not used: anchor positioning is not in every browser this project supports ([browser-support.md](../browser-support.md)), and in this Chromium the function was dropped (`scroll-padding-inline-end` stayed `auto`). An actions cell wider than 20rem can still cover its neighbour. An unlayered rule can raise the padding.

Not done, and why:

* `tabindex="0"`, `role="region"` and a name on the frame, which is Primer's keyboard scrollport. Appended to the comment-stripped `@xoong/ui` sources (the budget's own measurement) that markup is 13226 bytes, 17 over the 13209 measured today and 16 over the 13209.6 budget. With the actions pinned, the buttons are on screen and in tab order.
* Making `cards` the default, or a swipe-to-reveal row. Both change the markup or the layout of every table. Cards stay opt-in. That is the workaround Rainlet shipped; this decision is for tables that do not set it.
* Editing `design/brand-kit/**` or hand-editing `mist.css`. The framework rule is in an earlier cascade layer, so the Mist skin can still paint the header, the hover and the selected row. The card layout already puts the actions in the card.

## Consequences

The actions column stays at the inline end while the other columns scroll. Cell text can be selected and copied. A focused control in the neighbouring column is scrolled clear of the pinned cell in both writing directions, unless the actions cell is wider than 20rem. An actions cell wider than the frame itself still overflows the frame; the column is only pinned, not shrunk.

This is a change to the default table. The user-facing rule is in [docs/admin.md](../admin.md).
