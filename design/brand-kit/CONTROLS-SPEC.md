# New controls: spec for the dev side

UI is done (`controls-new.html`, `css/controls-new.css`, copied from the Rainlet Mist system, renamed `a-*` to `xo-*`, re-pointed to `--xo-*` tokens). Your job: the elements, the logic, the keyboard, the ARIA and the form value. The look must not change; if it has to, ask the Mist owner through me.

Element names below are proposals: rename freely, but keep the class names (`xo-*`) that the CSS targets or tell me what changed. Every control uses the standard height (`--xo-control-height`), the strong outline (`--xo-color-control-border`) and the same focus ring (`--xo-focus`); every form control is a `XoControl` (name, value, required, disabled, invalid, dirty, touched, validity) like `xo-combobox`.

Rules that apply to all (from the Rainlet brief): one accent marks primary, current and focus; status never relies on colour alone; icon-only buttons need `aria-label` and a tooltip; labels never wrap; disabled controls explain why (focusable wrapper with a reason) when it is not obvious.

| # | Control | Proposed element | DOM (see `controls-new.html`) | Value and events | Keyboard | ARIA |
|---|---|---|---|---|---|---|
| 1 | Switch | `<xo-switch name label checked disabled>` | `button.xo-switch[role=switch][aria-checked]` (+ `.xo-switch--sm` in rows, 44px hit area kept) | boolean; `change` | Space/Enter toggle | `role=switch`, `aria-checked`, name from the label; busy = `aria-busy` (spinning knob), disabled 50% |
| 2 | Radio cards | `<xo-choice>` group, or plain radios | `label.xo-choice > input[type=radio] + span` | string; `change` | arrows move, Space picks (native) | native radiogroup, `aria-describedby` the hint |
| 3 | Slider | `<xo-slider min max step value>` | `input.xo-range[type=range]` + `style --p` (the fill) | number; `input`/`change` | native range keys | label, `aria-valuetext` for stepped labels ("Medium"); ticks are `aria-hidden` |
| 4 | Range slider | `<xo-range-slider min max value="20,70">` | `.xo-range-dual` with two `input.xo-range` and `.xo-range-dual__fill` | `[min,max]`; thumbs may not cross | native per thumb | two named inputs ("Minimum price", "Maximum price"), group labelled |
| 5 | Stepper | `<xo-stepper min max step value>` | `.xo-stepper > button + input[inputmode=numeric] + button` | number; clamps; at min the minus is `disabled` | ↑↓ ±step, PageUp/Down ±10×, Home/End min/max | `role=spinbutton` semantics on the input (`aria-valuemin/max/now`), buttons labelled Decrease/Increase |
| 6 | Date field | `<xo-date name value min max>` | `.xo-input-wrap` with calendar icon + `input` and a popover `.xo-float > .xo-calendar` | ISO `YYYY-MM-DD` in the value, locale text in the field (`Intl`) | Enter/↓ opens; arrows move days, PageUp/Down months, Home/End week, Esc closes and returns focus | popover `role=dialog` named "Choose date"; day buttons `aria-pressed`/`aria-current=date`, today ring |
| 7 | Date range | `<xo-date range>` | same calendar with `.is-sel` ends and `.is-range` between; footer "12 – 16 Nov · 5 days", Clear / Apply | `start/end` | as above; Shift+arrow extends | range announced in the footer (`aria-live=polite`) |
| 8 | Time | `<xo-time step>` | two `select` (hour, minute) with ":" between | `HH:mm` | native | each select named Hour/Minute |
| 9 | Multi-select, tag input, combobox | exist (`xo-combobox multiple`, `xo-tags`) | `.xo-multi`, `.xo-chip`, `.xo-listbox` | — | — | The new part is the open list: `.xo-option__group` headings, `.xo-option--active`, matching text in `<b>`, a trailing check or path (`code`) |
| 10 | Password | `<xo-password>` or `input[type=password]` + eye | `.xo-input-wrap.xo-input-wrap--end > icon + input + button.xo-input-end` | string | Tab to the eye; Space/Enter toggles | eye button `aria-label` "Show password"/"Hide password" and `aria-pressed`; announce nothing else |
| 11 | One-time code | `<xo-otp length=6 name>` | `.xo-otp[role=group] > input[maxlength=1] ×6` | string of digits; `complete` event | typing moves forward, Backspace back, paste splits across boxes, ←→ | group labelled, each box "Digit n", `autocomplete=one-time-code` on the first |
| 12 | Copy field | `<xo-copy value>` | `.xo-copyfield > input[readonly] + button` | none; `copied` event | Enter/Space on the button | button text "Copy" -> "Copied" (`aria-live=polite`), `data-state=copied` for 1.6 s |
| 13 | Textarea with counter | `<xo-textarea maxlength>` | `textarea` + `.xo-progress.xo-progress--thin` under it, counter "142 / 160" in the label row | string | native | counter `aria-live=polite` only when near the limit; over the limit -> invalid + error text |
| 14 | Inline edit | `<xo-inline-edit>` | `.xo-inline-edit` text + ghost icon button; editing swaps in an `input` | string; `save`/`cancel` | Enter saves, Esc cancels, selecting the text starts editing | the button "Rename"; on edit, focus the input and select all |
| 15 | Search with filters | compose: `.xo-input-wrap` + button with `.xo-count` | — | — | — | the count is part of the button name ("Filters, 2 active") |
| 16 | Button group (segmented icons) | `<xo-segmented>` | `.button-group > button[aria-pressed]` (icons) or `.xo-seg > button` (text + `.xo-count`) | single value | arrows move, Space picks | `role=group` + `aria-pressed` per button (or `role=radiogroup`/`radio` if exactly one is always on) |
| 17 | Split button | `<xo-split-button>` | `.xo-split-button > button.primary + button.primary.icon-only[aria-haspopup=menu]` | main action, plus an `xo-menu` | arrows open the menu from the arrow button | the second button "More <action> options" |
| 18 | Toggle button | any `button[aria-pressed]` | styled by `button[aria-pressed=true]` | boolean | Space/Enter | `aria-pressed` |
| 19 | Busy button | `button[aria-busy=true]` | spinner leads the label, label stays | — | — | `aria-busy`; keep the button focusable but ignore clicks while busy |
| 20 | Spinner, skeleton, progress | `<xo-spinner>`, `.xo-skel`, `<xo-progress>` | `.xo-spinner(--md/--lg)`, `.xo-skel`, `.xo-progress > i` (width) | progress 0-100 | — | spinner `role=status` + name; progress `role=progressbar` with `aria-valuenow/min/max`; skeleton `aria-hidden` with one status for the region; reduced motion stops the shimmer and the spin |
| 21 | Steps | `<xo-steps current>` | `.xo-steps > .xo-step(--done) + .xo-steps__line(--done)` | current index | — | `aria-current=step` on the current, "done" steps get a check (not colour only) |
| 22 | Accordion | `<xo-accordion>` or native `details` | `details.xo-accordion > summary + .xo-accordion__body` | open state | Enter/Space on the summary (native) | native `details`; optional "only one open" group |
| 23 | Avatar | `<xo-avatar name src size>` | `.xo-avatar(--sm/--lg/--ok/--warn/--muted)`, `.xo-avatars` stack with "+3" | — | — | initials from the name; `aria-label` the full name; a stack is a list |
| 24 | Command palette | `<xo-command>` | `.xo-float.xo-command > .xo-command__input + .xo-listbox + .xo-command__foot` | selected command; `run` event | ⌘/Ctrl K opens, ↑↓ move, Enter runs, Esc closes | dialog + combobox pattern (`aria-activedescendant`), results `role=listbox` with group headings, key hints are visual only |
| 25 | Scrollbars | CSS only | `.xo-scroll` (or on any scroll area) | — | — | none |

## Notes per control (Rainlet brief)
- **Switch vs checkbox vs toggle:** switch = one setting on or off; checkbox = pick from a list or bulk select; `aria-pressed` toggle button = a tool that stays active. A switch's label names the setting (never "Turn on…"); "on" is the active state. In a form it saves with the form; outside a form it saves at once, locks while busy, shows a status toast, and on failure reverts and shows an error toast. Risky settings confirm in a dialog first. Settings row: title and optional hint on the left, optional On/Off word and the switch on the right, 48px, divider, no frame.
- **Dates:** show dates in the user's locale; never type-only validation, the calendar is the picker and the field also accepts typing; weeks start on Monday in the design (make it a prop, default from `Intl.Locale`).
- **Command palette:** opens with ⌘K / Ctrl K, closes on Esc, restores focus; results grouped ("Go to", "Actions"); matching text bold.
- **Disabled:** 50% and not-allowed cursor; if the reason matters, wrap in a focusable element that states it.
- **Reduced motion:** the switch knob, spinner, skeleton and progress must stop moving.

## Order I suggest
1. Switch, slider, stepper, copy field, password, accordion, avatar, progress/spinner/steps (small, no popovers).
2. Date, time, range (needs a popover; `xo-menu`'s layer helper can place it).
3. OTP, inline edit, command palette.
4. Split/segmented/toggle polish.

## Tests the design expects (each control)
axe in Mist light/dark; keyboard path from the table above; focus ring >= 3:1 (the focus test); 390px without sideways scroll; strict CSP (no inline style attributes: set `--p`, widths and positions with the CSS object model).
