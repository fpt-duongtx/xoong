// Runs in the head, before the first paint: apply the palette the visitor chose last time (no flash of the other one).
// mist is the default (no attribute needed); calm and ember are the other palettes; anything else stored is ignored.
try {
  const palette = localStorage.getItem('xoong-palette');
  if (palette === 'calm' || palette === 'ember') document.documentElement.dataset.palette = palette;
} catch { /* private mode: the default palette */ }
