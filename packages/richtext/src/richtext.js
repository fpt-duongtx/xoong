// @ts-check
/**
 * <xo-richtext> is a small rich text editor and a form control: its value is sanitised HTML.
 *
 *   <xo-richtext name="body" label="Body" placeholder="Write something"></xo-richtext>
 *   <xo-richtext name="body" media tools="bold italic h2 ul ol quote link image undo redo"></xo-richtext>
 *
 * - A `contenteditable` area with a toolbar (`role="toolbar"`, one tab stop, Left/Right/Home/End move inside it). Tools: undo, redo, style (a select: Paragraph,
 *   Heading 2, Heading 3), bold, italic, underline, ul, ol, quote, link, image (h2 as a toggle is also available); the `tools` attribute picks and orders them.
 *   `image` is only shown with the `media` attribute.
 * - The toolbar has two sizes and never wraps or scrolls sideways, chosen by the editor's own width (not the viewport's): Full from 580px, Compact below it
 *   (style, bold, italic, bulleted list, link, image and a More menu that holds underline, numbered list, quote, undo, redo). `toolbar="full"` or
 *   `"compact"` forces one.
 * - `expand()` opens the same editor in a 960px dialog (the whole screen under 768px); Done and Escape close it, `collapse()` too. Events `xo-richtext-expand`
 *   and `xo-richtext-done`. Nothing is saved by it: the host places its own Expand button and calls `expand()`.
 * - Typing and the toolbar use the browser's own editing commands, so undo, redo, IME, spell checking, Ctrl/Cmd+B and +I and the platform's
 *   shortcuts all work. Ctrl/Cmd+K opens the link box.
 * - The value is `sanitizeHtml()` of the content (see sanitize.js): p, h2, h3, strong, em, ul, ol, li, blockquote, br, a, img only. Paste and drop are
 *   sanitised before they enter the editor; formatting from Word or a web page does not come along.
 * - Links: the link box accepts http, https, mailto and tel (an address without a scheme becomes https:// or mailto:); anything else is refused.
 * - Media: the image tool fires a cancelable `xo-pick-media` event with `detail.insert({ src, alt })`. Open your media library in a listener, call
 *   `preventDefault()`, and call `insert` when the person has chosen (now or later). `el.insertImage(src, alt)` does the same from code.
 * - It is an `XoControl`: `name`, `required` (an empty editor is empty), `disabled`, `readonly`, `dirty`, `touched`, validity. `maxlength` counts text characters.
 */
import { XoControl, define, text } from '@xoong/core';
import { sanitizeHtml, isSafeLink, textOf } from './sanitize.js';

let counter = 0;

const TOOLS = {
  bold: { label: () => text('xoong.richtext.bold', 'Bold'), face: 'B', state: () => query('bold') },
  italic: { label: () => text('xoong.richtext.italic', 'Italic'), face: 'I', state: () => query('italic') },
  underline: { label: () => text('xoong.richtext.underline', 'Underline'), face: 'U', state: () => query('underline') },
  style: { label: () => text('xoong.richtext.style', 'Text style') },
  more: { label: () => text('xoong.richtext.more', 'More'), face: '⋯' },
  h2: { label: () => text('xoong.richtext.h2', 'Heading'), face: 'H2', state: () => block() === 'h2' },
  ul: { label: () => text('xoong.richtext.ul', 'Bulleted list'), face: '•', state: () => query('insertUnorderedList') },
  ol: { label: () => text('xoong.richtext.ol', 'Numbered list'), face: '1.', state: () => query('insertOrderedList') },
  quote: { label: () => text('xoong.richtext.quote', 'Quote'), face: '“', state: () => block() === 'blockquote' },
  link: { label: () => text('xoong.richtext.link', 'Link'), face: '🔗', state: () => !!anchorAtSelection() },
  image: { label: () => text('xoong.richtext.image', 'Image'), face: '🖼' },
  undo: { label: () => text('xoong.richtext.undo', 'Undo'), face: '↶' },
  redo: { label: () => text('xoong.richtext.redo', 'Redo'), face: '↷' },
};
const DEFAULT_TOOLS = 'undo redo style bold italic underline ul ol quote link image';
/** In the compact toolbar these tools move into the "More" menu (in this order). */
const MORE_ITEMS = ['underline', 'ol', 'quote', 'undo', 'redo'];
/** The editor is "full" from this width (its own width, not the viewport's). */
const FULL_FROM = 580;
const STYLE_OPTIONS = /** @type {[string, () => string, string][]} */ ([
  ['p', () => text('xoong.richtext.paragraph', 'Paragraph'), 'P'],
  ['h2', () => text('xoong.richtext.heading2', 'Heading 2'), 'H2'],
  ['h3', () => text('xoong.richtext.heading3', 'Heading 3'), 'H3'],
  ['mixed', () => text('xoong.richtext.mixed', 'Mixed'), 'Mixed'],
]);

const query = (/** @type {string} */ command) => { try { return document.queryCommandState?.(command) ?? false; } catch { return false; } };
const block = () => { try { return String(document.queryCommandValue?.('formatBlock') ?? '').toLowerCase().replace(/[<>]/g, ''); } catch { return ''; } };
const exec = (/** @type {string} */ command, /** @type {string} */ value = '') => { try { return document.execCommand?.(command, false, value) ?? false; } catch { return false; } };
const esc = (/** @type {string} */ s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
/** The position of a node inside `root` as child indexes, and back: a selection that survives the editor being moved (a moved node loses its ranges). */
const pathOf = (/** @type {Node} */ root, /** @type {Node | null} */ node) => { /** @type {number[]} */ const path = []; for (let n = node; n && n !== root; n = n.parentNode) path.unshift([.../** @type {Node} */ (n.parentNode).childNodes].indexOf(/** @type {ChildNode} */ (n))); return path; };
const nodeAt = (/** @type {Node} */ root, /** @type {number[]} */ path) => path.reduce((/** @type {Node | undefined} */ n, i) => n?.childNodes[i], root);
function anchorAtSelection() {
  const node = getSelection()?.anchorNode;
  const el = node instanceof Element ? node : node?.parentElement;
  return el?.closest('a') ?? null;
}

class XoRichtext extends XoControl {
  static props = { ...XoControl.props, label: String, placeholder: String, tools: String, toolbar: String, media: Boolean, maxlength: Number };

  /** @type {HTMLElement | null} */ #editor = null;
  /** @type {HTMLElement | null} */ #toolbar = null;
  /** @type {HTMLElement | null} */ #box = null;
  /** @type {HTMLElement | null} */ #more = null;
  /** @type {ResizeObserver | null} */ #resize = null;
  #size = '';
  #moving = false;
  /** @type {HTMLDialogElement | null} */ #dialog = null;
  /** @type {Comment | null} */ #marker = null;
  /** @type {HTMLElement | null} */ #linkBox = null;
  /** @type {HTMLInputElement | null} */ #linkInput = null;
  /** @type {HTMLElement | null} */ #linkError = null;
  /** @type {Range | null} */ #saved = null;
  #fromUser = false;
  #built = false;
  #id = `xo-richtext-${++counter}`;
  #onPointer = (/** @type {Event} */ event) => { if (this.#more && !this.#more.hidden && !/** @type {Element} */ (event.target).closest('.xo-richtext-morewrap')) this.#closeMore(); };
  #onSelection = () => { if (this.#editor && this.#box?.contains(getSelection()?.anchorNode ?? null)) this.#refreshState(); };

  get focusTarget() { return this.#editor; }

  /** Moving the editor into or out of its dialog moves the focus too, which is not the person leaving the field. */
  markTouched() {
    if (this.#dialog || this.#moving) return;
    super.markTouched();
  }

  setValue(v) {
    const clean = sanitizeHtml(typeof v === 'string' ? v : v == null ? '' : String(v));
    super.setValue(clean);
    if (this.#built && !this.#fromUser && this.#editor) this.#show(clean);
  }

  /** Back to the start value, in the editor too (the base class resets the value without going through setValue). */
  reset() {
    super.reset();
    if (this.#built) this.#show(String(this.value));
  }

  validate(value) {
    const limit = this.maxlength;
    if (limit > 0 && textOf(String(value)).length > limit) return text('xoong.richtext.tooLong', 'Use at most {max} characters.', { max: limit });
    return '';
  }

  isEmpty(v) { return !v || (textOf(String(v)).trim() === '' && !/<img\b/.test(String(v))); }

  // ---- lifecycle -----------------------------------------------------------------------------------------------------------

  connected() {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => this.#build(), { once: true });
    else queueMicrotask(() => this.#build());
    document.addEventListener('selectionchange', this.#onSelection);
    document.addEventListener('pointerdown', this.#onPointer);
  }

  disconnected() { document.removeEventListener('selectionchange', this.#onSelection); document.removeEventListener('pointerdown', this.#onPointer); this.#resize?.disconnect(); }

  #build() {
    if (this.#built || !this.isConnected) return;
    const initial = this.value !== '' ? String(this.value) : this.innerHTML.trim(); // markup inside the element is the start value
    this.replaceChildren();

    const box = document.createElement('div');
    box.className = 'xo-richtext-box';
    const toolbar = document.createElement('div');
    toolbar.className = 'xo-richtext-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', text('xoong.richtext.toolbar', 'Formatting'));
    toolbar.setAttribute('aria-controls', `${this.#id}-editor`);
    const names = (this.tools || DEFAULT_TOOLS).split(/[\s,]+/).filter((n) => n in TOOLS && n !== 'more' && (n !== 'image' || this.media));
    names.forEach((name, i) => toolbar.append(this.#item(name, i === 0)));
    const moved = MORE_ITEMS.filter((n) => names.includes(n));
    if (moved.length) { // the compact toolbar keeps these in a menu
      const wrap = document.createElement('div');
      wrap.className = 'xo-richtext-morewrap';
      wrap.hidden = true;
      const more = this.#item('more', false);
      const menu = document.createElement('div');
      menu.className = 'xo-richtext-more';
      menu.id = `${this.#id}-more`;
      menu.setAttribute('role', 'menu');
      menu.setAttribute('aria-label', TOOLS.more.label());
      menu.hidden = true;
      more.setAttribute('aria-haspopup', 'menu');
      more.setAttribute('aria-expanded', 'false');
      more.setAttribute('aria-controls', menu.id);
      for (const name of moved) menu.append(this.#item(name, false, true));
      wrap.append(more, menu);
      toolbar.append(wrap);
      this.#more = menu;
    }

    const linkBox = document.createElement('div');
    linkBox.className = 'xo-richtext-link';
    linkBox.hidden = true;
    const linkInput = document.createElement('input');
    linkInput.type = 'text';
    linkInput.inputMode = 'url';
    linkInput.setAttribute('aria-label', text('xoong.richtext.linkUrl', 'Link address'));
    linkInput.placeholder = 'https://';
    const apply = document.createElement('button');
    apply.type = 'button'; apply.dataset.action = 'apply'; apply.textContent = text('xoong.richtext.apply', 'Apply');
    const remove = document.createElement('button');
    remove.type = 'button'; remove.dataset.action = 'remove'; remove.textContent = text('xoong.richtext.removeLink', 'Remove link');
    const error = document.createElement('small');
    error.className = 'xo-richtext-error';
    error.setAttribute('role', 'alert');
    linkBox.append(linkInput, apply, remove, error);

    const editor = document.createElement('div');
    editor.id = `${this.#id}-editor`;
    editor.className = 'xo-richtext-editable';
    editor.setAttribute('role', 'textbox');
    editor.setAttribute('aria-multiline', 'true');
    editor.setAttribute('aria-label', this.label || this.name || text('xoong.richtext.editor', 'Rich text'));
    if (this.placeholder) editor.dataset.placeholder = this.placeholder;

    box.append(toolbar, linkBox, editor);
    this.append(box);
    this.#box = box;
    this.#toolbar = toolbar; this.#linkBox = linkBox; this.#linkInput = linkInput; this.#linkError = error; this.#editor = editor;
    this.#built = true;
    this.#wire(box, toolbar, linkBox, editor);
    this.#applySize();
    if (typeof ResizeObserver !== 'undefined') { this.#resize = new ResizeObserver(() => this.#applySize()); this.#resize.observe(box); }
    this.setValue(initial);
    this.#enable();
    this.markPristine();
  }

  attributeChangedCallback(attr, old, value) {
    super.attributeChangedCallback(attr, old, value);
    if (this.#built && (attr === 'disabled' || attr === 'readonly')) this.#enable();
    if (this.#built && attr === 'placeholder' && this.#editor) this.#editor.dataset.placeholder = value ?? '';
  }

  /** One toolbar item: a button, or the text style select. */
  #item(/** @type {string} */ name, /** @type {boolean} */ first, /** @type {boolean} */ inMenu = false) {
    const tool = /** @type {any} */ (TOOLS)[name];
    const caption = tool.label();
    if (name === 'style') {
      const select = document.createElement('select');
      select.dataset.tool = name;
      select.tabIndex = first ? 0 : -1;
      select.setAttribute('aria-label', caption);
      select.title = caption;
      for (const [value, label, short] of STYLE_OPTIONS) {
        const option = document.createElement('option');
        option.value = value;
        option.dataset.short = short;
        option.textContent = label();
        if (value === 'mixed') option.disabled = true; // shown when the selection spans different blocks; not a choice
        select.append(option);
      }
      return select;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.tool = name;
    button.tabIndex = first ? 0 : -1;
    button.textContent = tool.face;
    button.setAttribute('aria-label', caption);
    button.title = caption;
    if (tool.state) button.setAttribute('aria-pressed', 'false');
    if (inMenu) { button.setAttribute('role', 'menuitem'); button.tabIndex = -1; button.textContent = `${tool.face}  ${caption}`; }
    return button;
  }

  /** The toolbar items that are shown, in order (the ones inside the More menu are not part of the toolbar's tab order). */
  #items() {
    return /** @type {HTMLElement[]} */ ([...(this.#toolbar?.querySelectorAll('[data-tool]') ?? [])]).filter((el) => !el.closest('.xo-richtext-more') && !el.hidden && !el.closest('[hidden]'));
  }

  /**
   * Full (every tool) from 580px of the editor's own width, compact (the common tools and a More menu) below: never wrapped, never scrolled sideways.
   * `toolbar="full"` or `toolbar="compact"` forces one; a width of 0 (not laid out) counts as full.
   */
  #applySize() {
    const toolbar = this.#toolbar;
    if (!toolbar || !this.#box) return;
    const width = this.#box.getBoundingClientRect().width;
    const size = this.toolbar === 'compact' || this.toolbar === 'full' ? this.toolbar : width > 0 && width < FULL_FROM ? 'compact' : 'full';
    if (size === this.#size) return;
    this.#size = size;
    toolbar.dataset.size = size;
    const compact = size === 'compact';
    for (const el of /** @type {HTMLElement[]} */ ([...toolbar.children])) {
      if (el.classList.contains('xo-richtext-morewrap')) el.hidden = !compact;
      else el.hidden = compact && MORE_ITEMS.includes(/** @type {string} */ (el.dataset.tool));
    }
    for (const option of toolbar.querySelectorAll('select[data-tool=style] option')) {
      const o = /** @type {HTMLOptionElement} */ (option);
      const full = STYLE_OPTIONS.find(([v]) => v === o.value)?.[1]();
      o.textContent = compact ? (o.dataset.short ?? '') : (full ?? '');
    }
    if (!compact) this.#closeMore();
    const items = this.#items();
    if (!items.some((el) => el.tabIndex === 0) && items[0]) items[0].tabIndex = 0; // always one tab stop
    for (const el of items) if (el !== items.find((i) => i.tabIndex === 0)) el.tabIndex = -1;
  }

  #enable() {
    const on = !this.isDisabled && !this.readonly;
    this.#editor?.setAttribute('contenteditable', String(on));
    this.#editor?.toggleAttribute('aria-readonly', !on);
    for (const b of /** @type {NodeListOf<HTMLButtonElement>} */ (this.#box?.querySelectorAll('.xo-richtext-toolbar button, .xo-richtext-toolbar select') ?? [])) b.disabled = !on;
  }

  #show(/** @type {string} */ html) {
    const editor = this.#editor;
    if (!editor) return;
    if (sanitizeHtml(editor.innerHTML) !== html) editor.innerHTML = html; // rewriting the content moves the caret: only when it really differs
    editor.toggleAttribute('data-empty', this.isEmpty(html));
  }

  // ---- events ------------------------------------------------------------------------------------------------------------

  #wire(/** @type {HTMLElement} */ box, /** @type {HTMLElement} */ toolbar, /** @type {HTMLElement} */ linkBox, /** @type {HTMLElement} */ editor) {
    editor.addEventListener('focus', () => { exec('defaultParagraphSeparator', 'p'); exec('styleWithCSS', 'false'); });
    // the editor's own input and change events are not the control's: only userInput speaks for the control
    editor.addEventListener('input', (event) => { event.stopPropagation(); this.#commit(); });
    editor.addEventListener('change', (event) => event.stopPropagation());
    editor.addEventListener('paste', (event) => { event.preventDefault(); this.#insertFrom(/** @type {ClipboardEvent} */ (event).clipboardData); });
    editor.addEventListener('drop', (event) => { event.preventDefault(); this.#insertFrom(/** @type {DragEvent} */ (event).dataTransfer); });
    editor.addEventListener('dragover', (event) => event.preventDefault());
    editor.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && this.#tool('link')) { event.preventDefault(); this.#openLink(); }
    });
    // while expanded, focus leaving is the dialog closing, not the person leaving the field
    editor.addEventListener('blur', () => { if (!this.#dialog && !this.contains(document.activeElement) && !this.#moving) this.markTouched(); });
    editor.addEventListener('keyup', () => this.#refreshState());
    editor.addEventListener('mouseup', () => this.#refreshState());

    toolbar.addEventListener('mousedown', (event) => { if (/** @type {Element} */ (event.target).closest('button')) event.preventDefault(); }); // keep the selection in the editor
    toolbar.addEventListener('click', (event) => {
      const button = /** @type {Element} */ (event.target).closest('button');
      if (!(button instanceof HTMLButtonElement) || button.disabled) return;
      const name = /** @type {string} */ (button.dataset.tool);
      if (name === 'more') { this.#more?.hidden ? this.#openMore() : this.#closeMore(); return; }
      if (button.closest('.xo-richtext-more')) this.#closeMore();
      this.#run(name);
    });
    // the text style select keeps the editor's selection from when it was opened, and applies the choice there
    const style = /** @type {HTMLSelectElement | null} */ (toolbar.querySelector('select[data-tool=style]'));
    const saveSelection = () => { const sel = getSelection(); if (sel?.rangeCount && editor.contains(sel.anchorNode)) this.#saved = sel.getRangeAt(0).cloneRange(); };
    style?.addEventListener('mousedown', saveSelection);
    style?.addEventListener('focus', saveSelection);
    style?.addEventListener('change', () => {
      const sel = getSelection();
      if (this.#saved && sel) { sel.removeAllRanges(); sel.addRange(this.#saved); }
      editor.focus();
      exec('formatBlock', style.value);
      this.#commit();
      this.#refreshState();
    });
    toolbar.addEventListener('keydown', (event) => this.#toolbarKey(event));

    linkBox.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); this.#applyLink(); }
      else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.#closeLink(); }
    });
    linkBox.addEventListener('click', (event) => {
      const action = /** @type {HTMLElement | null} */ (/** @type {Element} */ (event.target).closest('button'))?.dataset.action;
      if (action === 'apply') this.#applyLink();
      else if (action === 'remove') { this.#restore(); exec('unlink'); this.#closeLink(); this.#commit(); }
    });
    void box;
  }

  #tool(/** @type {string} */ name) { return this.#toolbar?.querySelector(`[data-tool="${name}"]`) ?? null; }

  #toolbarKey(/** @type {KeyboardEvent} */ event) {
    const target = /** @type {HTMLElement} */ (event.target);
    if (target.closest('.xo-richtext-more')) { this.#menuKey(event); return; }
    const items = this.#items();
    const at = items.indexOf(target);
    if (at < 0) return;
    if (target.dataset.tool === 'more' && event.key === 'ArrowDown') { event.preventDefault(); this.#openMore(true); return; }
    if (target.localName === 'select' && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) return; // the select's own keys
    const next = event.key === 'ArrowRight' ? (at + 1) % items.length : event.key === 'ArrowLeft' ? (at - 1 + items.length) % items.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    items.forEach((b, i) => { b.tabIndex = i === next ? 0 : -1; });
    items[next].focus();
  }

  // ---- the More menu (compact toolbar) -------------------------------------------------------------------------------------

  #openMore(focusFirst = false) {
    const menu = this.#more;
    if (!menu) return;
    if (menu.hidden) { menu.hidden = false; menu.previousElementSibling?.setAttribute('aria-expanded', 'true'); }
    if (focusFirst) /** @type {HTMLElement | null} */ (menu.firstElementChild)?.focus();
  }

  #closeMore(focus = false) {
    const menu = this.#more;
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    const trigger = /** @type {HTMLElement | null} */ (menu.previousElementSibling);
    trigger?.setAttribute('aria-expanded', 'false');
    if (focus) trigger?.focus();
  }

  #menuKey(/** @type {KeyboardEvent} */ event) {
    const items = /** @type {HTMLElement[]} */ ([...(this.#more?.children ?? [])]);
    const at = items.indexOf(/** @type {HTMLElement} */ (event.target));
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.#closeMore(true); return; }
    if (event.key === 'Tab') { this.#closeMore(); return; }
    const next = event.key === 'ArrowDown' ? (at + 1) % items.length : event.key === 'ArrowUp' ? (at - 1 + items.length) % items.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    items[next].focus();
  }

  #run(/** @type {string} */ name) {
    const editor = this.#editor;
    if (!editor) return;
    if (name === 'link') { this.#openLink(); return; }
    if (name === 'image') { this.#pickMedia(); return; }
    editor.focus();
    if (name === 'bold') exec('bold');
    else if (name === 'italic') exec('italic');
    else if (name === 'underline') exec('underline');
    else if (name === 'ul') exec('insertUnorderedList');
    else if (name === 'ol') exec('insertOrderedList');
    else if (name === 'undo') exec('undo');
    else if (name === 'redo') exec('redo');
    else if (name === 'h2') exec('formatBlock', block() === 'h2' ? 'p' : 'h2');
    else if (name === 'quote') exec('formatBlock', block() === 'blockquote' ? 'p' : 'blockquote');
    this.#commit();
    this.#refreshState();
  }

  /** The editor's content became the value (sanitised); the editor itself is left alone so the caret stays. */
  #commit() {
    const editor = this.#editor;
    if (!editor) return;
    const clean = this.isEmpty(editor.innerHTML) ? '' : sanitizeHtml(editor.innerHTML);
    editor.toggleAttribute('data-empty', clean === '');
    if (clean === this.value) return;
    this.#fromUser = true;
    try { this.userInput(clean); } finally { this.#fromUser = false; }
  }

  #refreshState() {
    for (const button of /** @type {NodeListOf<HTMLButtonElement>} */ (this.#box?.querySelectorAll('.xo-richtext-toolbar button[aria-pressed]') ?? [])) {
      const tool = /** @type {any} */ (TOOLS)[/** @type {string} */ (button.dataset.tool)];
      button.setAttribute('aria-pressed', String(!!tool?.state?.()));
    }
    const style = /** @type {HTMLSelectElement | null} */ (this.#box?.querySelector('select[data-tool=style]') ?? null);
    if (style) style.value = this.#blockStyle();
  }

  /** The text style at the selection: p, h2 or h3, or `mixed` when it spans different blocks (or a list or a quote). */
  #blockStyle() {
    const editor = this.#editor;
    const selection = getSelection();
    if (!editor || !selection?.rangeCount || !editor.contains(selection.anchorNode)) return 'p';
    const range = selection.getRangeAt(0);
    const blocks = /** @type {Element[]} */ ([...editor.children]).filter((c) => (range.intersectsNode ? range.intersectsNode(c) : c.contains(selection.anchorNode)));
    const kinds = new Set(blocks.map((c) => /** @type {Record<string, string>} */ ({ P: 'p', H2: 'h2', H3: 'h3' })[c.tagName] ?? 'other'));
    if (!kinds.size) return 'p';
    return kinds.size === 1 && !kinds.has('other') ? /** @type {string} */ ([...kinds][0]) : 'mixed';
  }

  // ---- expanding into a dialog -------------------------------------------------------------------------------------------

  /** Whether the editor is open in its dialog. */
  get expanded() { return !!this.#dialog; }

  /**
   * Open the same editor in a large dialog (960px; the whole screen under 768px). The editor moves, it is not copied: the value, the selection and the undo
   * history are the same. Done and Escape close it. Nothing is saved by this: it only changes where the editor is shown. Fires `xo-richtext-expand`.
   */
  expand() {
    const box = this.#box;
    if (!box || this.#dialog) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'xo-richtext-dialog';
    dialog.setAttribute('aria-label', this.label || this.name || text('xoong.richtext.editor', 'Rich text'));
    const bar = document.createElement('div');
    bar.className = 'xo-richtext-dialog-bar';
    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'xo-richtext-done';
    done.textContent = text('xoong.richtext.done', 'Done');
    done.addEventListener('click', () => this.collapse());
    bar.append(done);
    const caret = this.#saveCaret();
    this.#marker = document.createComment('xo-richtext');
    this.#moving = true;
    box.replaceWith(this.#marker);
    dialog.append(bar, box);
    document.body.append(dialog);
    this.#dialog = dialog;
    dialog.addEventListener('close', () => this.#restoreBox()); // Escape closes a native dialog, and so does collapse()
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
    this.#moving = false;
    this.#applySize();
    this.#editor?.focus();
    this.#restoreCaret(caret);
    this.dispatchEvent(new CustomEvent('xo-richtext-expand', { bubbles: true }));
  }

  /** Close the dialog and put the editor back (what Done and Escape do). Fires `xo-richtext-done`. */
  collapse() {
    const dialog = this.#dialog;
    if (!dialog) return;
    if (dialog.close) dialog.close(); else this.#restoreBox();
  }

  /** Where the caret or selection is in the editor, as paths, or null. */
  #saveCaret() {
    const editor = this.#editor;
    const sel = getSelection();
    if (!editor || !sel?.rangeCount || !editor.contains(sel.anchorNode) || !editor.contains(sel.focusNode)) return null;
    return { a: pathOf(editor, sel.anchorNode), ao: sel.anchorOffset, f: pathOf(editor, sel.focusNode), fo: sel.focusOffset };
  }

  #restoreCaret(/** @type {{ a: number[], ao: number, f: number[], fo: number } | null} */ caret) {
    const editor = this.#editor;
    if (!caret || !editor) return;
    const anchor = nodeAt(editor, caret.a);
    const focus = nodeAt(editor, caret.f);
    if (anchor && focus) getSelection()?.setBaseAndExtent(anchor, caret.ao, focus, caret.fo);
  }

  #restoreBox() {
    const dialog = this.#dialog;
    const box = this.#box;
    if (!dialog || !box || !this.#marker) return;
    this.#dialog = null;
    this.#moving = true;
    const caret = this.#saveCaret();
    this.#marker.replaceWith(box);
    this.#marker = null;
    dialog.remove();
    this.#moving = false;
    this.#applySize();
    this.#editor?.focus();
    this.#restoreCaret(caret);
    this.dispatchEvent(new CustomEvent('xo-richtext-done', { bubbles: true }));
  }

  // ---- paste, drop ---------------------------------------------------------------------------------------------------------

  #insertFrom(/** @type {DataTransfer | null} */ data) {
    if (!data || !this.#editor || this.readonly || this.isDisabled) return;
    const html = data.getData('text/html');
    const plain = data.getData('text/plain');
    this.#editor.focus();
    if (html) { exec('insertHTML', sanitizeHtml(html)); }
    else if (plain) {
      const paragraphs = plain.replace(/\r\n?/g, '\n').split(/\n{2,}/);
      if (paragraphs.length === 1 && !plain.includes('\n')) exec('insertText', plain);
      else exec('insertHTML', paragraphs.map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join(''));
    }
    this.#commit();
  }

  // ---- links ---------------------------------------------------------------------------------------------------------------

  #openLink() {
    const input = this.#linkInput;
    if (!input || !this.#linkBox) return;
    const selection = getSelection();
    this.#saved = selection && selection.rangeCount && this.#editor?.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null;
    input.value = anchorAtSelection()?.getAttribute('href') ?? '';
    this.#setLinkError('');
    this.#linkBox.hidden = false;
    input.focus();
    input.select();
  }

  #closeLink() {
    if (!this.#linkBox || this.#linkBox.hidden) return;
    this.#linkBox.hidden = true;
    this.#restore();
    this.#editor?.focus();
  }

  #restore() {
    const selection = getSelection();
    if (this.#saved && selection) { selection.removeAllRanges(); selection.addRange(this.#saved); }
    this.#editor?.focus();
    const link = anchorAtSelection();
    if (link && selection?.isCollapsed) selection.selectAllChildren(link); // a caret inside a link means the whole link
  }

  #setLinkError(/** @type {string} */ message) {
    if (this.#linkError) this.#linkError.textContent = message;
    if (message) this.#linkInput?.setAttribute('aria-invalid', 'true'); else this.#linkInput?.removeAttribute('aria-invalid');
  }

  /** A typed address made into a link target: "a@b.test" -> mailto:, "example.com" -> https://. */
  static linkTarget(/** @type {string} */ raw) {
    const url = raw.trim();
    if (!url) return '';
    if (/^[^\s@:/]+@[^\s@:/]+\.[^\s@:/]+$/.test(url)) return `mailto:${url}`;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && /^[^\s/]+\.[a-z]{2,}([/?#]|$)/i.test(url)) return `https://${url}`;
    return url;
  }

  #applyLink() {
    const url = XoRichtext.linkTarget(this.#linkInput?.value ?? '');
    if (!url) { this.#restore(); exec('unlink'); this.#closeLink(); this.#commit(); return; }
    if (!isSafeLink(url)) { this.#setLinkError(text('xoong.richtext.linkInvalid', 'Use an address that starts with http://, https://, mailto: or tel:.')); this.#linkInput?.focus(); return; }
    if (this.#linkBox) this.#linkBox.hidden = true;
    this.#restore();
    const selection = getSelection();
    if (selection && selection.isCollapsed && !anchorAtSelection()) exec('insertHTML', `<a href="${esc(url)}">${esc(url)}</a>`);
    else exec('createLink', url);
    this.#commit();
    this.#refreshState();
  }

  // ---- media ---------------------------------------------------------------------------------------------------------------

  #pickMedia() {
    const selection = getSelection();
    const saved = selection && selection.rangeCount && this.#editor?.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null;
    const insert = (/** @type {{ src: string, alt?: string } | string} */ media, /** @type {string} */ alt = '') => {
      const { src, alt: a = alt } = typeof media === 'string' ? { src: media, alt } : media;
      this.insertImage(src, a, saved);
    };
    this.dispatchEvent(new CustomEvent('xo-pick-media', { bubbles: true, cancelable: true, detail: { insert } }));
  }

  /** Insert an image (http, https or a relative URL) at the caret. */
  insertImage(/** @type {string} */ src, alt = '', /** @type {Range | null} */ at = null) {
    if (!this.#editor || this.readonly || this.isDisabled) return false;
    const html = sanitizeHtml(`<img src="${esc(src)}" alt="${esc(alt)}">`);
    if (!html.includes('<img')) return false;
    this.#editor.focus();
    const selection = getSelection();
    if (at && selection) { selection.removeAllRanges(); selection.addRange(at); }
    // A Range, not execCommand: Chromium's insertHTML copies computed styles into a style="" attribute, which a strict CSP reports.
    const template = document.createElement('template');
    template.innerHTML = html.replace(/^<p>|<\/p>$/g, '');
    const img = template.content.firstChild;
    const editor = this.#editor;
    const range = selection && selection.rangeCount && editor.contains(selection.anchorNode) ? selection.getRangeAt(0) : null;
    if (!img) return false;
    let heading = range?.startContainer ?? null;
    while (heading && heading.parentNode !== editor) heading = heading.parentNode;
    if (range && heading && /^H[1-6]$/.test(heading.nodeName)) { // an image in a heading is rarely wanted: a paragraph of its own after it
      const p = document.createElement('p');
      p.append(img);
      heading.after(p);
      range.setStartAfter(img);
    } else if (range) {
      range.deleteContents();
      range.insertNode(img);
      range.setStartAfter(img);
    } else editor.append(img);
    if (selection && range) { range.collapse(true); selection.removeAllRanges(); selection.addRange(range); }
    this.#commit();
    return true;
  }
}
define('xo-richtext', XoRichtext);
