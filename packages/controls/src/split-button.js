// @ts-check
/**
 * <xo-split-button> is a main action with a menu of related actions next to it.
 *
 *   <xo-split-button more="More publish options">
 *     <button class="primary" xo-click="POST /articles/{id}/publish">Publish</button>
 *     <button xo-click="POST /articles/{id}/schedule">Schedule</button>
 *     <a href="/articles/{id}/preview">Preview</a>
 *   </xo-split-button>
 *
 * - The first child is the main button. The others become the items of an <xo-menu> opened by the arrow button, which is named by `more`
 *   (default "More options") and has `aria-haspopup="menu"`. The arrow keys open the menu from the arrow button (the menu's own keys).
 * - Draws `.xo-split-button > main button + xo-menu > button.icon-only[xo-menu-trigger] + items`. A `primary` class on the main button is carried over to the arrow.
 */
import { XoElement, define, text } from '@xoong/core';

class XoSplitButton extends XoElement {
  static props = { more: String };

  connected() { void this.ready().then(() => this.#build()); } // the buttons are the children

  #build() {
    if (this.querySelector(':scope > .xo-split-button')) return;
    const [main, ...items] = [...this.children].filter((c) => c instanceof HTMLElement);
    if (!main) return;
    const wrap = document.createElement('div');
    wrap.className = 'xo-split-button';
    const arrow = document.createElement('button');
    arrow.type = 'button';
    arrow.className = `${main.classList.contains('primary') ? 'primary ' : ''}icon-only`;
    arrow.setAttribute('xo-menu-trigger', '');
    arrow.setAttribute('aria-haspopup', 'menu');
    arrow.setAttribute('aria-label', this.more || text('xoong.controls.moreOptions', 'More options'));
    arrow.innerHTML = '<span class="ic" data-ic="chevron-down" aria-hidden="true"></span>';
    const menu = document.createElement('xo-menu');
    menu.setAttribute('label', arrow.getAttribute('aria-label') ?? '');
    menu.append(arrow, ...items);
    wrap.append(main, menu);
    this.replaceChildren(wrap);
  }
}
define('xo-split-button', XoSplitButton);
