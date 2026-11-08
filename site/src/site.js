// Every page: the controls (the code tabs and the palette menu are xoong elements) and a Copy button on each code block.
import '@xoong/controls';

// The palette menu: a choice menu (<xo-menu value>) sets <html data-palette>; palette.js applies the saved one before the first paint.
const palette = document.querySelector('xo-menu.palette');
if (palette) {
  palette.setAttribute('value', document.documentElement.dataset.palette || 'calm');
  palette.addEventListener('xo-menu-select', (e) => {
    document.documentElement.dataset.palette = e.detail.value;
    try { localStorage.setItem('xoong-palette', e.detail.value); } catch { /* not saved */ }
  });
}

for (const pre of document.querySelectorAll('pre[data-lang]')) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy';
  button.textContent = 'Copy';
  button.setAttribute('aria-label', 'Copy the code');
  button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(pre.querySelector('code').textContent); button.textContent = 'Copied'; } catch { button.textContent = 'Press Ctrl+C'; }
    setTimeout(() => { button.textContent = 'Copy'; }, 1600);
  });
  pre.append(button);
}
