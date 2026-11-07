// @ts-check
/**
 * The names of xoong's declarative HTML syntax. `xoong check` validates against these lists and
 * llms.txt documents them; a test keeps the runtime (data/src/view.js) and both in step.
 */

/** Attributes understood inside <xo-view>. */
export const XO_ATTRIBUTES = ['xo-each', 'xo-if', 'xo-click', 'xo-submit', 'xo-body', 'xo-keep', 'xo-param', 'xo-optimistic', 'xo-select', 'xo-selected', 'xo-with', 'xo-confirm', 'xo-notice', 'xo-add', 'xo-remove', 'xo-move', 'xo-t'];

/** Custom elements shipped by xoong. */
export const XO_ELEMENTS = ['xo-view'];

/** Attributes and elements that come with @xoong/ui (the admin set). */
export const XO_UI_ATTRIBUTES = ['xo-open', 'xo-close', 'xo-route', 'xo-layout', 'xo-outlet', 'xo-guard'];
export const XO_UI_ELEMENTS = ['xo-table', 'xo-form', 'xo-dialog', 'xo-toast', 'xo-router'];

/** Attributes and elements of @xoong/controls and @xoong/richtext. */
export const XO_CONTROL_ATTRIBUTES = ['xo-tab', 'xo-menu-trigger', 'xo-tooltip'];
export const XO_CONTROL_ELEMENTS = ['xo-tabs', 'xo-menu', 'xo-combobox', 'xo-tags', 'xo-richtext'];
