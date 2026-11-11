import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import '@xoong/controls';

const mount = async (html) => { document.body.innerHTML = html; await new Promise((r) => setTimeout(r, 0)); return document.body.firstElementChild; };
const key = (el, k, init = {}) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
beforeEach(() => localStorage.clear());
afterEach(() => { document.body.innerHTML = ''; localStorage.clear(); });

describe('<xo-accordion>', () => {
  it('styles its details, `single` shares a name, arrows move between summaries, change fires', async () => {
    const el = await mount('<xo-accordion single><details><summary>One</summary>a</details><details><summary>Two</summary>b</details></xo-accordion>');
    const [a, b] = el.querySelectorAll('details');
    expect(a.classList.contains('xo-accordion')).toBe(true);
    expect(a.getAttribute('name')).toBeTruthy();
    expect(a.getAttribute('name')).toBe(b.getAttribute('name'));
    const sums = el.querySelectorAll('summary');
    sums[0].focus();
    key(sums[0], 'ArrowDown');
    expect(document.activeElement).toBe(sums[1]);
    key(sums[1], 'ArrowDown');
    expect(document.activeElement).toBe(sums[0]); // wraps
    key(sums[0], 'End');
    expect(document.activeElement).toBe(sums[1]);
  });
});

describe('<xo-popover>', () => {
  it('toggles from the previous button, sets aria, closes with Escape (focus back) and on an outside click', async () => {
    await mount('<div><button id="t">Open</button><xo-popover label="Notes"><button id="in">Mark read</button></xo-popover></div><p id="out">x</p>');
    const t = document.querySelector('#t'), pop = document.querySelector('xo-popover');
    expect(pop.hidden).toBe(true);
    expect(t.getAttribute('aria-expanded')).toBe('false');
    expect(pop.getAttribute('aria-label')).toBe('Notes');
    t.click();
    expect(pop.hidden).toBe(false);
    expect(t.getAttribute('aria-expanded')).toBe('true');
    expect(t.getAttribute('aria-controls')).toBe(pop.id);
    expect(document.activeElement.id).toBe('in');
    key(document.activeElement, 'Escape');
    expect(pop.hidden).toBe(true);
    expect(document.activeElement).toBe(t);
    t.click();
    document.querySelector('#out').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(pop.hidden).toBe(true);
    pop.removeAttribute('label');
    expect(pop.hasAttribute('aria-label')).toBe(false); // a label the popover computed goes away with the attribute
  });
  it('keeps an aria-label the author wrote when label is absent', async () => {
    await mount('<div><button>Open</button><xo-popover aria-label="Mine">Hi</xo-popover></div>');
    const pop = document.querySelector('xo-popover');
    expect(pop.getAttribute('aria-label')).toBe('Mine');
    pop.setAttribute('label', 'Notes');
    expect(pop.getAttribute('aria-label')).toBe('Mine');
  });
});

describe('<xo-consent>', () => {
  it('shows until chosen, saves the choice, fires xo-consent, and reopens from xo-consent-open', async () => {
    await mount('<xo-consent categories="analytics,marketing"><b>Cookies.</b> You choose.</xo-consent><button xo-consent-open>Settings</button>');
    const el = document.querySelector('xo-consent');
    const bar = el.querySelector('.xo-consent');
    expect(bar.hidden).toBe(false);
    expect(bar.getAttribute('role')).toBe('region');
    const seen = [];
    el.addEventListener('xo-consent', (e) => seen.push(e.detail));
    [...bar.querySelectorAll('button')].find((b) => b.textContent === 'Accept all').click();
    expect(bar.hidden).toBe(true);
    expect(el.choices).toEqual({ analytics: true, marketing: true });
    expect(seen).toEqual([{ analytics: true, marketing: true }]);
    document.querySelector('[xo-consent-open]').click();
    expect(bar.hidden).toBe(false);
    [...bar.querySelectorAll('button')].find((b) => b.textContent === 'Essential only').click();
    expect(el.choices).toEqual({ analytics: false, marketing: false });
  });
  it('stays hidden when a choice is saved', async () => {
    localStorage.setItem('xoong-consent', '{"analytics":true}');
    await mount('<xo-consent categories="analytics">Cookies</xo-consent>');
    expect(document.querySelector('.xo-consent').hidden).toBe(true);
  });
});

describe('<xo-file>', () => {
  const file = (name, type, size = 10) => new File([new Uint8Array(size)], name, { type });
  it('takes a file, shows it, removes it; refuses by type and size with a message and an event', async () => {
    const el = await mount('<form><xo-file name="logo" label="Logo" accept="image/*" max-size="1KB"></xo-file></form>').then((f) => f.querySelector('xo-file'));
    const input = el.querySelector('input[type=file]');
    const pick = (f) => { Object.defineProperty(input, 'files', { value: [f], configurable: true }); input.dispatchEvent(new Event('change')); };
    const rejects = [];
    el.addEventListener('xo-file-reject', (e) => rejects.push(e.detail.reason));
    pick(file('a.txt', 'text/plain'));
    expect(rejects).toEqual(['type']);
    expect(el.querySelector('.error').textContent).toContain('a.txt');
    pick(file('big.png', 'image/png', 5000));
    expect(rejects).toEqual(['type', 'size']);
    pick(file('ok.png', 'image/png', 100));
    expect(el.value.name).toBe('ok.png');
    expect(el.querySelector('.error').hidden).toBe(true);
    expect(el.querySelector('.xo-file-list li span').textContent).toBe('ok.png');
    el.querySelector('.xo-file-list button').click();
    expect(el.value).toBe('');
  });
  it('multiple keeps an array and serializes FormData; dragging marks the zone', async () => {
    const el = await mount('<xo-file name="docs" multiple></xo-file>');
    const zone = el.querySelector('.xo-dropzone');
    zone.dispatchEvent(new Event('dragover', { cancelable: true }));
    expect(zone.hasAttribute('data-over')).toBe(true);
    zone.dispatchEvent(new Event('dragleave'));
    expect(zone.hasAttribute('data-over')).toBe(false);
    el.setValue([file('a.pdf', 'application/pdf'), file('b.pdf', 'application/pdf')]);
    expect(el.serialize(el.value).getAll('docs')).toHaveLength(2);
    el.progress = 0.5;
    expect(el.querySelector('progress').value).toBe(0.5);
    el.progress = null;
    expect(el.querySelector('progress').hidden).toBe(true);
  });
});

describe('<xo-command>', () => {
  it('opens with Ctrl+K, filters, moves with arrows, Enter runs the original element and fires xo-command-run', async () => {
    HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };
    const el = await mount('<xo-command><button data-group="Actions" data-value="new">New article</button><button data-group="Actions" data-value="dark">Dark theme</button><a href="#go" data-group="Go to">Articles</a></xo-command>');
    const ran = [], clicks = [];
    el.addEventListener('xo-command-run', (e) => ran.push(e.detail.value));
    el.querySelector('button[data-value=dark]').addEventListener('click', () => clicks.push('dark'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true }));
    const dialog = el.querySelector('dialog');
    expect(dialog.hasAttribute('open')).toBe(true);
    const input = dialog.querySelector('input');
    expect(dialog.querySelectorAll('[role=option]')).toHaveLength(3);
    expect(dialog.querySelectorAll('.xo-option__group')).toHaveLength(2);
    input.value = 'th'; input.dispatchEvent(new Event('input'));
    expect(dialog.querySelectorAll('[role=option]')).toHaveLength(1);
    expect(input.getAttribute('aria-activedescendant')).toBe(dialog.querySelector('[role=option]').id);
    key(input, 'Enter');
    expect(ran).toEqual(['dark']);
    expect(clicks).toEqual(['dark']);
    expect(dialog.hasAttribute('open')).toBe(false);
    input.value = 'zzz'; input.dispatchEvent(new Event('input'));
    expect(dialog.textContent).toContain('No results');
  });
});

describe('<xo-chart>', () => {
  it('draws labelled bars from data with a table of the same numbers', async () => {
    const el = await mount('<xo-chart type="bar" label="Visits" unit="k" data=\'[{"label":"Mon","value":12},{"label":"Tue","value":18}]\'></xo-chart>');
    const svg = el.querySelector('svg');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Visits');
    const bars = el.querySelectorAll('rect.bar');
    expect(bars).toHaveLength(2);
    expect(bars[1].getAttribute('aria-label')).toBe('Tue: 18k');
    expect(bars[0].getAttribute('tabindex')).toBe('0');
    expect([...el.querySelectorAll('tbody tr')].map((r) => r.textContent)).toEqual(['Mon12k', 'Tue18k']);
    expect(el.querySelector('summary').textContent).toBe('View as table');
  });
  it('a line chart has the line, area and dots; setting rows redraws', async () => {
    const el = await mount('<xo-chart type="line" label="Trend"></xo-chart>');
    el.rows = [3, 5, 4];
    expect(el.querySelector('polyline.line')).toBeTruthy();
    expect(el.querySelectorAll('circle.dot')).toHaveLength(3);
    el.rows = [1];
    expect(el.querySelectorAll('circle.dot')).toHaveLength(1);
  });
});
