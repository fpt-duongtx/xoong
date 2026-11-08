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
const buttons = () => [...document.querySelectorAll('.xo-richtext-toolbar [data-tool]')].filter((b) => !b.closest('.xo-richtext-more') && !b.hidden && !b.closest('[hidden]')); // the visible items of the toolbar itself (not those inside the More menu)
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
    expect(buttons().map((b) => b.dataset.tool)).toEqual(['undo', 'redo', 'style', 'bold', 'italic', 'underline', 'ul', 'ol', 'quote', 'link']);
    expect(buttons().map((b) => b.tabIndex)).toEqual([0, -1, -1, -1, -1, -1, -1, -1, -1, -1]); // one tab stop
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
    await mount('media');
    expect(buttons().map((b) => b.dataset.tool).slice(-2)).toEqual(['link', 'image']); // image closes the full toolbar
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
    click('bold'); click('italic'); click('underline'); click('ul'); click('ol'); click('undo'); click('redo');
    expect(exec.mock.calls.map((c) => c[0]).filter((c) => c !== 'defaultParagraphSeparator' && c !== 'styleWithCSS'))
      .toEqual(['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList', 'undo', 'redo']);
    click('quote');
    expect(exec).toHaveBeenCalledWith('formatBlock', false, 'blockquote');
    expect(el.value).toBe('');
    await mount('tools="h2"');
    click('h2'); // the heading toggle, for apps that want it instead of the select
    expect(exec).toHaveBeenCalledWith('formatBlock', false, 'h2');
  });

  it('the toolbar is one tab stop; arrows, Home and End move within it', async () => {
    await mount();
    buttons()[0].focus();
    key(buttons()[0], 'ArrowRight');
    expect(document.activeElement).toBe(buttons()[1]);
    expect(buttons().map((b) => b.tabIndex)).toEqual([-1, 0, -1, -1, -1, -1, -1, -1, -1, -1]);
    key(buttons()[1], 'End');
    expect(document.activeElement).toBe(buttons()[9]);
    key(buttons()[9], 'ArrowRight');
    expect(document.activeElement).toBe(buttons()[0]); // wraps
    key(buttons()[0], 'ArrowLeft');
    expect(document.activeElement).toBe(buttons()[9]);
    key(buttons()[9], 'Home');
    expect(document.activeElement).toBe(buttons()[0]);
  });

  it('the text style select applies the choice at the saved selection and shows Mixed over different blocks', async () => {
    await mount();
    editor().innerHTML = '<p>one</p><h2>two</h2>';
    const select = document.querySelector('select[data-tool=style]');
    expect([...select.options].map((o) => o.value)).toEqual(['p', 'h2', 'h3', 'mixed']);
    expect(select.options[3].disabled).toBe(true);
    const range = document.createRange();
    range.setStart(editor().firstChild.firstChild, 1);
    range.setEnd(editor().lastChild.firstChild, 1);
    getSelection().removeAllRanges(); getSelection().addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    expect(select.value).toBe('mixed'); // a paragraph and a heading
    range.setEnd(editor().firstChild.firstChild, 2);
    document.dispatchEvent(new Event('selectionchange'));
    expect(select.value).toBe('p');
    select.value = 'h3';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(exec).toHaveBeenCalledWith('formatBlock', false, 'h3');
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
    expect(editor().querySelector('img')?.getAttribute('src')).toBe('/media/a.png');
    expect(exec).not.toHaveBeenCalledWith('insertHTML', false, expect.stringContaining('<img')); // a Range: no style="" copied under a strict CSP
    exec.mockClear();
    expect(el.insertImage('javascript:alert(1)')).toBe(false);
    expect(el.insertImage('data:image/svg+xml,<svg>')).toBe(false);
    expect(exec).not.toHaveBeenCalled();
    expect(el.insertImage('https://x.test/b.png')).toBe(true);
  });

  it('an image inserted with the caret in a heading lands in a paragraph after it; in a paragraph it goes inline at the caret', async () => {
    const el = await mount('media');
    editor().innerHTML = '<h2>Title</h2><p>Body text.</p>';
    const at = (node, offset) => { const r = document.createRange(); r.setStart(node, offset); r.collapse(true); return r; };
    expect(el.insertImage('/media/a.png', 'A', at(editor().querySelector('h2').firstChild, 2))).toBe(true);
    expect(editor().innerHTML).toBe('<h2>Title</h2><p><img src="/media/a.png" alt="A"></p><p>Body text.</p>');
    el.insertImage('/media/b.png', 'B', at(editor().querySelectorAll('p')[1].firstChild, 4));
    expect(editor().querySelectorAll('p')[1].innerHTML).toBe('Body<img src="/media/b.png" alt="B"> text.');
  });
});

describe('toolbar sizes, the More menu and expanding', () => {
  const more = () => document.querySelector('[data-tool=more]');
  const menu = () => document.querySelector('.xo-richtext-more');
  const menuItems = () => [...menu().children];

  it('compact: the common tools stay, the rest moves into a More menu; full shows everything and no More', async () => {
    await mount('toolbar="compact"');
    expect(buttons().map((b) => b.dataset.tool)).toEqual(['style', 'bold', 'italic', 'ul', 'link', 'more']);
    expect(menuItems().map((i) => i.dataset.tool)).toEqual(['underline', 'ol', 'quote', 'undo', 'redo']);
    expect([...document.querySelector('select[data-tool=style]').options].map((o) => o.textContent)).toEqual(['P', 'H2', 'H3', 'Mixed']);
    await mount('toolbar="full"');
    expect(buttons().map((b) => b.dataset.tool)).not.toContain('more');
    expect([...document.querySelector('select[data-tool=style]').options].map((o) => o.textContent)).toEqual(['Paragraph', 'Heading 2', 'Heading 3', 'Mixed']);
  });

  it('the editor\'s own width decides when the size is automatic', async () => {
    const el = await mount();
    const box = document.querySelector('.xo-richtext-box');
    expect(document.querySelector('.xo-richtext-toolbar').dataset.size).toBe('full'); // not laid out: full
    box.getBoundingClientRect = () => ({ width: 340 });
    el.setAttribute('toolbar', 'auto'); // any change re-reads nothing by itself: the ResizeObserver does; call through the attribute path
    el.removeAttribute('toolbar');
    // no ResizeObserver in this DOM: expand/collapse re-measure, which a real layout change does through the observer
    el.expand();
    expect(document.querySelector('.xo-richtext-toolbar').dataset.size).toBe('compact');
    box.getBoundingClientRect = () => ({ width: 700 });
    el.collapse();
    expect(document.querySelector('.xo-richtext-toolbar').dataset.size).toBe('full');
  });

  it('the More button opens the menu (aria-expanded), arrows move, Escape closes and returns to the button, an item runs and closes', async () => {
    await mount('toolbar="compact"');
    more().focus();
    more().click();
    expect(menu().hidden).toBe(false);
    expect(more().getAttribute('aria-expanded')).toBe('true');
    expect(menuItems().every((i) => i.getAttribute('role') === 'menuitem')).toBe(true);
    key(more(), 'ArrowDown');
    expect(document.activeElement).toBe(menuItems()[0]);
    key(menuItems()[0], 'ArrowDown');
    expect(document.activeElement).toBe(menuItems()[1]);
    key(menuItems()[1], 'ArrowUp'); key(menuItems()[0], 'ArrowUp');
    expect(document.activeElement).toBe(menuItems()[4]); // wraps
    key(menuItems()[4], 'End');
    expect(document.activeElement).toBe(menuItems()[4]);
    key(menuItems()[4], 'Home');
    expect(document.activeElement).toBe(menuItems()[0]);
    const esc = key(menuItems()[0], 'Escape');
    expect(esc.defaultPrevented).toBe(true);
    expect(menu().hidden).toBe(true);
    expect(document.activeElement).toBe(more());
    more().click();
    menuItems()[2].click(); // Quote
    expect(exec).toHaveBeenCalledWith('formatBlock', false, 'blockquote');
    expect(menu().hidden).toBe(true);
    more().click();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(menu().hidden).toBe(true);
    more().click();
    key(menuItems()[0], 'Tab');
    expect(menu().hidden).toBe(true);
  });

  it('expand() moves the editor into a dialog, Done and collapse() put it back, and the control is not marked touched by it', async () => {
    const el = await mount();
    const seen = [];
    el.addEventListener('xo-richtext-expand', () => seen.push('expand'));
    el.addEventListener('xo-richtext-done', () => seen.push('done'));
    typeHtml('<p>keep</p>');
    el.expand();
    const dialog = document.querySelector('dialog.xo-richtext-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-label')).toBe('Body');
    expect(dialog.contains(editor())).toBe(true);
    expect(el.expanded).toBe(true);
    expect(el.contains(editor())).toBe(false);
    expect(el.value).toBe('<p>keep</p>'); // the same editor, not a copy
    expect(el.touched).toBe(false);
    dialog.querySelector('.xo-richtext-done').click();
    expect(document.querySelector('dialog')).toBeNull();
    expect(el.contains(editor())).toBe(true);
    expect(el.expanded).toBe(false);
    expect(seen).toEqual(['expand', 'done']);
    el.expand();
    el.collapse();
    expect(seen).toEqual(['expand', 'done', 'expand', 'done']);
    el.collapse(); // not expanded: nothing happens
    expect(seen.length).toBe(4);
  });
});
