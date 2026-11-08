import { describe, it, expect, afterEach, vi } from 'vitest';
import '@xoong/controls';

const mountMenu = async (inner = '') => {
  document.body.innerHTML = `<xo-menu label="Row actions"><button xo-menu-trigger>Actions</button>
    <button id="edit">Edit</button><a id="open" href="#open">Open</a><button id="del">Delete</button>${inner}</xo-menu><p id="outside">x</p>`;
  await new Promise((r) => setTimeout(r, 0));
  return document.querySelector('xo-menu');
};
const trigger = () => document.querySelector('[xo-menu-trigger]');
const panel = () => document.querySelector('[role=menu]');
const items = () => [...document.querySelectorAll('[role=menuitem]')];
const key = (el, k, init = {}) => { const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }); el.dispatchEvent(e); return e; };

afterEach(() => { document.body.innerHTML = ''; });

describe('<xo-menu> inside a form', () => {
  it('the trigger is a plain button (type="button"), so opening the menu does not submit the form', async () => {
    document.body.innerHTML = '<form id="f"><xo-menu label="Block actions"><button xo-menu-trigger>Actions</button><button id="m">Move down</button></xo-menu></form>';
    await new Promise((r) => setTimeout(r, 0));
    let submits = 0;
    document.querySelector('#f').addEventListener('submit', (e) => { e.preventDefault(); submits++; });
    expect(trigger().getAttribute('type')).toBe('button');
    trigger().click();
    expect(submits).toBe(0);
    expect(panel().hidden).toBe(false);
  });
  it('an explicit type on the trigger is kept', async () => {
    document.body.innerHTML = '<form><xo-menu label="x"><button type="submit" xo-menu-trigger>Go</button><button>One</button></xo-menu></form>';
    await new Promise((r) => setTimeout(r, 0));
    expect(trigger().getAttribute('type')).toBe('submit');
  });
});

describe('<xo-menu>', () => {
  it('builds a menu button: the trigger is linked to a hidden role=menu list of menuitems', async () => {
    await mountMenu();
    expect(panel().getAttribute('aria-label')).toBe('Row actions');
    expect(panel().hidden).toBe(true);
    expect(items().map((i) => i.textContent)).toEqual(['Edit', 'Open', 'Delete']);
    expect(items().every((i) => i.tabIndex === -1)).toBe(true);
    expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().getAttribute('aria-controls')).toBe(panel().id);
  });

  it('a click opens and closes; opening does not move the focus, and fires xo-menu-open/close', async () => {
    const menu = await mountMenu();
    const seen = [];
    menu.addEventListener('xo-menu-open', () => seen.push('open'));
    menu.addEventListener('xo-menu-close', () => seen.push('close'));
    trigger().focus();
    trigger().click();
    expect(panel().hidden).toBe(false);
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(trigger());
    trigger().click();
    expect(panel().hidden).toBe(true);
    expect(seen).toEqual(['open', 'close']);
  });

  it('ArrowDown on the trigger opens on the first item, ArrowUp on the last; arrows wrap, Home and End jump', async () => {
    await mountMenu();
    key(trigger(), 'ArrowDown');
    expect(document.activeElement.id).toBe('edit');
    key(document.activeElement, 'ArrowDown');
    expect(document.activeElement.id).toBe('open');
    key(document.activeElement, 'End');
    expect(document.activeElement.id).toBe('del');
    key(document.activeElement, 'ArrowDown');
    expect(document.activeElement.id).toBe('edit'); // wrapped
    key(document.activeElement, 'ArrowUp');
    expect(document.activeElement.id).toBe('del');
    key(document.activeElement, 'Home');
    expect(document.activeElement.id).toBe('edit');
    key(document.activeElement, 'Escape');
    trigger().focus();
    key(trigger(), 'ArrowUp');
    expect(document.activeElement.id).toBe('del');
  });

  it('Escape pressed on the trigger (where a click leaves the focus) closes an open menu', async () => {
    await mountMenu();
    trigger().focus();
    trigger().click();
    key(trigger(), 'Escape');
    expect(panel().hidden).toBe(true);
    trigger().click();
    key(document.body, 'Escape'); // focus nowhere near the menu (Safari does not focus a clicked button)
    expect(panel().hidden).toBe(true);
  });

  it('typing a letter jumps to the next item that starts with it', async () => {
    await mountMenu();
    key(trigger(), 'ArrowDown');
    key(document.activeElement, 'd');
    expect(document.activeElement.id).toBe('del');
    key(document.activeElement, 'o');
    expect(document.activeElement.id).toBe('open');
    const ev = key(document.activeElement, 'x'); // no item starts with x: the focus stays
    expect(document.activeElement.id).toBe('open');
    expect(ev.defaultPrevented).toBe(false);
  });

  it('Escape closes and returns the focus to the trigger; Tab closes; an outside press closes', async () => {
    await mountMenu();
    key(trigger(), 'ArrowDown');
    key(document.activeElement, 'Escape');
    expect(panel().hidden).toBe(true);
    expect(document.activeElement).toBe(trigger());
    key(trigger(), 'ArrowDown');
    key(document.activeElement, 'Tab');
    expect(panel().hidden).toBe(true);
    trigger().click();
    document.querySelector('#outside').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(panel().hidden).toBe(true);
  });

  it('choosing an item runs it as usual and closes the menu with the focus back on the trigger; Space follows a link', async () => {
    await mountMenu();
    const clicked = vi.fn();
    document.querySelector('#edit').addEventListener('click', clicked);
    trigger().click();
    document.querySelector('#edit').click();
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(panel().hidden).toBe(true);
    expect(document.activeElement).toBe(trigger());
    const linkClick = vi.fn((e) => e.preventDefault());
    document.querySelector('#open').addEventListener('click', linkClick);
    trigger().click();
    key(document.querySelector('#open'), ' ');
    expect(linkClick).toHaveBeenCalledTimes(1);
  });

  it('without a marked trigger the first button is the trigger', async () => {
    document.body.innerHTML = '<xo-menu><button id="t">Go</button><button>One</button></xo-menu>';
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('#t').getAttribute('aria-haspopup')).toBe('menu');
    expect(document.querySelectorAll('[role=menuitem]').length).toBe(1);
  });

  it('a choice menu: items with a value are radio items, the menu value marks one, choosing sets it and fires xo-menu-select', async () => {
    document.body.innerHTML = `<xo-menu label="Palette" value="calm"><button xo-menu-trigger>Palette</button>
      <button value="calm">Calm</button><button value="ember">Ember</button></xo-menu>`;
    await new Promise((r) => setTimeout(r, 0));
    const radios = () => [...document.querySelectorAll('[role=menuitemradio]')];
    expect(radios().map((i) => i.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    const menu = document.querySelector('xo-menu');
    const seen = [];
    menu.addEventListener('xo-menu-select', (e) => seen.push(e.detail.value));
    trigger().click();
    radios()[1].click();
    expect(seen).toEqual(['ember']);
    expect(menu.getAttribute('value')).toBe('ember');
    expect(radios().map((i) => i.getAttribute('aria-checked'))).toEqual(['false', 'true']);
    expect(panel().hidden).toBe(true); // choosing closes the menu
    trigger().click();
    radios()[1].click(); // the same choice again: no event
    expect(seen).toEqual(['ember']);
    menu.setAttribute('value', 'calm'); // set from outside (a saved preference)
    expect(radios().map((i) => i.getAttribute('aria-checked'))).toEqual(['true', 'false']);
  });

  it('an hr is a divider: role=separator, not an item, and the arrow keys skip it', async () => {
    document.body.innerHTML = '<xo-menu label="Palette"><button xo-menu-trigger>Palette</button><button>Mist</button><hr><a href="#build">Build your own</a></xo-menu>';
    await new Promise((r) => setTimeout(r, 0));
    const kids = [...document.querySelectorAll('[role=menu] > *')];
    expect(kids.map((k) => k.getAttribute('role'))).toEqual(['menuitem', 'separator', 'menuitem']);
    trigger().click();
    key(trigger(), 'ArrowDown');
    expect(document.activeElement.textContent).toBe('Mist');
    key(document.activeElement, 'ArrowDown');
    expect(document.activeElement.textContent).toBe('Build your own'); // the divider was skipped
    key(document.activeElement, 'ArrowDown');
    expect(document.activeElement.textContent).toBe('Mist'); // wraps
  });
});
