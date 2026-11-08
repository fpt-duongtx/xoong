// Runs in the head, before the first paint: apply the palette the visitor chose last time (no flash of the other one).
try { const palette = localStorage.getItem('xoong-palette'); if (palette) document.documentElement.dataset.palette = palette; } catch { /* private mode: the default palette */ }
