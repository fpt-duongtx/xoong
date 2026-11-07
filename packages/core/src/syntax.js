// @ts-check
/**
 * The names of xoong's declarative HTML syntax. `xoong check` validates against these lists and
 * llms.txt documents them; a test keeps the runtime (data/src/view.js) and both in step.
 */

/** Attributes understood inside <xo-view>. */
export const XO_ATTRIBUTES = ['xo-each', 'xo-if', 'xo-click', 'xo-submit', 'xo-body', 'xo-keep'];

/** Custom elements shipped by xoong. */
export const XO_ELEMENTS = ['xo-view'];
