import { describe, it, expect, afterEach } from 'vitest';
import '@xoong/controls';

const wait = (ms = 10) => new Promise((r) => setTimeout(r, ms));
const mount = async (html) => { document.body.innerHTML = html; await wait(); return document.body.firstElementChild; };
const key = (el, k, init = {}) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
afterEach(() => { document.body.innerHTML = ''; });

describe('<xo-drawer>', () => {
  const html = '<button xo-open="#d">Open</button><xo-drawer id="d" heading="Filters" side="start" size="lg" dismiss><p>Body</p><button slot="footer" xo-close value="ok">OK</button></xo-drawer>';
  it('draws head, body and footer on a dialog with side and size classes, and xo-open / xo-close work', async () => {
    await mount(html);
    const d = document.querySelector('xo-drawer');
    const dlg = d.querySelector('dialog.xo-drawer');
    expect(dlg.classList.contains('xo-drawer--start') && dlg.classList.contains('xo-drawer--lg')).toBe(true);
    expect(dlg.querySelector('.xo-drawer__title').textContent).toBe('Filters');
    expect(dlg.getAttribute('aria-labelledby')).toBe(dlg.querySelector('h2').id);
    expect(dlg.querySelector('.xo-drawer__body').textContent).toBe('Body');
    expect(dlg.querySelector('.xo-drawer__foot button').textContent).toBe('OK');
    document.querySelector('button').click();
    expect(dlg.open).toBe(true);
    dlg.querySelector('.xo-drawer__foot button').click();
    expect(dlg.open).toBe(false);
    expect(dlg.returnValue).toBe('ok');
  });
  it('open() resolves with the return value; the default is end and md', async () => {
    await mount('<xo-drawer heading="x"><p>a</p></xo-drawer>');
    const d = document.querySelector('xo-drawer');
    const p = d.open();
    d.close('done');
    expect(await p).toBe('done');
    expect(d.dialog.classList.contains('xo-drawer--end') && d.dialog.classList.contains('xo-drawer--md')).toBe(true);
  });
  it('a copy keeps one dialog', async () => {
    await mount(html);
    const copy = document.querySelector('xo-drawer').cloneNode(true);
    document.body.append(copy);
    await wait();
    expect(copy.querySelectorAll('dialog').length).toBe(1);
  });
});

describe('<xo-breadcrumb>', () => {
  it('draws nav > ol with the last item as the current page', async () => {
    const el = await mount('<xo-breadcrumb label="Here"><a href="/">Home</a><a href="/p">Products</a><span>Shoes</span></xo-breadcrumb>');
    expect(el.querySelector('nav').getAttribute('aria-label')).toBe('Here');
    const lis = el.querySelectorAll('ol > li');
    expect(lis.length).toBe(3);
    expect(lis[2].firstElementChild.getAttribute('aria-current')).toBe('page');
    expect(lis[0].firstElementChild.getAttribute('href')).toBe('/');
  });
  it('reads JSON items; max hides the middle behind an "…" button whose menu lists them', async () => {
    const el = await mount(`<xo-breadcrumb max="3" items='[{"label":"A","href":"/a"},{"label":"B","href":"/b"},{"label":"C","href":"/c"},{"label":"D","href":"/d"},{"label":"E"}]'></xo-breadcrumb>`);
    const hidden = [...el.querySelectorAll('ol > li[hidden]')].map((l) => l.textContent);
    expect(hidden).toEqual(['B', 'C']);
    const more = el.querySelector('.xo-breadcrumb__more button');
    expect(more.getAttribute('aria-label')).toBe('Show hidden pages');
    more.click();
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect([...el.querySelectorAll('.xo-breadcrumb__menu a')].map((a) => a.textContent)).toEqual(['B', 'C']);
    key(el, 'Escape');
    expect(more.getAttribute('aria-expanded')).toBe('false');
  });
  it('a copy of a collapsed trail has the same items', async () => {
    const el = await mount(`<xo-breadcrumb max="3" items='[{"label":"A","href":"/a"},{"label":"B","href":"/b"},{"label":"C","href":"/c"},{"label":"D"}]'></xo-breadcrumb>`);
    const copy = el.cloneNode(true);
    document.body.append(copy);
    await wait();
    expect(copy.querySelectorAll('ol > li:not(.xo-breadcrumb__more)').length).toBe(4);
    expect(copy.querySelectorAll('.xo-breadcrumb__more').length).toBe(1);
  });
});

describe('<xo-alert>', () => {
  it('status for info, alert for danger, live overrides, icon is hidden from AT', async () => {
    const info = await mount('<xo-alert heading="Hi">Text</xo-alert>');
    const box = info.querySelector('.notice');
    expect(box.getAttribute('role')).toBe('status');
    expect(box.classList.contains('info')).toBe(true);
    expect(box.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
    expect(box.querySelector('.xo-alert__heading').textContent).toBe('Hi');
    const danger = await mount('<xo-alert kind="danger">Bad</xo-alert>');
    expect(danger.querySelector('.notice').getAttribute('role')).toBe('alert');
    expect(danger.querySelector('.notice').classList.contains('error')).toBe(true);
    const polite = await mount('<xo-alert kind="danger" live="polite">Bad</xo-alert>');
    expect(polite.querySelector('.notice').getAttribute('role')).toBe('status');
    const off = await mount('<xo-alert live="off">x</xo-alert>');
    expect(off.querySelector('.notice').hasAttribute('role')).toBe(false);
  });
  it('the action slot moves to .xo-alert__action; dismissible hides it and fires xo-dismiss (cancelable)', async () => {
    const el = await mount('<xo-alert kind="success" dismissible>Saved <a slot="action" href="#">Undo</a></xo-alert>');
    expect(el.querySelector('.xo-alert__action a').textContent).toBe('Undo');
    expect(el.querySelector('.xo-alert__body').textContent.trim()).toBe('Saved');
    let n = 0, stop = true;
    el.addEventListener('xo-dismiss', (e) => { n++; if (stop) e.preventDefault(); });
    el.querySelector('.xo-alert__close').click();
    expect(el.hidden).toBe(false);
    stop = false;
    el.querySelector('.xo-alert__close').click();
    expect(el.hidden).toBe(true);
    expect(n).toBe(2);
  });
  it('changing the kind redraws without losing the text', async () => {
    const el = await mount('<xo-alert>Keep me</xo-alert>');
    el.setAttribute('kind', 'warning');
    expect(el.querySelectorAll('.notice').length).toBe(1);
    expect(el.querySelector('.notice').classList.contains('warn')).toBe(true);
    expect(el.textContent).toContain('Keep me');
  });
});

describe('<xo-skeleton>', () => {
  it('draws the lines hidden from AT and one Loading status', async () => {
    const el = await mount('<xo-skeleton lines="3"></xo-skeleton>');
    expect(el.querySelectorAll('.xo-skeleton__shape').length).toBe(3);
    expect(el.querySelector('.xo-skeleton__shapes').getAttribute('aria-hidden')).toBe('true');
    const status = el.querySelectorAll('[role=status]');
    expect(status.length).toBe(1);
    expect(status[0].textContent).toBe('Loading');
  });
  it('circle and rect are one shape with width and height (a bare number is pixels); label="" drops the status', async () => {
    const el = await mount('<xo-skeleton shape="circle" width="48" label=""></xo-skeleton>');
    const s = el.querySelector('.xo-skeleton__shape--circle');
    expect([s.style.width, s.style.height]).toEqual(['48px', '48px']);
    expect(el.querySelector('[role=status]')).toBe(null);
    const r = await mount('<xo-skeleton shape="rect" width="100%" height="8rem" label="Loading chart"></xo-skeleton>');
    expect(r.querySelectorAll('.xo-skeleton__shape').length).toBe(1);
    expect(r.querySelector('[role=status]').textContent).toBe('Loading chart');
  });
  it('redrawing replaces, never doubles', async () => {
    const el = await mount('<xo-skeleton lines="2"></xo-skeleton>');
    el.setAttribute('lines', '4');
    expect(el.querySelectorAll('.xo-skeleton__shape').length).toBe(4);
    expect(el.querySelectorAll('[role=status]').length).toBe(1);
  });
});

describe('<xo-tree>', () => {
  const data = JSON.stringify([{ id: 'a', label: 'Alpha', children: [{ id: 'a1', label: 'Apple' }, { id: 'a2', label: 'Avocado' }] }, { id: 'b', label: 'Beta' }, { id: 'c', label: 'Čherry', children: [{ id: 'c1', label: 'Child' }] }]);
  const tree = (attrs = '') => mount(`<xo-tree label="T" ${attrs} data='${data}'></xo-tree>`);
  const item = (el, id) => el.querySelector(`[data-id=${id}]`);

  it('draws the ARIA tree: roles, a roving tabindex and collapsed groups', async () => {
    const el = await tree();
    const root = el.querySelector('ul[role=tree]');
    expect(root.getAttribute('aria-label')).toBe('T');
    expect(el.querySelectorAll('[role=treeitem]').length).toBe(6);
    expect(item(el, 'a').getAttribute('aria-expanded')).toBe('false');
    expect(item(el, 'a').querySelector('[role=group]').hidden).toBe(true);
    expect(item(el, 'b').hasAttribute('aria-expanded')).toBe(false);
    expect([...el.querySelectorAll('[role=treeitem]')].filter((li) => li.tabIndex === 0).map((li) => li.dataset.id)).toEqual(['a']);
  });
  it('reads nested <ul> markup', async () => {
    const el = await mount('<xo-tree selectable><ul><li data-id="x">Root<ul><li>Leaf one</li></ul></li><li open>Open<ul><li>In</li></ul></li></ul></xo-tree>');
    expect(item(el, 'x').getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('[data-id="Open"]').getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('[data-id="Leaf one"] .xo-tree__label').textContent).toBe('Leaf one');
  });
  it('arrows: Right opens then goes to the child, Left closes then goes to the parent, Home/End, * opens siblings; events fire', async () => {
    const el = await tree();
    const toggles = [];
    el.addEventListener('xo-tree-toggle', (e) => toggles.push([e.detail.id, e.detail.expanded]));
    const a = item(el, 'a');
    a.focus();
    key(a, 'ArrowRight');
    expect(a.getAttribute('aria-expanded')).toBe('true');
    key(a, 'ArrowRight');
    expect(document.activeElement).toBe(item(el, 'a1'));
    key(item(el, 'a1'), 'ArrowDown');
    key(item(el, 'a2'), 'ArrowLeft');
    expect(document.activeElement).toBe(a);
    key(a, 'ArrowLeft');
    expect(a.getAttribute('aria-expanded')).toBe('false');
    key(a, 'End');
    expect(document.activeElement).toBe(item(el, 'c'));
    key(item(el, 'c'), 'Home');
    expect(document.activeElement).toBe(a);
    key(a, '*');
    expect(item(el, 'c').getAttribute('aria-expanded')).toBe('true');
    expect(toggles[0]).toEqual(['a', true]);
    expect(el.querySelectorAll('[tabindex="0"]').length).toBe(1);
  });
  it('type-ahead ignores accents and wraps', async () => {
    const el = await tree();
    const a = item(el, 'a');
    a.focus();
    key(a, 'c');
    expect(document.activeElement).toBe(item(el, 'c'));
  });
  it('selectable: Enter and click choose one item (aria-selected) and fire xo-tree-select', async () => {
    const el = await tree('selectable');
    const seen = [];
    el.addEventListener('xo-tree-select', (e) => seen.push(e.detail));
    const b = item(el, 'b');
    b.focus();
    key(b, 'Enter');
    expect(b.getAttribute('aria-selected')).toBe('true');
    item(el, 'a').querySelector('.xo-tree__row').click();
    expect(b.getAttribute('aria-selected')).toBe('false');
    expect(el.selected).toEqual(['a']);
    expect(seen[0]).toEqual({ id: 'b', selected: ['b'] });
  });
  it('multiple: checkboxes, a parent is mixed from its children and checks all of them', async () => {
    const el = await tree('multiple expanded="a"');
    expect(el.querySelector('[role=tree]').getAttribute('aria-multiselectable')).toBe('true');
    expect(el.querySelectorAll('.xo-tree__check').length).toBe(6);
    item(el, 'a1').querySelector('.xo-tree__row').click();
    expect(item(el, 'a').getAttribute('aria-checked')).toBe('mixed');
    item(el, 'a2').querySelector('.xo-tree__row').click();
    expect(item(el, 'a').getAttribute('aria-checked')).toBe('true');
    expect(el.selected.sort()).toEqual(['a', 'a1', 'a2']);
    key(item(el, 'a'), ' ');
    expect(el.selected).toEqual([]);
    key(item(el, 'c'), ' ');
    expect(el.selected.sort()).toEqual(['c', 'c1']);
  });
  it('without selectable, Enter opens and closes; selected and expanded attributes set the start state', async () => {
    const el = await tree('selectable selected="b" expanded="c"');
    expect(item(el, 'b').getAttribute('aria-selected')).toBe('true');
    expect(item(el, 'c').getAttribute('aria-expanded')).toBe('true');
    const plain = await tree();
    key(item(plain, 'a'), 'Enter');
    expect(item(plain, 'a').getAttribute('aria-expanded')).toBe('true');
  });
  it('lazy: xo-tree-load fires once on the first open and setChildren fills the group', async () => {
    const el = await mount('<xo-tree label="L"></xo-tree>');
    el.data = [{ id: 'r', label: 'Remote', lazy: true }];
    const loads = [];
    el.addEventListener('xo-tree-load', (e) => loads.push(e.detail.id));
    const r = item(el, 'r');
    key(r, 'ArrowRight');
    key(r, 'ArrowRight');
    expect(loads).toEqual(['r']);
    expect(r.getAttribute('aria-busy')).toBe('true');
    el.setChildren('r', [{ id: 'r1', label: 'One' }]);
    expect(r.hasAttribute('aria-busy')).toBe(false);
    expect(r.getAttribute('aria-expanded')).toBe('true');
    expect(item(el, 'r1')).toBeTruthy();
    el.setChildren('r', []);
    expect(r.hasAttribute('aria-expanded')).toBe(false);
  });
  it('a copy of a drawn tree is not drawn twice and still works', async () => {
    const el = await tree('selectable');
    const copy = el.cloneNode(true);
    document.body.append(copy);
    await wait();
    expect(copy.querySelectorAll('[role=tree]').length).toBe(1);
    expect(copy.querySelectorAll('[role=treeitem]').length).toBe(6);
    const b = item(copy, 'b');
    key(b, 'Enter');
    expect(b.getAttribute('aria-selected')).toBe('true');
  });
});

describe('<xo-color>', () => {
  const mk = (attrs = '') => mount(`<form><xo-color name="c" label="Brand" ${attrs}></xo-color></form>`).then(() => document.querySelector('xo-color'));
  it('normalises the value (#rgb, upper case) and shows it in the swatch button name', async () => {
    const el = await mk('value="#ABC"');
    expect(el.value).toBe('#aabbcc');
    const b = el.querySelector('.xo-color__swatch');
    expect(b.getAttribute('aria-label')).toBe('Brand: #aabbcc');
    expect(el.querySelector('.xo-color__native').value).toBe('#aabbcc');
    expect(el.querySelector('.xo-color__chip').style.getPropertyValue('--xo-color-chip')).toBe('#aabbcc');
    expect(el.serialize(el.value)).toBe('#aabbcc');
  });
  it('empty is allowed; required makes it invalid; bad text is not a value', async () => {
    const el = await mk('required');
    expect(el.value).toBe('');
    expect(el.valid).toBe(false);
    el.setValue('red');
    expect(el.value).toBe('');
    el.setValue('#00ff00');
    expect(el.valid).toBe(true);
  });
  it('the hex field validates: invalid text sets aria-invalid and a message, a valid one sets the value and fires input', async () => {
    const el = await mk('value="#112233"');
    const hex = el.querySelector('.xo-color__hex');
    const seen = [];
    el.addEventListener('input', () => seen.push(el.value));
    hex.value = '#12';
    hex.dispatchEvent(new Event('input', { bubbles: true }));
    expect(hex.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('.xo-color__error').textContent).toContain('#1a2b3c');
    expect(el.value).toBe('#112233');
    hex.value = '#FF8800';
    hex.dispatchEvent(new Event('input', { bubbles: true }));
    expect(hex.getAttribute('aria-invalid')).toBe('false');
    expect(el.value).toBe('#ff8800');
    expect(seen).toEqual(['#ff8800']); // the inner events do not leak: one input from the control
    expect(hex.value).toBe('#FF8800'); // the text under the cursor is not rewritten
  });
  it('ignores the hex field while an IME composes', async () => {
    const el = await mk('value="#112233"');
    const hex = el.querySelector('.xo-color__hex');
    hex.value = '#ff0000';
    hex.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
    expect(el.value).toBe('#112233');
  });
  it('swatches are buttons named by their hex; a click sets the value, fires input and change and announces it', async () => {
    const el = await mk('swatches="#0B7285,#c92a2a"');
    const sw = el.querySelectorAll('.xo-color__sw');
    expect(sw[0].getAttribute('aria-label')).toBe('#0b7285');
    const seen = [];
    el.addEventListener('input', () => seen.push('input'));
    el.addEventListener('change', () => seen.push('change'));
    sw[1].click();
    expect(el.value).toBe('#c92a2a');
    expect(seen).toEqual(['input', 'change']);
    expect(sw[1].getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('.xo-color__live').textContent).toBe('Color #c92a2a');
  });
  it('alpha: the value has eight digits and an opacity slider', async () => {
    const el = await mk('alpha value="#000000"');
    expect(el.value).toBe('#000000ff');
    const range = el.querySelector('.xo-color__alpha');
    expect(range.getAttribute('aria-label')).toBe('Opacity');
    range.value = '128';
    range.dispatchEvent(new Event('input', { bubbles: true }));
    expect(el.value).toBe('#00000080');
  });
  it('disabled and readonly do not change; reset goes back; one panel after a move or a copy', async () => {
    const el = await mk('value="#112233" swatches="#ff0000"');
    el.setAttribute('readonly', '');
    el.querySelector('.xo-color__sw').click();
    expect(el.value).toBe('#112233');
    el.removeAttribute('readonly');
    el.querySelector('.xo-color__sw').click();
    expect(el.value).toBe('#ff0000');
    el.reset();
    expect(el.value).toBe('#112233');
    const p = el.parentNode;
    el.remove(); p.append(el);
    expect(el.querySelectorAll('xo-popover').length).toBe(1);
    const copy = el.cloneNode(true);
    p.append(copy);
    expect(copy.querySelectorAll('xo-popover').length).toBe(1);
    expect(copy.querySelectorAll('.xo-color__swatch').length).toBe(1);
  });
});

describe('<xo-rating>', () => {
  const mk = (attrs = '') => mount(`<form><xo-rating name="s" label="Score" ${attrs}></xo-rating></form>`).then(() => document.querySelector('xo-rating'));
  const radios = (el) => [...el.querySelectorAll('input[type=radio]')];
  const choose = (r) => { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); };
  it('a radiogroup with one named radio per star and the value checked', async () => {
    const el = await mk('value="4"');
    const g = el.querySelector('[role=radiogroup]');
    expect(g.getAttribute('aria-label')).toBe('Score');
    expect(radios(el).length).toBe(5);
    expect(radios(el)[0].getAttribute('aria-label')).toBe('1 of 5');
    expect(radios(el).findIndex((r) => r.checked)).toBe(3);
    expect(new Set(radios(el).map((r) => r.name)).size).toBe(1);
    expect([...g.children].map((s) => s.dataset.state)).toEqual(['full', 'full', 'full', 'full', 'empty']);
    expect(radios(el).every((r) => r.getAttribute('form') === '')).toBe(true); // not a field of the form on its own
  });
  it('choosing fires input and change once (the radios own events stay inside), dirty, and serializes as a number', async () => {
    const el = await mk();
    const seen = [];
    el.addEventListener('input', (e) => seen.push(['input', e.target === el]));
    el.addEventListener('change', (e) => seen.push(['change', e.target === el]));
    choose(radios(el)[2]);
    expect(el.value).toBe(3);
    expect(seen).toEqual([['input', true], ['change', true]]);
    expect(el.dirty).toBe(true);
    expect(el.serialize(el.value)).toBe('3');
    el.reset();
    expect(el.value).toBe(0);
    expect(el.serialize(el.value)).toBe(null);
  });
  it('half steps: two radios per star, half-filled state, rounded to 0.5', async () => {
    const el = await mk('half max="3"');
    expect(radios(el).map((r) => r.value)).toEqual(['0.5', '1', '1.5', '2', '2.5', '3']);
    choose(radios(el)[2]);
    expect(el.value).toBe(1.5);
    expect([...el.querySelector('.xo-rating').children].map((s) => s.dataset.state)).toEqual(['full', 'half', 'empty']);
    el.setValue(2.3);
    expect(el.value).toBe(2.5);
    el.setValue(9);
    expect(el.value).toBe(3);
  });
  it('required wants a star; clearable clears on Delete', async () => {
    const el = await mk('required clearable value="2"');
    expect(el.valid).toBe(true);
    key(radios(el)[1], 'Delete');
    expect(el.value).toBe(0);
    expect(el.valid).toBe(false);
    expect(radios(el).some((r) => r.checked)).toBe(false);
  });
  it('readonly and disabled keep the value; hover previews and restores', async () => {
    const el = await mk('readonly value="2"');
    const r = radios(el)[4];
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    r.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    choose(r);
    expect(el.value).toBe(2);
    expect(el.querySelector('[role=radiogroup]').getAttribute('aria-readonly')).toBe('true');
    const live = await mk('value="2"');
    const g = live.querySelector('.xo-rating');
    radios(live)[3].dispatchEvent(new Event('pointerover', { bubbles: true }));
    expect(g.children[3].dataset.state).toBe('full');
    expect(g.hasAttribute('data-preview')).toBe(true);
    g.dispatchEvent(new Event('pointerleave'));
    expect(g.children[3].dataset.state).toBe('empty');
    live.setAttribute('disabled', '');
    expect(radios(live).every((x) => x.disabled)).toBe(true);
  });
  it('a move keeps the stars; a copy has its own single group', async () => {
    const el = await mk('value="3"');
    const name = radios(el)[0].name;
    const p = el.parentNode;
    el.remove(); p.append(el);
    expect(radios(el)[0].name).toBe(name);
    const copy = el.cloneNode(true);
    p.append(copy);
    await wait();
    expect(copy.querySelectorAll('.xo-rating').length).toBe(1);
    expect(radios(copy).length).toBe(5);
  });
});
