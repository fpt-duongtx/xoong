// While an IME is composing (Vietnamese Telex and VNI, Chinese, Japanese), Enter picks a candidate, Escape cancels the composition and the
// arrows move through candidates: a control must not also act on them. Chrome reports `isComposing`, Safari ends a composition with
// keyCode 229 and `isComposing` already false, so both are checked.
import { describe, it, expect, afterEach, vi } from 'vitest';
import '@xoong/controls';

const wait = () => new Promise((r) => setTimeout(r, 0));
const mount = async (html) => { document.body.innerHTML = html; await wait(); return document.body.firstElementChild; };
const press = (el, k, init = {}) => { const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }); el.dispatchEvent(e); return e; };
const COMPOSING = [['isComposing', { isComposing: true }], ['keyCode 229 (Safari)', { keyCode: 229 }]];
const type = (input, value) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe.each(COMPOSING)('IME composition (%s)', (_name, composing) => {
  it('<xo-tags>: Enter and a comma do not create a chip while composing, and still do afterwards', async () => {
    const el = await mount('<xo-tags name="t"></xo-tags>');
    const input = el.querySelector('input');
    type(input, 'nguye');
    const enter = press(input, 'Enter', composing);
    press(input, ',', composing);
    expect(el.value).toEqual([]);
    expect(enter.defaultPrevented).toBe(false); // the IME keeps the key
    expect(el.querySelectorAll('.xo-chip')).toHaveLength(0);
    press(input, 'Enter');
    expect(el.value).toEqual(['nguye']);
    type(input, 'ban');
    press(input, ',');
    expect(el.value).toEqual(['nguye', 'ban']);
  });

  it('<xo-combobox>: Enter does not pick the highlighted option, the arrows and Escape do nothing while composing', async () => {
    const el = await mount('<xo-combobox name="p"><option value="1">Nguyễn Văn A</option><option value="2">Trần Thị B</option></xo-combobox>');
    const input = el.querySelector('input');
    type(input, 'ngu');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    const active = input.getAttribute('aria-activedescendant');
    press(input, 'ArrowDown', composing);
    expect(input.getAttribute('aria-activedescendant')).toBe(active);
    press(input, 'Enter', composing);
    expect(el.value).toBe('');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    const esc = press(input, 'Escape', composing);
    expect(esc.defaultPrevented).toBe(false);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    press(input, 'Enter');
    expect(el.value).toBe('1');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('<xo-combobox creatable>: Enter does not add the typed text while composing', async () => {
    const el = await mount('<xo-combobox name="p" creatable><option value="1">Ada</option></xo-combobox>');
    const input = el.querySelector('input');
    type(input, 'Nguye');
    press(input, 'Enter', composing);
    expect(el.value).toBe('');
    press(input, 'Enter');
    expect(el.value).toBe('Nguye');
  });

  it('<xo-command>: Enter does not run the highlighted command and the arrows do not move it while composing', async () => {
    HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };
    const el = await mount('<xo-command><button data-value="a">Mở tệp</button><button data-value="b">Mở thư mục</button></xo-command>');
    const ran = [];
    el.addEventListener('xo-command-run', (e) => ran.push(e.detail.value));
    el.open();
    const dialog = el.querySelector('dialog');
    const input = dialog.querySelector('input');
    const active = input.getAttribute('aria-activedescendant');
    press(input, 'ArrowDown', composing);
    expect(input.getAttribute('aria-activedescendant')).toBe(active);
    press(input, 'Enter', composing);
    expect(ran).toEqual([]);
    expect(dialog.hasAttribute('open')).toBe(true);
    press(input, 'ArrowDown');
    press(input, 'Enter');
    expect(ran).toEqual(['b']);
  });

  it('<xo-inline-edit>: Enter does not save and Escape does not cancel while composing', async () => {
    const el = await mount('<form><xo-inline-edit name="title" value="Tên cũ"></xo-inline-edit></form>');
    el.querySelector('xo-inline-edit').edit();
    const edit = el.querySelector('xo-inline-edit');
    const input = edit.querySelector('input');
    input.value = 'Tên mới';
    const enter = press(input, 'Enter', composing);
    const esc = press(input, 'Escape', composing);
    expect(edit.editing).toBe(true);
    expect(edit.value).toBe('Tên cũ');
    expect(enter.defaultPrevented || esc.defaultPrevented).toBe(false);
    press(input, 'Enter');
    expect(edit.editing).toBe(false);
    expect(edit.value).toBe('Tên mới');
  });

  it('<xo-date>: Enter does not commit the typed text, ArrowDown does not open the calendar while composing', async () => {
    const el = await mount('<xo-date name="d" value="2026-11-12"></xo-date>');
    const input = el.querySelector('input');
    input.value = '2026-12-01';
    press(input, 'Enter', composing);
    expect(el.value).toBe('2026-11-12');
    press(input, 'ArrowDown', composing);
    expect(el.querySelector('.xo-date-open').getAttribute('aria-expanded')).toBe('false');
    press(input, 'Enter');
    expect(el.value).toBe('2026-12-01');
    press(input, 'ArrowDown');
    expect(el.querySelector('.xo-date-open').getAttribute('aria-expanded')).toBe('true');
  });

  it('<xo-stepper>: Enter does not commit the typed text and the arrows do not step while composing', async () => {
    const el = await mount('<xo-stepper min="1" max="30" value="5"></xo-stepper>');
    const input = el.querySelector('input');
    input.value = '12';
    press(input, 'Enter', composing);
    expect(el.value).toBe(5);
    press(input, 'ArrowUp', composing);
    expect(el.value).toBe(5);
    press(input, 'Enter');
    expect(el.value).toBe(12);
    press(input, 'ArrowUp');
    expect(el.value).toBe(13);
  });

  it('<xo-popover>: Escape in a field inside it cancels the composition, it does not close the popover', async () => {
    await mount('<div><button id="t">Filter</button><xo-popover label="Filter"><input id="q"></xo-popover></div>');
    const pop = document.querySelector('xo-popover');
    document.querySelector('#t').click();
    expect(pop.open).toBe(true);
    press(document.querySelector('#q'), 'Escape', composing);
    expect(pop.open).toBe(true);
    press(document.querySelector('#q'), 'Escape');
    expect(pop.open).toBe(false);
  });
});
