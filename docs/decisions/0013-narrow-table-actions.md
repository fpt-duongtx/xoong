# ADR-0013: Row actions stay on screen in a narrow table

Status: Accepted

## Context

Rainlet QA-3 (PR #4, `docs/qa-report.md`, round 1, commit `0ef186b`) records these two cells:

Actual: Edit/Actions/Delete start outside the viewport inside a horizontal scroller.

Expected: The row action is on screen, or a sideways drag reveals it.

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

* Pin `td.xo-actions`, `th.xo-actions` and the generated actions header to the inline end (`position: sticky; inset-inline-end: 0`) with an opaque background and a 1px inline-start edge, so the buttons stay inside the frame and the cells that scroll under them do not show through. The generated header matches `thead th:last-child:has(> .xo-visually-hidden)`: it is last, and its child is the visually hidden "Actions" label. A hand-written table uses `th.xo-actions`, so the pin does not depend on that header being last. A header that contains a hidden child but is not last, and is not `th.xo-actions`, is not pinned. The table uses `border-collapse: separate; border-spacing: 0` so that edge stays with the cell (with `collapse`, the shared border can be left behind). The border is visible at every width.
* Set `scroll-padding-inline-end: min(var(--xo-table-actions-size, 20rem), 40%)` on a frame that has an actions cell. `--xo-table-actions-size` defaults to 20rem, and the 40% cap keeps the padding smaller than the frame. A flat 20rem is 320px; at 390px the frame is about 372px, so the padded viewing area was about 52px and tabbing left cells partly hidden. Focusing a control in the neighbouring column scrolls it into the remaining area, in either writing direction (WCAG 2.4.12). A control in the actions cell (`td.xo-actions *`) has `scroll-margin-inline-end: -100vw`. The pinned cell sits inside the padding zone, and without that margin Chromium scrolls the frame when the action is focused or clicked (Firefox does not). `anchor-size()` would track the column's own width, and it is not used: anchor positioning is not in every browser this project supports ([browser-support.md](../browser-support.md)), and in this Chromium the function was dropped (`scroll-padding-inline-end` stayed `auto`). An actions column wider than the used padding can still cover its neighbour. Set `--xo-table-actions-size` (the cap still applies), or raise the padding with an unlayered rule.

Not done, and why:

* `tabindex="0"`, `role="region"` and a name on the frame, which is Primer's keyboard scrollport. Appended to the comment-stripped `@xoong/ui` sources (the budget's own measurement) that markup is 13226 bytes, 17 over the 13209 measured today and 16 over the 13209.6 budget. With the actions pinned, the buttons are on screen and in tab order.
* Making `cards` the default, or a swipe-to-reveal row. Both change the markup or the layout of every table. Cards stay opt-in. That is the workaround Rainlet shipped; this decision is for tables that do not set it.
* Editing `design/brand-kit/**` or hand-editing `mist.css`. The framework rule is in an earlier cascade layer, so the Mist skin can still paint the header, the hover and the selected row. The card layout already puts the actions in the card.

## Consequences

The actions column stays at the inline end while the other columns scroll. Cell text can be selected and copied. Focusing or clicking a pinned action does not move the frame. A focused control in a neighbouring column is scrolled into the padded area in both writing directions. The padding is `min(var(--xo-table-actions-size, 20rem), 40%)`, so a 390px frame does not collapse to a sliver. An actions column wider than that padding can still cover its neighbour. An actions cell wider than the frame itself still overflows the frame; the column is only pinned, not shrunk.

This is a change to the default table. The user-facing rule is in [docs/admin.md](../admin.md).
