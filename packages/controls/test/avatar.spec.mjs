import { describe, it, expect, afterEach } from 'vitest';
import '@xoong/controls';
import '../src/avatar.js';
import { initialsOf } from '../src/avatar.js';

const mount = async (html) => { document.body.innerHTML = html; await new Promise((r) => setTimeout(r, 0)); return document.body.firstElementChild; };
afterEach(() => { document.body.innerHTML = ''; });

describe('initialsOf', () => {
  it('uses the first letter of the first and the last word', () => {
    expect(initialsOf('Nguyễn Văn An')).toBe('NA');
    expect(initialsOf('Đào Thị Linh')).toBe('ĐL');
    expect(initialsOf('Ada Lovelace')).toBe('AL');
    expect(initialsOf('ada')).toBe('AD');
    expect(initialsOf('  ')).toBe('');
    expect(initialsOf('"Zed" (admin)')).toBe('ZA');
  });
});

describe('<xo-avatar>', () => {
  it('is the badge: classes, initials, a full-name label and role img', async () => {
    const el = await mount('<xo-avatar name="An Dao" size="lg" status="ok"></xo-avatar>');
    expect(el.classList.contains('xo-avatar')).toBe(true);
    expect(el.classList.contains('xo-avatar--lg')).toBe(true);
    expect(el.classList.contains('xo-avatar--ok')).toBe(true);
    expect(el.textContent).toBe('AD');
    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('aria-label')).toBe('An Dao, online');
  });
  it('sm size, other statuses, a changing name and no name', async () => {
    const el = await mount('<xo-avatar name="Linh Tran" size="sm" status="warn"></xo-avatar>');
    expect(el.classList.contains('xo-avatar--sm')).toBe(true);
    expect(el.classList.contains('xo-avatar--warn')).toBe(true);
    el.setAttribute('status', 'muted'); el.setAttribute('size', '');
    expect(el.classList.contains('xo-avatar--warn')).toBe(false);
    expect(el.classList.contains('xo-avatar--muted')).toBe(true);
    expect(el.classList.contains('xo-avatar--sm')).toBe(false);
    el.setAttribute('name', 'Mai Pham');
    expect(el.textContent).toBe('MP');
    expect(el.getAttribute('aria-label')).toBe('Mai Pham, inactive');
    el.removeAttribute('name');
    expect(el.querySelector('.ic[data-ic=user]')).toBeTruthy();
    expect(el.getAttribute('aria-label')).toBe('Unknown user');
  });
  it('shows the image once it loads and the initials when it fails', async () => {
    const el = await mount('<xo-avatar name="An Dao" src="/an.jpg"></xo-avatar>');
    const img = el.querySelector('img');
    expect(img.getAttribute('src')).toBe('/an.jpg');
    expect(img.style.display).toBe('none');
    img.dispatchEvent(new Event('load'));
    expect(el.dataset.state).toBe('loaded');
    expect(img.style.display).toBe('block');
    expect(el.querySelector('span[aria-hidden]').hasAttribute('hidden')).toBe(true);
    el.setAttribute('src', '/gone.jpg');
    const next = el.querySelector('img');
    next.dispatchEvent(new Event('error'));
    expect(el.querySelector('img')).toBe(null);
    expect(el.dataset.state).toBe('error');
    expect(el.textContent).toBe('AD');
  });
});

describe('<xo-avatars>', () => {
  it('is a list; max shows that many and a +N badge for the rest', async () => {
    const el = await mount('<xo-avatars max="2"><xo-avatar name="An Dao"></xo-avatar><xo-avatar name="Linh Tran"></xo-avatar><xo-avatar name="Mai Pham"></xo-avatar><xo-avatar name="Bao Le"></xo-avatar></xo-avatars>');
    expect(el.classList.contains('xo-avatars')).toBe(true);
    expect(el.getAttribute('role')).toBe('list');
    const avatars = [...el.querySelectorAll('xo-avatar')];
    expect(avatars.every((a) => a.getAttribute('role') === 'listitem')).toBe(true);
    expect(avatars.map((a) => a.hidden)).toEqual([false, false, true, true]);
    const more = el.lastElementChild;
    expect(more.textContent).toBe('+2');
    expect(more.getAttribute('role')).toBe('listitem');
    expect(more.getAttribute('aria-label')).toBe('2 more');
    el.setAttribute('max', '3');
    expect(el.lastElementChild.textContent).toBe('+1');
    el.removeAttribute('max');
    await new Promise((r) => setTimeout(r, 0));
    expect(el.querySelectorAll('xo-avatar[hidden]').length).toBe(0);
    expect(el.lastElementChild.tagName).toBe('XO-AVATAR');
  });
  it('picks up avatars added later', async () => {
    const el = await mount('<xo-avatars max="1"><xo-avatar name="An Dao"></xo-avatar></xo-avatars>');
    expect(el.children.length).toBe(1);
    el.append(document.createElement('xo-avatar'));
    await new Promise((r) => setTimeout(r, 0));
    expect(el.lastElementChild.textContent).toBe('+1');
  });
});
