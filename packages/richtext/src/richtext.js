// @ts-check
/**
 * <xo-richtext> is a small rich text editor and a form control: its value is sanitised HTML.
 *
 *   <xo-richtext name="body" label="Body" placeholder="Write something"></xo-richtext>
 *   <xo-richtext name="body" media tools="bold italic h2 ul ol quote link image undo redo"></xo-richtext>
 *
 * - A `contenteditable` area with a toolbar (`role="toolbar"`, one tab stop, Left/Right/Home/End move inside it). Tools: bold, italic, h2, ul, ol, quote,
 *   link, image, undo, redo; the `tools` attribute picks and orders them. `image` is only shown with the `media` attribute.
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
  h2: { label: () => text('xoong.richtext.h2', 'Heading'), face: 'H2', state: () => block() === 'h2' },
  ul: { label: () => text('xoong.richtext.ul', 'Bulleted list'), face: '•', state: () => query('insertUnorderedList') },
  ol: { label: () => text('xoong.richtext.ol', 'Numbered list'), face: '1.', state: () => query('insertOrderedList') },
  quote: { label: () => text('xoong.richtext.quote', 'Quote'), face: '“', state: () => block() === 'blockquote' },
  link: { label: () => text('xoong.richtext.link', 'Link'), face: '🔗', state: () => !!anchorAtSelection() },
  image: { label: () => text('xoong.richtext.image', 'Image'), face: '🖼' },
  undo: { label: () => text('xoong.richtext.undo', 'Undo'), face: '↶' },
  redo: { label: () => text('xoong.richtext.redo', 'Redo'), face: '↷' },
};
const DEFAULT_TOOLS = 'bold italic h2 ul ol quote link undo redo';

const query = (/** @type {string} */ command) => { try { return document.queryCommandState?.(command) ?? false; } catch { return false; } };
const block = () => { try { return String(document.queryCommandValue?.('formatBlock') ?? '').toLowerCase().replace(/[<>]/g, ''); } catch { return ''; } };
const exec = (/** @type {string} */ command, /** @type {string} */ value = '') => { try { return document.execCommand?.(command, false, value) ?? false; } catch { return false; } };
const esc = (/** @type {string} */ s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
function anchorAtSelection() {
  const node = getSelection()?.anchorNode;
  const el = node instanceof Element ? node : node?.parentElement;
  return el?.closest('a') ?? null;
}

class XoRichtext extends XoControl {
  static props = { ...XoControl.props, label: String, placeholder: String, tools: String, media: Boolean, maxlength: Number };

  /** @type {HTMLElement | null} */ #editor = null;
  /** @type {HTMLElement | null} */ #toolbar = null;
  /** @type {HTMLElement | null} */ #linkBox = null;
  /** @type {HTMLInputElement | null} */ #linkInput = null;
  /** @type {HTMLElement | null} */ #linkError = null;
  /** @type {Range | null} */ #saved = null;
  #fromUser = false;
  #built = false;
  #id = `xo-richtext-${++counter}`;
  #onSelection = () => { if (this.#editor && this.contains(getSelection()?.anchorNode ?? null)) this.#refreshState(); };

  get focusTarget() { return this.#editor; }

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
  }

  disconnected() { document.removeEventListener('selectionchange', this.#onSelection); }

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
    const names = (this.tools || (this.media ? DEFAULT_TOOLS.replace('undo', 'image undo') : DEFAULT_TOOLS)).split(/[\s,]+/).filter((n) => n in TOOLS && (n !== 'image' || this.media));
    names.forEach((name, i) => {
      const tool = /** @type {any} */ (TOOLS)[name];
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.tool = name;
      button.tabIndex = i === 0 ? 0 : -1;
      button.textContent = tool.face;
      const caption = tool.label();
      button.setAttribute('aria-label', caption);
      button.title = caption;
      if (tool.state) button.setAttribute('aria-pressed', 'false');
      toolbar.append(button);
    });

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
    this.#toolbar = toolbar; this.#linkBox = linkBox; this.#linkInput = linkInput; this.#linkError = error; this.#editor = editor;
    this.#built = true;
    this.#wire(box, toolbar, linkBox, editor);
    this.setValue(initial);
    this.#enable();
    this.markPristine();
  }

  attributeChangedCallback(attr, old, value) {
    super.attributeChangedCallback(attr, old, value);
    if (this.#built && (attr === 'disabled' || attr === 'readonly')) this.#enable();
    if (this.#built && attr === 'placeholder' && this.#editor) this.#editor.dataset.placeholder = value ?? '';
  }

  #enable() {
    const on = !this.isDisabled && !this.readonly;
    this.#editor?.setAttribute('contenteditable', String(on));
    this.#editor?.toggleAttribute('aria-readonly', !on);
    for (const b of /** @type {NodeListOf<HTMLButtonElement>} */ (this.querySelectorAll('.xo-richtext-toolbar button'))) b.disabled = !on;
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
    editor.addEventListener('blur', () => { if (!this.contains(document.activeElement)) this.markTouched(); });
    editor.addEventListener('keyup', () => this.#refreshState());
    editor.addEventListener('mouseup', () => this.#refreshState());

    toolbar.addEventListener('mousedown', (event) => { if (/** @type {Element} */ (event.target).closest('button')) event.preventDefault(); }); // keep the selection in the editor
    toolbar.addEventListener('click', (event) => {
      const button = /** @type {Element} */ (event.target).closest('button');
      if (button instanceof HTMLButtonElement && !button.disabled) this.#run(/** @type {string} */ (button.dataset.tool));
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
    const buttons = /** @type {HTMLButtonElement[]} */ ([...(this.#toolbar?.querySelectorAll('button') ?? [])]);
    const at = buttons.indexOf(/** @type {HTMLButtonElement} */ (event.target));
    if (at < 0) return;
    const next = event.key === 'ArrowRight' ? (at + 1) % buttons.length : event.key === 'ArrowLeft' ? (at - 1 + buttons.length) % buttons.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    buttons.forEach((b, i) => { b.tabIndex = i === next ? 0 : -1; });
    buttons[next].focus();
  }

  #run(/** @type {string} */ name) {
    const editor = this.#editor;
    if (!editor) return;
    if (name === 'link') { this.#openLink(); return; }
    if (name === 'image') { this.#pickMedia(); return; }
    editor.focus();
    if (name === 'bold') exec('bold');
    else if (name === 'italic') exec('italic');
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
    for (const button of /** @type {NodeListOf<HTMLButtonElement>} */ (this.querySelectorAll('.xo-richtext-toolbar button[aria-pressed]'))) {
      const tool = /** @type {any} */ (TOOLS)[/** @type {string} */ (button.dataset.tool)];
      button.setAttribute('aria-pressed', String(!!tool?.state?.()));
    }
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
    exec('insertHTML', html.replace(/^<p>|<\/p>$/g, ''));
    this.#commit();
    return true;
  }
}
define('xo-richtext', XoRichtext);
