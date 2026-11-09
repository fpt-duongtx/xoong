// Searching Vietnamese names: "nguyen" finds "Nguyễn", "dong" finds "Đồng", and the other way round, in the combobox and the command palette.
import { describe, it, expect, afterEach } from 'vitest';
import '@xoong/controls';
import { fold } from '../src/fold.js';

const wait = () => new Promise((r) => setTimeout(r, 0));
const mount = async (html) => { document.body.innerHTML = html; await wait(); return document.body.firstElementChild; };
const type = (input, value) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
const shown = (root) => [...root.querySelectorAll('[role=option]')].map((o) => o.textContent);

afterEach(() => { document.body.innerHTML = ''; });

describe('fold()', () => {
  it('drops accents and case, composed or decomposed, and maps đ/Đ to d (they do not decompose)', () => {
    expect(fold('Nguyễn Văn A')).toBe('nguyen van a');
    expect(fold('Nguyễn Văn A'.normalize('NFD'))).toBe('nguyen van a'); // typed on a Mac or pasted from a file name
    expect(fold('Đồng Đăng')).toBe('dong dang');
    expect(fold('ĐỒNG')).toBe('dong');
    expect(fold('Trần Thị Bích Ngọc Ươ')).toBe('tran thi bich ngoc uo');
    expect(fold('Crème Brûlée à la Zoë')).toBe('creme brulee a la zoe');
    expect(fold('')).toBe('');
    expect(fold(undefined)).toBe('');
  });

  it('keeps letters of other scripts apart (their marks are part of the letter)', () => {
    expect(fold('कि')).not.toBe(fold('क'));
    expect(fold('한국어')).toBe(fold('한국어'));
  });
});

const PEOPLE = '<option value="1">Nguyễn Văn A</option><option value="2">Trần Thị B</option><option value="3">Đồng Văn Nam</option><option value="4">Lê Hoàng Dũng</option><option value="5">Nguyen Smith</option>';

describe('<xo-combobox> search folds accents and case', () => {
  it('an unaccented query finds accented labels, including đ and Đ', async () => {
    const el = await mount(`<xo-combobox name="p">${PEOPLE}</xo-combobox>`);
    const input = el.querySelector('input');
    type(input, 'nguyen');
    expect(shown(el)).toEqual(['Nguyễn Văn A', 'Nguyen Smith']); // the order of the options is kept
    type(input, 'dong');
    expect(shown(el)).toEqual(['Đồng Văn Nam']);
    type(input, 'DUNG');
    expect(shown(el)).toEqual(['Lê Hoàng Dũng']);
    type(input, 'tran thi');
    expect(shown(el)).toEqual(['Trần Thị B']);
  });

  it('an accented query finds unaccented and differently accented labels (what a Telex user types while composing)', async () => {
    const el = await mount(`<xo-combobox name="p">${PEOPLE}</xo-combobox>`);
    const input = el.querySelector('input');
    type(input, 'Nguyễn');
    expect(shown(el)).toEqual(['Nguyễn Văn A', 'Nguyen Smith']);
    type(input, 'nguyê'); // a half-composed syllable
    expect(shown(el)).toEqual(['Nguyễn Văn A', 'Nguyen Smith']);
    type(input, 'đồng');
    expect(shown(el)).toEqual(['Đồng Văn Nam']);
    type(input, 'xyz');
    expect(shown(el)).toEqual([]);
    expect(el.querySelector('.xo-empty').textContent).toBe('No results');
  });

  it('picking a folded match sets the real option and its accented text', async () => {
    const el = await mount(`<xo-combobox name="p">${PEOPLE}</xo-combobox>`);
    const input = el.querySelector('input');
    type(input, 'dong');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(el.value).toBe('3');
    expect(input.value).toBe('Đồng Văn Nam');
  });

  it('<xo-tags> / creatable: a typed word that only differs by accents is still offered as a new value', async () => {
    const el = await mount('<xo-combobox name="p" creatable multiple><option value="Đồng">Đồng</option></xo-combobox>');
    const input = el.querySelector('input');
    type(input, 'dong');
    expect(shown(el)).toEqual(['Đồng', 'Add "dong"']); // found by folding, and creatable (it is a different word)
  });
});

describe('<xo-command> search folds accents and case', () => {
  it('"mo tep" finds "Mở tệp", "Dang xuat" finds "Đăng xuất"', async () => {
    HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };
    const el = await mount('<xo-command><button data-value="a">Mở tệp</button><button data-value="b">Đăng xuất</button><button data-value="c">Open file</button></xo-command>');
    el.open();
    const input = el.querySelector('dialog input');
    type(input, 'mo tep');
    expect(shown(el)).toEqual(['Mở tệp']);
    type(input, 'dang xuat');
    expect(shown(el)).toEqual(['Đăng xuất']);
    type(input, 'ĐĂNG');
    expect(shown(el)).toEqual(['Đăng xuất']);
    type(input, 'mở');
    expect(shown(el)).toEqual(['Mở tệp']);
    type(input, 'OPEN');
    expect(shown(el)).toEqual(['Open file']);
  });
});
