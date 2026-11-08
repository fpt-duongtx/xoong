// Every page: the controls (the code tabs and the palette menu are xoong elements) and a Copy button on each code block.
import '@xoong/controls';

// The palette menu: a choice menu (<xo-menu value>) sets <html data-palette>; palette.js applies the saved one before the first paint.
const palette = document.querySelector('xo-menu.palette');
if (palette) {
  palette.setAttribute('value', document.documentElement.dataset.palette || 'mist');
  palette.addEventListener('xo-menu-select', (e) => {
    if (e.detail.value === 'mist') delete document.documentElement.dataset.palette; else document.documentElement.dataset.palette = e.detail.value; // mist is the default: no attribute
    try { localStorage.setItem('xoong-palette', e.detail.value); } catch { /* not saved */ }
  });
}

// An example has one Copy button at the end of its tab bar: it copies the code of the tab that is open (the first code tab while the Preview shows).
for (const example of document.querySelectorAll('xo-tabs.example')) {
  const actions = document.createElement('div');
  actions.className = 'actions-end';
  const label = document.createElement('span'); // "Copied": announced politely, slides in (states.css)
  label.className = 'copy-label';
  label.setAttribute('role', 'status');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ghost icon-only sm';
  button.setAttribute('aria-label', 'Copy the code');
  button.title = 'Copy';
  const icon = document.createElement('span');
  icon.className = 'ic';
  icon.dataset.ic = 'copy';
  icon.setAttribute('aria-hidden', 'true');
  button.append(icon);
  button.addEventListener('click', async () => {
    const panels = [...example.querySelectorAll(':scope > [role="tabpanel"]')];
    const open = panels.find((p) => !p.hidden && p.querySelector('pre')) ?? panels.find((p) => p.querySelector('pre'));
    try { await navigator.clipboard.writeText(open?.querySelector('pre code')?.textContent ?? ''); icon.dataset.ic = 'check'; button.title = 'Copied'; button.dataset.state = 'copied'; label.textContent = 'Copied'; } catch { button.title = 'Press Ctrl+C'; }
    setTimeout(() => { icon.dataset.ic = 'copy'; button.title = 'Copy'; delete button.dataset.state; label.textContent = ''; }, 1600);
  });
  actions.append(label, button);
  example.append(actions);
}

// "On this page": the entry of the section being read is the current one.
const links = [...document.querySelectorAll('.rail ol a')];
if (links.length && typeof IntersectionObserver !== 'undefined') {
  const heads = links.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean);
  const mark = () => {
    const y = innerHeight * 0.3;
    const here = [...heads].reverse().find((h) => h.getBoundingClientRect().top <= y) ?? heads[0];
    for (const a of links) a.setAttribute('aria-current', String(a.hash === `#${here.id}`));
  };
  addEventListener('scroll', mark, { passive: true });
  mark();
}

// The theme toggle (<xo-theme-toggle>) sets <html data-theme>. The logo picture picks its dark file by the system setting, so it follows the choice here.
const logos = [...document.querySelectorAll('picture > source[media*="prefers-color-scheme: dark"]')];
const syncLogos = () => {
  const theme = document.documentElement.dataset.theme;
  for (const s of logos) { s.dataset.media ??= s.media; s.media = theme === 'dark' ? 'all' : theme === 'light' ? 'not all' : s.dataset.media; }
};
syncLogos();
document.addEventListener('xo-theme-change', syncLogos);
