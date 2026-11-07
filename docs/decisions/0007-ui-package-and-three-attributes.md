# ADR-0007: A separate `@xoong/ui` package and three new attributes

Status: Accepted

## Context
The admin set (`xo-table`, `xo-form`, `xo-dialog`, `xoong.css`) is the first part of xoong that is not about data.
It must not grow `core` or `data`, which have size budgets and stay useful for small sites without an admin.
Sorting and paging need to change a view's parameters from markup, and dialogs need open and close triggers.

## Decision
* A new package `@xoong/ui`, allowed to depend on `core` and `data` only (enforced by the architecture test, with its
  own size budget). `data` stays free of UI components.
* `@xoong/data/view` exports `defineTemplate(tag, expand)`: an element that turns into plain markup before binding.
  `xo-table` and `xo-form` use it, so they produce ordinary DOM (ADR-0002) and need no component lifecycle.
* Three attributes join the syntax: `xo-param` (data: set a view parameter), `xo-open` and `xo-close` (ui). Native
  `command`/`commandfor` would replace the last two, but support is not yet in every browser an owner may target;
  revisit when the browser matrix is decided.
* `xoong sync` writes `bodyFields` into `operations.json` so forms and typed form values come from the OpenAPI document
  (ADR-0003), not from hand-written metadata.

## Consequences
+ Small sites do not pay for the admin set; the admin set pays nothing for features it does not use.
+ Generated markup is inspectable and testable like hand-written markup.
- Table cells are text only for now; richer cells mean writing the table by hand.
- Every new attribute enlarges `llms.txt`; the 3k-token cap is tested.
