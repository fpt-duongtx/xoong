// Types for @xoong/controls. The package registers custom elements (importing it, or one subpath such as `@xoong/controls/tabs`, is the whole API),
// so these types describe the elements: an interface per element, the `xo-*` tag map (document.querySelector('xo-tabs') is typed) and the events.
//
// ADDING AN ELEMENT takes a few lines in this file:
//   1. an interface `XoFooElement extends XoElement` (or `XoControl` for a form control) with its attributes/properties and methods;
//   2. one line in `XoControlsTagMap`:       'xo-foo': XoFooElement;
//   3. one line per event in `XoControlsEventMap` (only for events that carry a detail):   'xo-foo-change': CustomEvent<{ value: string }>;
//   4. in package.json `exports`, a subpath with the `types` condition pointing at this file:   "./foo": { "types": "./src/index.d.ts", "default": "./src/foo.js" }
// Properties that mirror an attribute (`static props`) are declared with their runtime type: Boolean -> boolean, Number -> number, String -> string.
import type { XoElement, XoControl } from '@xoong/core';

// ---- shared shapes ------------------------------------------------------------------------------------------------------------

/** A choice of `xo-combobox` / `xo-tags` as the element holds it. */
export interface XoOption { value: string; label: string; disabled?: boolean }
/** What you may assign to `options`: plain strings, or objects (label defaults to the value). */
export type XoOptionInput = string | { value: string | number; label?: string; disabled?: boolean };
/** The part of a request schema node the combobox reads (the form binder sets it): an `enum`, or an array of an `enum` for `multiple`. */
export interface XoSchemaNodeLike { t?: string; enum?: unknown[]; items?: { enum?: unknown[]; [key: string]: unknown }; [key: string]: unknown }
/** A row of `xo-chart`. */
export interface XoChartRow { label: string; value: number }
/** What you may assign to `rows`: numbers (labelled 1, 2, ...) or `{ label, value }` rows. */
export type XoChartRowInput = number | { label: string | number; value: number | string };
/** The value of `<xo-date range>`: ISO `YYYY-MM-DD` strings, '' when not chosen. */
export interface XoDateRange { start: string; end: string }
/** Consent choices: one boolean per category. */
export type XoConsentChoices = Record<string, boolean>;

// ---- elements -----------------------------------------------------------------------------------------------------------------

/** `<xo-tabs>`: sections with `xo-tab="Label"` become an accessible tab set. */
export interface XoTabsElement extends XoElement {
  /** Key of the selected tab (the section's `id`, or its position). */
  value: string;
  /** Accessible name of the tab list. */
  label: string;
  /** Select a tab by key (or position); unknown keys are ignored. */
  select(key: string | number, options?: { focus?: boolean }): void;
}

/** `<xo-menu>`: a menu button; with `value` items it is a choice menu. */
export interface XoMenuElement extends XoElement {
  label: string;
  /** The chosen radio item, in a choice menu. */
  value: string;
  readonly isOpen: boolean;
  /** Open the menu; `at` also moves the focus to the first or last item. */
  open(at?: 'first' | 'last'): void;
  close(options?: { focus?: boolean }): void;
}

/** `<xo-combobox>`: pick a value from a list you can filter by typing; `multiple` picks several (the value is then an array of strings). */
export interface XoComboboxElement extends XoControl {
  value: string | string[];
  placeholder: string;
  label: string;
  multiple: boolean;
  /** Let the person add a value that is not in the list. */
  creatable: boolean;
  /** Leave filtering to you: listen to `xo-search` and set `options`. */
  remote: boolean;
  /** The choices. Assign strings or objects; reading gives the normalised list. */
  get options(): XoOption[];
  set options(list: readonly XoOptionInput[] | null | undefined);
  /** The schema node of the field (set by the form binder): an `enum` gives the options. */
  schema: XoSchemaNodeLike | undefined;
}

/** `<xo-tags>`: a combobox of free text values (`multiple` and `creatable` by default). */
export interface XoTagsElement extends XoComboboxElement {}

/** `<xo-carousel>`: scrolling slides with arrows, dots and optional autoplay. */
export interface XoCarouselElement extends XoElement {
  label: string;
  /** Slides in view at once (also the CSS custom property `--xo-carousel-items`). */
  items: number;
  /** Milliseconds between slides; 0 is off. */
  autoplay: number;
  loop: boolean;
  dots: boolean;
  counter: boolean;
  noArrows: boolean;
  /** Index of the first visible slide. */
  readonly index: number;
  readonly count: number;
  next(): void;
  prev(): void;
  /** Scroll so that slide `i` is the first visible one. */
  goTo(i: number): void;
  play(): void;
  pause(): void;
}

/** `<xo-switch>`: one setting on or off; the value is a boolean. */
export interface XoSwitchElement extends XoControl {
  value: boolean;
  checked: boolean;
  label: string;
  /** Sets aria-busy and ignores clicks while a save is running. */
  busy: boolean;
  /** `"sm"` for the small switch. */
  size: string;
}

/** `<xo-date>`: a date field with a calendar; the value is `YYYY-MM-DD` (a `{ start, end }` object with `range`). */
export interface XoDateElement extends XoControl {
  value: string | XoDateRange;
  label: string;
  /** Earliest and latest allowed day, `YYYY-MM-DD`. */
  min: string;
  max: string;
  range: boolean;
  placeholder: string;
  /** First day of the week, 1 (Monday) to 7 (Sunday); 0 means the locale's. */
  weekStart: number;
}

/** `<xo-time>`: a time of day, `HH:mm` (24 hours), '' when empty. */
export interface XoTimeElement extends XoControl {
  value: string;
  label: string;
  /** Minutes between choices (1 to 30, default 5). */
  step: number;
  /** Earliest and latest allowed time, `HH:mm`. */
  min: string;
  max: string;
}

/** `<xo-slider>`: a number on a track; the value is a number ('' when empty). */
export interface XoSliderElement extends XoControl {
  value: number | '';
  label: string;
  min: number;
  max: number;
  step: number;
  /** Comma separated names of the stops, for screen readers and the visible value. */
  labels: string;
}

/** `<xo-stepper>`: a number with minus and plus buttons; the value is a number ('' when empty). */
export interface XoStepperElement extends XoControl {
  value: number | '';
  label: string;
  min: number;
  max: number;
  step: number;
}

/** `<xo-password>`: a password field with a show/hide button; the value is a string. */
export interface XoPasswordElement extends XoControl {
  value: string;
  label: string;
  placeholder: string;
  autocomplete: string;
}

/** `<xo-copy>`: a read-only value with a Copy button. */
export interface XoCopyElement extends XoControl {
  value: string;
  label: string;
}

/** `<xo-file>`: a file field with a drop zone; the value is a `File` ('' when empty), an array of files with `multiple`. */
export interface XoFileElement extends XoControl {
  value: File | File[] | '';
  label: string;
  /** The native `accept` syntax (`image/*`, `.pdf`). */
  accept: string;
  /** Bytes, or text such as `2MB`, `500KB`. */
  maxSize: string;
  multiple: boolean;
  hint: string;
  /** Upload progress from 0 to 1, shown as a bar; null hides it. */
  progress: number | null;
}

/** `<xo-image>`: a lazy image that keeps its space and has a placeholder and a fallback. `load` and `error` are re-fired on the element. */
export interface XoImageElement extends XoElement {
  src: string;
  srcset: string;
  sizes: string;
  alt: string;
  width: number;
  height: number;
  /** Aspect ratio such as `16/9` or `1.5`. */
  ratio: string;
  /** `cover` (default) or `contain`. */
  fit: string;
  position: string;
  /** For the one image above the fold: eager, high fetch priority. */
  priority: boolean;
  /** `lazy` (default) or `eager`. */
  loading: string;
  /** A src tried once when `src` fails. */
  fallback: string;
}

/** `<xo-chart>`: a small bar or line chart with the same numbers as a table. */
export interface XoChartElement extends XoElement {
  /** `bar` (default) or `line`. */
  type: string;
  label: string;
  /** Appended to the values. */
  unit: string;
  /** Column names of the table view. */
  heading: string;
  valueHeading: string;
  /** The rows as JSON text: `[{"label":"Mon","value":12}]`. */
  data: string;
  /** The rows. Assign numbers or `{ label, value }`; reading gives the normalised rows. Can be set again at any time. */
  get rows(): XoChartRow[];
  set rows(rows: readonly XoChartRowInput[] | null | undefined);
}

/** `<xo-accordion>`: `<details>` children that move with the arrow keys; `single` keeps one open. */
export interface XoAccordionElement extends XoElement {
  single: boolean;
}

/** `<xo-popover>`: a small panel that opens from a button. */
export interface XoPopoverElement extends XoElement {
  /** A selector for the trigger; by default the element just before the popover. */
  anchor: string;
  label: string;
  open: boolean;
  /** Open it. */
  show(): void;
  toggle(): void;
  /** Close it; `refocus` gives the focus back to the trigger. */
  close(refocus?: boolean): void;
}

/** `<xo-command>`: a command palette (Ctrl/Cmd+K by default) over its link and button children. */
export interface XoCommandElement extends XoElement {
  /** The key, with Ctrl/Cmd, that opens it (default `k`). */
  shortcut: string;
  label: string;
  open(): void;
  close(): void;
}

/** `<xo-consent>`: a cookie consent bar that remembers the choice. */
export interface XoConsentElement extends XoElement {
  /** Comma separated category names (`analytics,marketing`). */
  categories: string;
  /** localStorage key (default `xoong-consent`). */
  storage: string;
  label: string;
  /** The saved choices, or null until the visitor has chosen. */
  readonly choices: XoConsentChoices | null;
  /** Show the bar again (cookie settings). */
  open(): void;
}

/** `<xo-theme-toggle>`: chooses the light or the dark theme (`data-theme` on `<html>`). */
export interface XoThemeToggleElement extends XoElement {
  /** localStorage key (default `xoong-theme`). */
  storage: string;
  /** The theme in effect: the chosen one, else the system's. */
  readonly theme: 'light' | 'dark';
  /** Forget the choice: the system setting decides again. */
  reset(): void;
}

/** `<xo-range-slider>`: a minimum and a maximum on one track. The value is `[min, max]`; the attribute is `value="20,70"`. */
export interface XoRangeSliderElement extends XoControl {
  label: string;
  min: number;
  max: number;
  step: number;
  minLabel: string;
  maxLabel: string;
  value: [number, number];
  setValue(value: [number, number] | string): void;
}

/** `<xo-segmented>`: a group of buttons where one (or, with `multiple`, several) is chosen. */
export interface XoSegmentedElement extends XoControl {
  label: string;
  multiple: boolean;
  clearable: boolean;
  value: string | string[];
}

/** `<xo-split-button>`: a main button with a menu of related actions. */
export interface XoSplitButtonElement extends XoElement {
  /** Accessible name of the arrow button. */
  more: string;
}

/** `<xo-textarea>`: a textarea with a character counter and a progress bar. */
export interface XoTextareaElement extends XoControl {
  label: string;
  maxlength: number;
  rows: number;
  placeholder: string;
  value: string;
}

/** `<xo-stat>`: a KPI tile. */
export interface XoStatElement extends XoElement {
  label: string;
  value: string;
  delta: number;
  deltaLabel: string;
  /** Comma-separated numbers for the sparkline. */
  series: string;
  /** `down-is-good` when a fall is an improvement. */
  trend: string;
  /** The sparkline numbers as an array (set it instead of `series`). */
  seriesData: number[];
}

/** `<xo-otp>`: one box per digit. The value is the digit string. */
export interface XoOtpElement extends XoControl {
  label: string;
  length: number;
  value: string;
}

/** `<xo-avatar>`: a round badge with initials or a picture. */
export interface XoAvatarElement extends XoElement {
  name: string;
  src: string;
  size: 'sm' | 'lg' | '';
  status: 'ok' | 'warn' | 'muted' | '';
}

/** `<xo-avatars>`: a stack of avatars with a +N badge. */
export interface XoAvatarsElement extends XoElement {
  max: number;
  label: string;
}

/** `<xo-progress>`: a progress bar; set `value = null` for indeterminate. */
export interface XoProgressElement extends XoElement {
  value: number | null;
  max: number;
  label: string;
  thin: boolean;
}

/** `<xo-spinner>`: a loading spinner (`label=""` makes it decorative). */
export interface XoSpinnerElement extends XoElement {
  label: string;
  size: 'md' | 'lg' | '';
}

/** `<xo-steps>`: progress through a flow; the children are the step titles. */
export interface XoStepsElement extends XoElement {
  /** Index of the current step (from 0). */
  current: number;
  label: string;
}

/** `<xo-inline-edit>`: text renamed in place; Enter saves, Escape cancels. */
export interface XoInlineEditElement extends XoControl {
  label: string;
  value: string;
  /** Start editing. */
  edit(): void;
}

// `xo-tooltip="text"` is an attribute on any element, not an element: it has no interface.

// ---- registries ---------------------------------------------------------------------------------------------------------------

/** Every element of this package by tag name. Add one line per element. */
export interface XoControlsTagMap {
  'xo-tabs': XoTabsElement;
  'xo-menu': XoMenuElement;
  'xo-combobox': XoComboboxElement;
  'xo-tags': XoTagsElement;
  'xo-carousel': XoCarouselElement;
  'xo-switch': XoSwitchElement;
  'xo-date': XoDateElement;
  'xo-time': XoTimeElement;
  'xo-slider': XoSliderElement;
  'xo-stepper': XoStepperElement;
  'xo-password': XoPasswordElement;
  'xo-copy': XoCopyElement;
  'xo-file': XoFileElement;
  'xo-image': XoImageElement;
  'xo-chart': XoChartElement;
  'xo-accordion': XoAccordionElement;
  'xo-popover': XoPopoverElement;
  'xo-command': XoCommandElement;
  'xo-consent': XoConsentElement;
  'xo-theme-toggle': XoThemeToggleElement;
  'xo-range-slider': XoRangeSliderElement;
  'xo-segmented': XoSegmentedElement;
  'xo-split-button': XoSplitButtonElement;
  'xo-textarea': XoTextareaElement;
  'xo-stat': XoStatElement;
  'xo-otp': XoOtpElement;
  'xo-avatar': XoAvatarElement;
  'xo-avatars': XoAvatarsElement;
  'xo-progress': XoProgressElement;
  'xo-spinner': XoSpinnerElement;
  'xo-steps': XoStepsElement;
  'xo-inline-edit': XoInlineEditElement;
}

/** The events that carry data (all bubble), by name. Add one line per event. */
export interface XoControlsEventMap {
  'xo-tab-change': CustomEvent<{ value: string }>;
  'xo-menu-select': CustomEvent<{ value: string }>;
  'xo-menu-open': CustomEvent<null>;
  'xo-menu-close': CustomEvent<null>;
  /** `xo-combobox` with `remote`: the person typed; set `options`. */
  'xo-search': CustomEvent<{ query: string }>;
  'xo-carousel-change': CustomEvent<{ index: number; count: number }>;
  'xo-file-reject': CustomEvent<{ file: File; reason: 'type' | 'size' }>;
  'xo-command-run': CustomEvent<{ value: string; label: string }>;
  /** The visitor chose; the detail is the choices. */
  'xo-consent': CustomEvent<XoConsentChoices>;
  'xo-theme-change': CustomEvent<{ theme: 'light' | 'dark' }>;
  'xo-popover-open': Event;
  'xo-popover-close': Event;
  'xo-accordion-change': CustomEvent<{ index: number; open: boolean }>;
  /** `xo-copy`: the text was copied / the browser refused the clipboard. */
  'copied': CustomEvent<{ text: string }>;
  'copy-failed': CustomEvent<{ text: string }>;
  /** `xo-otp`: every box is filled. */
  'complete': CustomEvent<{ value: string }>;
  /** `xo-inline-edit`. */
  'save': CustomEvent<{ value: string }>;
  'cancel': Event;
}

declare global {
  interface HTMLElementTagNameMap extends XoControlsTagMap {}
  interface HTMLElementEventMap extends XoControlsEventMap {}
  // The events bubble, so a listener on the document is typed too.
  interface DocumentEventMap extends XoControlsEventMap {}
}
