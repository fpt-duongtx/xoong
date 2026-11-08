// Reference only. Calm is the default (brand.css). This toggles <html data-palette="ember">. The dev side replaces it with an xo-menu
// and the CSSOM; what matters here is that a palette is nothing but a set of custom-property values (see css/brand.css).
const KEY = 'xoong-palette';
const root = document.documentElement;
try { if (localStorage.getItem(KEY) === 'ember') root.dataset.palette = 'ember'; } catch { /* storage blocked */ }
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('.palette-toggle');
  if (!btn) return;
  const sync = () => { const ember = root.dataset.palette === 'ember'; btn.setAttribute('aria-pressed', String(ember)); btn.querySelector('span').textContent = ember ? 'Ember' : 'Calm'; };
  btn.addEventListener('click', () => {
    if (root.dataset.palette === 'ember') delete root.dataset.palette; else root.dataset.palette = 'ember';
    try { localStorage.setItem(KEY, root.dataset.palette || 'calm'); } catch { /* ignore */ }
    sync();
  });
  sync();
});
