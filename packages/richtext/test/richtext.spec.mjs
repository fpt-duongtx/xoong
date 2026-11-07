// Structure, keyboard, validation and the sanitising paths in happy-dom (which has no editing engine: execCommand is stubbed).
// The real editing is tested in a browser: richtext.test.mjs.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import '@xoong/richtext';

const wait = () => new Promise((r) => setTimeout(r, 0));
const mount = async (attrs = '', inner = '') => {
  document.body.innerHTML = `<form><xo-richtext name="body" label="Body" ${attrs}>${inner}</xo-richtext></form>`;
  await wait();
  return document.querySelector('xo-richtext');
};
const editor = () => document.querySelector('.xo-richtext-editable');
const buttons = () => [...document.querySelectorAll('.xo-richtext-toolbar button')];
const key = (el, k, init = {}) => { const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }); el.dispatchEvent(e); return e; };
const typeHtml = (html) => { editor().innerHTML = html; editor().dispatchEvent(new Event('input', { bubbles: true })); };

let exec;
beforeEach(() => { exec = vi.fn(() => true); document.execCommand = exec; });
afterEach(() => { document.body.innerHTML = ''; delete document.execCommand; });

describe('<xo-richtext>', () => {
  it('builds a toolbar and an editable textbox with roles and names', async () => {
    await mount('placeholder="Write"');
    const toolbar = document.querySelector('[role=toolbar]');
    expect(toolbar.getAttribute('aria-label')).toBe('Formatting');
    expect(toolbar.getAttribute('aria-controls')).toBe(editor().id);
    expect(buttons().map((b) => b.dataset.tool)).toEqual(['bold', 'italic', 'h2', 'ul', 'ol', 'quote', 'link', 'undo', 'redo']);
    expect(buttons().map((b) => b.tabIndex)).toEqual([0, -1, -1, -1, -1, -1, -1, -1, -1]); // one tab stop
    expect(buttons().every((b) => b.getAttribute('aria-label'))).toBe(true);
    expect(editor().getAttribute('role')).toBe('textbox');
    expect(editor().getAttribute('aria-multiline')).toBe('true');
    expect(editor().getAttribute('aria-label')).toBe('Body');
    expect(editor().getAttribute('contenteditable')).toBe('true');
    expect(editor().dataset.placeholder).toBe('Write');
    expect(editor().hasAttribute('data-empty')).toBe(true);
  });

  it('`tools` picks and orders the tools; image needs `media`', async () => {
    await mount('tools="italic bold image nothing"');
    expect(buttons().map((b) => b.dataset.tool)).toEqual(['italic', 'bold']);
    await mount('tools="bold image" media');
    expect(buttons().map((b) => b.dataset.tool)).toEqual(['bold', 'image']);
  });

  it('the markup inside the element is the start value, sanitised; `value` too; the control starts pristine', async () => {
    const el = await mount('', '<p onclick="x()">Hello <b>world</b><script>1</script></p>');
    expect(el.value).toBe('<p>Hello <strong>world</strong></p>');
    expect(editor().innerHTML).toBe('<p>Hello <strong>world</strong></p>');
    expect(el.dirty).toBe(false);
    expect(editor().hasAttribute('data-empty')).toBe(false);
    el.setValue('<img src="javascript:alert(1)" onerror=alert(1)><p>ok</p>');
    expect(el.value).toBe('<p>ok</p>');
    el.setValue('<p>a</p>');
    expect(editor().innerHTML).toBe('<p>a</p>');
  });

  it('typing makes the value the sanitised content, fires input once, and an emptied editor is ""', async () => {
    const el = await mount();
    const seen = [];
    el.addEventListener('input', () => seen.push(el.value));
    typeHtml('<div>typed <i>text</i></div><span style="color:red"> more</span>');
    expect(el.value).toBe('<p>typed <em>text</em></p><p> more</p>');
    expect(el.dirty).toBe(true);
    typeHtml('<p><br></p>');
    expect(el.value).toBe('');
    expect(editor().hasAttribute('data-empty')).toBe(true);
    expect(seen).toEqual(['<p>typed <em>text</em></p><p> more</p>', '']);
  });

  it('required counts an empty editor as empty; maxlength counts text characters', async () => {
    const el = await mount('required maxlength="5"');
    expect(el.validity.valueMissing).toBe(true);
    typeHtml('<p>abc</p>');
    expect(el.validity.valid).toBe(true);
    typeHtml('<p><strong>abcdef</strong></p>');
    expect(el.validationMessage).toBe('Use at most 5 characters.');
  });

  it('toolbar buttons run the browser editing commands, and the value follows', async () => {
    const el = await mount();
    const click = (tool) => buttons().find((b) => b.dataset.tool === tool).click();
    click('bold'); click('italic'); click('ul'); click('ol'); click('undo'); click('redo');
    expect(exec.mock.calls.map((c) => c[0]).filter((c) => c !== 'defaultParagraphSeparator' && c !== 'styleWithCSS'))
      .toEqual(['bold', 'italic', 'insertUnorderedList', 'insertOrderedList', 'undo', 'redo']);
    click('h2');
    expect(exec).toHaveBeenCalledWith('formatBlock', false, 'h2');
    click('quote');
    expect(exec).toHaveBeenCalledWith('formatBlock', false, 'blockquote');
    expect(el.value).toBe('');
  });

  it('the toolbar is one tab stop; arrows, Home and End move within it', async () => {
    await mount();
    buttons()[0].focus();
    key(buttons()[0], 'ArrowRight');
    expect(document.activeElement).toBe(buttons()[1]);
    expect(buttons().map((b) => b.tabIndex)).toEqual([-1, 0, -1, -1, -1, -1, -1, -1, -1]);
    key(buttons()[1], 'End');
    expect(document.activeElement).toBe(buttons()[8]);
    key(buttons()[8], 'ArrowRight');
    expect(document.activeElement).toBe(buttons()[0]); // wraps
    key(buttons()[0], 'ArrowLeft');
    expect(document.activeElement).toBe(buttons()[8]);
    key(buttons()[8], 'Home');
    expect(document.activeElement).toBe(buttons()[0]);
  });

  it('disabled and readonly turn editing and the toolbar off', async () => {
    const el = await mount('readonly');
    expect(editor().getAttribute('contenteditable')).toBe('false');
    expect(buttons().every((b) => b.disabled)).toBe(true);
    el.removeAttribute('readonly');
    expect(editor().getAttribute('contenteditable')).toBe('true');
    el.setAttribute('disabled', '');
    expect(buttons().every((b) => b.disabled)).toBe(true);
  });
});

describe('links', () => {
  const open = () => buttons().find((b) => b.dataset.tool === 'link').click();
  const box = () => document.querySelector('.xo-richtext-link');
  const input = () => box().querySelector('input');
  const apply = () => box().querySelector('[data-action=apply]').click();

  it('the link tool opens a box with an address field; Escape closes it and returns to the editor', async () => {
    await mount();
    expect(box().hidden).toBe(true);
    open();
    expect(box().hidden).toBe(false);
    expect(document.activeElement).toBe(input());
    key(input(), 'Escape');
    expect(box().hidden).toBe(true);
  });

  const selectText = () => {
    editor().innerHTML = '<p>some words</p>';
    const range = document.createRange();
    range.selectNodeContents(editor().firstChild);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  };

  it('only http, https, mailto and tel are accepted; a bare domain or an email is completed; the error is announced', async () => {
    await mount();
    selectText();
    open();
    input().value = 'javascript:alert(1)';
    apply();
    expect(box().hidden).toBe(false);
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(box().querySelector('[role=alert]').textContent).toContain('http://');
    expect(exec.mock.calls.some((c) => c[0] === 'createLink')).toBe(false);
    input().value = 'example.com/path';
    key(input(), 'Enter');
    expect(exec).toHaveBeenCalledWith('createLink', false, 'https://example.com/path');
    expect(box().hidden).toBe(true);
    selectText();
    open();
    input().value = 'me@example.com';
    apply();
    expect(exec).toHaveBeenCalledWith('createLink', false, 'mailto:me@example.com');
    selectText();
    open();
    input().value = 'tel:+84123456';
    apply();
    expect(exec).toHaveBeenCalledWith('createLink', false, 'tel:+84123456');
  });

  it('with nothing selected the address itself becomes the link text', async () => {
    await mount();
    editor().innerHTML = '<p>x</p>';
    getSelection().removeAllRanges();
    open();
    input().value = 'https://x.test/a&b';
    apply();
    expect(exec).toHaveBeenCalledWith('insertHTML', false, '<a href="https://x.test/a&amp;b">https://x.test/a&amp;b</a>');
  });

  it('an empty address removes the link', async () => {
    await mount();
    open();
    input().value = '';
    apply();
    expect(exec).toHaveBeenCalledWith('unlink', false, '');
  });
});

describe('paste, drop and media', () => {
  const clipboard = (data) => ({ getData: (type) => data[type] ?? '' });
  const paste = (data) => { const e = new Event('paste', { bubbles: true, cancelable: true }); e.clipboardData = clipboard(data); editor().dispatchEvent(e); return e; };

  it('pasted HTML is sanitised before it enters the editor, and the default paste is cancelled', async () => {
    await mount();
    const e = paste({ 'text/html': '<p style="x" onclick="a()">Hi <b>there</b></p><script>alert(1)</script><img src="javascript:alert(1)" onerror=alert(1)>' });
    expect(e.defaultPrevented).toBe(true);
    expect(exec).toHaveBeenCalledWith('insertHTML', false, '<p>Hi <strong>there</strong></p>');
  });

  it('pasted plain text: one line is inserted as text, several paragraphs become <p> with escaping and <br>', async () => {
    await mount();
    paste({ 'text/plain': 'one line' });
    expect(exec).toHaveBeenCalledWith('insertText', false, 'one line');
    paste({ 'text/plain': 'first <b>\nstill first\n\nsecond' });
    expect(exec).toHaveBeenCalledWith('insertHTML', false, '<p>first &lt;b&gt;<br>still first</p><p>second</p>');
  });

  it('a drop is handled like a paste (sanitised, the browser default cancelled)', async () => {
    await mount();
    const e = new Event('drop', { bubbles: true, cancelable: true });
    e.dataTransfer = clipboard({ 'text/html': '<img src="javascript:alert(1)" onerror=alert(1)><p>d</p>' });
    editor().dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(exec).toHaveBeenCalledWith('insertHTML', false, '<p>d</p>');
  });

  it('the image tool fires a cancelable xo-pick-media with insert(); insert puts a safe image in, an unsafe one is refused', async () => {
    const el = await mount('media');
    let detail;
    el.addEventListener('xo-pick-media', (e) => { e.preventDefault(); detail = e.detail; });
    buttons().find((b) => b.dataset.tool === 'image').click();
    expect(typeof detail.insert).toBe('function');
    detail.insert({ src: '/media/a.png', alt: 'A' });
    expect(exec).toHaveBeenCalledWith('insertHTML', false, '<img src="/media/a.png" alt="A">');
    exec.mockClear();
    expect(el.insertImage('javascript:alert(1)')).toBe(false);
    expect(el.insertImage('data:image/svg+xml,<svg>')).toBe(false);
    expect(exec).not.toHaveBeenCalled();
    expect(el.insertImage('https://x.test/b.png')).toBe(true);
  });
});
