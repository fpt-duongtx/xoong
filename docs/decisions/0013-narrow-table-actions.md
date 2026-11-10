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

## Focus under a sticky column

A browser scrolls a focused element when its border box lies outside the scrollport. It does not scroll an element that is already inside the frame and painted over by a sticky column. `scroll-padding` does not change that. In an 8-column table at 390px whose actions cell is Edit, Actions and Delete, Chromium and Firefox leave cells that sit inside the frame overlapping that cell, including links that are entirely under it, with the padding at 0 and with it at `min(20rem, 40%)`.

Libraries that do clear the overlap do it in script:

* AG Grid skips `ensureColumnVisible` when `column.isPinned()`, and it scrolls a sticky row itself because the browser's focus scroll can hide the cell (`navigationService.ts`).
* MUI X Data Grid changed `useGridScroll` so the viewport it scrolls inside accounts for pinned columns. Keyboard navigation was scrolling unpinned cells under the pinned ones when those columns took half the viewport ([mui/mui-x#14545](https://github.com/mui/mui-x/issues/14545)).
* TanStack Table only sets the sticky offset. Apps that keep the focused cell clear of a pinned group call `focus({ preventScroll: true })` and add the pinned width in script.
* Primer's DataTable does not pin the actions column. Its focusable region scrolls the whole table.
* Carbon's core data table does not pin the row-actions column. Cloudscape records the same Chrome behaviour (focus inside a sticky column scrolls the table) and leaves keyboard focus to the browser.

That script does not fit here. The measured `@xoong/ui` JavaScript is 13209 bytes gzip, and the budget is 13209.6. A pointer listener was 13323. `tabindex="0"` and `role="region"` was 13226.

## Decision

Do this in `xoong.css` only. Do not suppress text selection. A double-click and a drag still select cell text, in every app. QA-3 asks for the row action to be on screen (or for a sideways drag to reveal it). Pinning does the first. Carbon and Polaris leave selection alone, and Primer's `user-select` is on buttons and pagination.

* Pin `td.xo-actions`, `th.xo-actions` and the generated actions header to the inline end (`position: sticky; inset-inline-end: 0`) with an opaque background and a 1px inline-start edge, so the buttons stay inside the frame and the cells that scroll under them do not show through. The generated header matches `thead th:last-child:has(> .xo-visually-hidden[xo-t="xoong.table.actions"])`: it is last, and its child is the visually hidden label the table writes for actions. A hand-written table uses `th.xo-actions`, so the pin does not depend on that header being last. A last header whose hidden label is something else, and which is not `th.xo-actions`, is not pinned. A header that contains a hidden child but is not last, and is not `th.xo-actions`, is not pinned either. The table uses `border-collapse: separate; border-spacing: 0` so that edge stays with the cell (with `collapse`, the shared border can be left behind). The border is visible at every width.
* Do not reserve a band of `scroll-padding-inline-end` the size of the actions column, and do not cancel it with `scroll-margin-inline-end: -100vw`. The padding is what puts the pinned action in the zone Chromium and WebKit scroll out of: with `min(20rem, 40%)` and no negative margin, focusing Edit moves the frame to `scrollLeft` 572 at 1280px in both. The margin stops that jump, and it is the same margin every ancestor scroller uses. Measured with `-100vw`: a 1900px page in a 1280px window stays at `scrollX` 0 and Edit sits at x 1824, in Chromium, Firefox and WebKit; a 300px `overflow-x: auto` wrapper around an 800px table stays at `scrollLeft` 0. Before that margin the window scrolled to about 628 and the wrapper to 500. Firefox `scrollIntoView({ block: 'nearest' })`, with the table below the fold in a 500px viewport, places Edit's top at 500, just off-screen. Without the margin the top is 460 and the button ends on screen, in all three engines.
* A cancel the size of the padding does not fix the ancestor. The frame as an inline-size container, with `scroll-margin-inline-end: calc(-1 * min(20rem, 40cqi))`, stops the frame jumping and leaves the frame's height unchanged. The 300px wrapper then scrolls to 444 and Edit still ends 39px past it: the padding is up to 320px, and one margin cannot both cancel that and leave the button inside a smaller scroller. `container-type` is not used. `anchor-size()` is not used either: anchor positioning is not in every browser this project supports ([browser-support.md](../browser-support.md)), and in this Chromium the function was dropped.
* The frame keeps `scroll-padding-inline-end: 1px` and the action has no scroll margin. WebKit's `focus()` on Edit, on a 1900px page in a 1280px window, leaves `scrollX` at 0 when the padding is 0 and the actions cell holds Edit, Actions and Delete. With 1px it scrolls to 620 and Edit is in the window. 1px is narrower than the button, so the button is not entirely inside the padding. Focusing or clicking it leaves the frame at `scrollLeft` 0 at 390px and at 1280px, in Chromium, Firefox and WebKit. The page and the nested wrapper still scroll the action into view, and the Firefox below-the-fold `scrollIntoView` keeps it on screen.

Not done, and why:

* `tabindex="0"`, `role="region"` and a name on the frame, which is Primer's keyboard scrollport. Appended to the comment-stripped `@xoong/ui` sources (the budget's own measurement) that markup is 13226 bytes, 17 over the 13209 measured today and 16 over the 13209.6 budget. With the actions pinned, the buttons are on screen and in tab order.
* Making `cards` the default, or a swipe-to-reveal row. Both change the markup or the layout of every table. Cards stay opt-in. That is the workaround Rainlet shipped; this decision is for tables that do not set it.
* Editing `design/brand-kit/**` or hand-editing `mist.css`. The framework rule is in an earlier cascade layer, so the Mist skin can still paint the header, the hover and the selected row. The card layout already puts the actions in the card.

## Consequences

The actions column stays at the inline end while the other columns scroll. Cell text can be selected and copied. Focusing or clicking a pinned action does not move the frame. A page that is wider than the window, and a nested scroller around the table, still scroll that action into view. Tabbing does not leave a cell entirely outside the frame. A focused cell that already lies inside the frame is not scrolled out from under the sticky column, so it can be partly or wholly covered. An actions cell wider than the frame itself still overflows the frame; the column is only pinned, not shrunk.

This is a change to the default table. The user-facing rule is in [docs/admin.md](../admin.md).
