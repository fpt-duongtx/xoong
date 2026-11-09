import { describe, it, expect, afterEach } from 'vitest';
import '@xoong/ui';
import { confirm, alert, prompt, ask } from '@xoong/ui';

const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const dialog = () => document.querySelector('dialog.xo-confirm');
const buttons = () => [...document.querySelectorAll('dialog.xo-confirm button')];
const click = (label) => buttons().find((b) => b.textContent === label).click();
afterEach(() => { document.body.innerHTML = ''; });

describe('confirm()', () => {
  it('asks with Cancel and Confirm; no kind keeps the plain look (no icon, no heading)', async () => {
    const answer = confirm('Delete it?');
    expect(buttons().map((b) => b.textContent)).toEqual(['Cancel', 'Confirm']);
    expect(dialog().querySelector('.xo-confirm-icon')).toBeNull();
    expect(dialog().querySelector('h2')).toBeNull();
    expect(dialog().dataset.kind).toBeUndefined();
    click('Confirm');
    expect(await answer).toBe(true);
    expect(dialog()).toBeNull();
  });
  it('a kind adds an icon and data-kind; a title is the dialog name and the message its description; ok and cancel are renamed', async () => {
    const answer = confirm('This cannot be undone.', { kind: 'warning', title: 'Delete project', ok: 'Delete', cancel: 'Keep' });
    expect(dialog().dataset.kind).toBe('warning');
    expect(dialog().querySelector('svg.xo-confirm-icon')?.getAttribute('aria-hidden')).toBe('true');
    const h = dialog().querySelector('h2');
    expect(dialog().getAttribute('aria-labelledby')).toBe(h.id);
    expect(document.getElementById(dialog().getAttribute('aria-describedby')).textContent).toBe('This cannot be undone.');
    expect(buttons().map((b) => b.textContent)).toEqual(['Keep', 'Delete']);
    click('Keep');
    expect(await answer).toBe(false);
  });
  it('Escape answers no; a second dialog answers the first one no', async () => {
    const first = confirm('One?');
    dialog().dispatchEvent(new Event('cancel'));
    dialog().dispatchEvent(new Event('close'));
    expect(await first).toBe(false);
    const a = confirm('A?');
    const b = confirm('B?');
    expect(await a).toBe(false);
    expect(document.querySelectorAll('dialog.xo-confirm')).toHaveLength(1);
    click('Confirm');
    expect(await b).toBe(true);
  });
  it('error is an alias of danger', async () => {
    const answer = confirm('x', { kind: 'error' });
    expect(dialog().dataset.kind).toBe('danger');
    click('Cancel');
    await answer;
  });
});

describe('alert()', () => {
  it('shows one OK button with an icon (info by default) and resolves when it is pressed', async () => {
    let done = false;
    const closed = alert('Saved', { kind: 'success' }).then(() => { done = true; });
    expect(dialog().dataset.kind).toBe('success');
    expect(buttons().map((b) => b.textContent)).toEqual(['OK']);
    await wait();
    expect(done).toBe(false);
    click('OK');
    await closed;
    expect(done).toBe(true);
    const plain = alert('Heads up');
    expect(dialog().dataset.kind).toBe('info');
    click('OK');
    await plain;
  });
});

describe('prompt()', () => {
  it('resolves with the text; Cancel resolves null; the start value is selected', async () => {
    const answer = prompt('Name this view', { value: 'My view', label: 'Name' });
    const input = dialog().querySelector('input');
    expect(input.value).toBe('My view');
    expect(dialog().querySelector('label').textContent).toContain('Name');
    input.value = 'Mine';
    dialog().querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(await answer).toBe('Mine');
    const cancelled = prompt('Again?');
    click('Cancel');
    expect(await cancelled).toBeNull();
  });
  it('a required field that is empty does not close the dialog and is marked invalid', async () => {
    const answer = prompt('Name', { required: true });
    const input = dialog().querySelector('input');
    dialog().querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(dialog()).not.toBeNull();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    input.value = 'x';
    input.dispatchEvent(new Event('input'));
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    dialog().querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(await answer).toBe('x');
  });
});

describe('ask()', () => {
  it('resolves with the value of the button pressed; Escape gives the value of the cancel button', async () => {
    const choices = [{ label: "Don't save", value: 'discard', danger: true }, { label: 'Cancel', value: 'stay', cancel: true }, { label: 'Save', value: 'save', primary: true }];
    const answer = ask('Save changes?', { kind: 'warning', buttons: choices });
    expect(buttons().map((b) => b.textContent)).toEqual(["Don't save", 'Cancel', 'Save']);
    expect(buttons()[0].classList.contains('xo-confirm-danger')).toBe(true);
    expect(buttons()[2].classList.contains('xo-confirm-ok')).toBe(true);
    expect(dialog().dataset.buttons).toBe('choices');
    click('Save');
    expect(await answer).toBe('save');
    const esc = ask('Again?', { buttons: choices });
    dialog().dispatchEvent(new Event('cancel'));
    dialog().dispatchEvent(new Event('close'));
    expect(await esc).toBe('stay');
    const none = ask('No cancel button', { buttons: [{ label: 'A', value: 1 }, { label: 'B', value: 2 }] });
    dialog().dispatchEvent(new Event('cancel'));
    dialog().dispatchEvent(new Event('close'));
    expect(await none).toBeNull();
  });
});

describe('xo-confirm attributes tune the question', () => {
  it('xo-confirm-title, -ok, -cancel and -kind reach the dialog', async () => {
    const { ask: askFromView } = await import('@xoong/data/view');
    const button = document.createElement('button');
    for (const [k, v] of Object.entries({ 'xo-confirm-title': 'Remove', 'xo-confirm-ok': 'Remove it', 'xo-confirm-cancel': 'Keep it', 'xo-confirm-kind': 'info' })) button.setAttribute(k, v);
    const answer = askFromView('Sure?', { kind: 'action', element: button });
    expect(dialog().querySelector('h2').textContent).toBe('Remove');
    expect(dialog().dataset.kind).toBe('info');
    expect(buttons().map((b) => b.textContent)).toEqual(['Keep it', 'Remove it']);
    click('Remove it');
    expect(await answer).toBe(true);
  });
});

describe('<xo-dialog heading>', () => {
  const mount = async (attrs = '', inner = '<p id="p">Hello</p><button slot="footer" type="button" xo-close>Cancel</button><button slot="footer" id="save" type="button">Save</button>') => {
    document.body.innerHTML = `<xo-dialog id="d" ${attrs}>${inner}</xo-dialog><button id="o" xo-open="#d">Open</button>`;
    await wait();
    return document.querySelector('xo-dialog');
  };
  it('builds header, body and footer and names the dialog by its heading', async () => {
    const el = await mount('heading="Edit person" size="wide"');
    const d = el.dialog;
    expect(d.className).toBe('xo-modal xo-modal--wide');
    expect(d.querySelector('.xo-modal__head h2').textContent).toBe('Edit person');
    expect(d.getAttribute('aria-labelledby')).toBe(d.querySelector('h2').id);
    expect(d.querySelector('.xo-modal__head button[xo-close]').getAttribute('aria-label')).toBe('Close');
    expect(d.querySelector('.xo-modal__body #p')).not.toBeNull();
    expect([...d.querySelectorAll('.xo-modal__foot button')].map((b) => b.textContent)).toEqual(['Cancel', 'Save']);
  });
  it('without a footer there is no footer; the close button closes it', async () => {
    const el = await mount('heading="Info"', '<p>x</p>');
    expect(el.dialog.querySelector('.xo-modal__foot')).toBeNull();
    el.show();
    expect(el.dialog.hasAttribute('open')).toBe(true);
    el.dialog.querySelector('.xo-modal__head button').click();
    expect(el.dialog.hasAttribute('open')).toBe(false);
  });
  it('without a heading it stays the plain wrapper it was', async () => {
    const el = await mount('', '<h2>Add</h2><p>x</p>');
    expect(el.dialog.className).toBe('');
    expect(el.dialog.querySelector('.xo-modal__head')).toBeNull();
    expect(el.dialog.querySelector('h2').textContent).toBe('Add');
  });
  it('dismiss closes on a click outside the box, not inside it', async () => {
    const el = await mount('heading="D" dismiss');
    const d = el.dialog;
    d.getBoundingClientRect = () => ({ left: 100, right: 300, top: 100, bottom: 300, width: 200, height: 200 });
    el.show();
    d.dispatchEvent(new MouseEvent('click', { clientX: 150, clientY: 150, bubbles: true }));
    expect(d.hasAttribute('open')).toBe(true);
    d.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10, bubbles: true }));
    expect(d.hasAttribute('open')).toBe(false);
  });
});
