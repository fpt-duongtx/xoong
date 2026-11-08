// Reference only. Mist is the default (no attribute). Calm and Ember are selectable palettes: <html data-palette="calm|ember">.
// The dev side replaces this with an xo-menu and the CSSOM; a palette is only a set of custom-property values (css/brand.css).
const KEY = 'xoong-palette';
const ORDER = ['mist', 'calm', 'ember'];
const root = document.documentElement;
const get = () => { try { const v = localStorage.getItem(KEY); return ORDER.includes(v) ? v : 'mist'; } catch { return 'mist'; } };
const apply = (name) => { if (name === 'mist') delete root.dataset.palette; else root.dataset.palette = name; };
apply(get());
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('.palette-toggle');
  if (!btn) return;
  const sync = () => { const cur = root.dataset.palette || 'mist'; btn.querySelector('span').textContent = cur[0].toUpperCase() + cur.slice(1); };
  btn.addEventListener('click', () => {
    const next = ORDER[(ORDER.indexOf(root.dataset.palette || 'mist') + 1) % ORDER.length];
    apply(next); try { localStorage.setItem(KEY, next); } catch { /* storage blocked */ }
    sync();
  });
  sync();
});
