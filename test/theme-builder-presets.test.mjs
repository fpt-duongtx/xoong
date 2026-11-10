// The five named presets in site/src/theme-builder.js. Contrast maths is the builder's own
// (sRGB mix, WCAG relative luminance): text 4.5:1, control border and focus 3:1.
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const src = readFileSync(new URL('../site/src/theme-builder.js', import.meta.url), 'utf8');
const start = src.indexOf('const P =');
const end = src.indexOf('const SWATCH_KEYS');
const PRESETS = new Function(`${src.slice(start, end)}; return PRESETS;`)();

const hex2rgb = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const rgb2hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, p) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v * p + B[i] * (1 - p))); };
const lum = (h) => { const c = hex2rgb(h).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const onColor = (bg) => (ratio('#ffffff', bg) >= ratio('#111111', bg) ? '#ffffff' : '#111111');
const resolve = (c) => ({ ...c, muted: mix(c.text, c.bg, 0.7), controlBorder: mix(c.text, c.bg, 0.55), accentSoft: mix(c.accent, c.surface, 0.14), accentText: onColor(c.accent) });
const CHECKS = [
  ['Text on background', 'text', 'bg', 4.5], ['Text on surface', 'text', 'surface', 4.5], ['Muted text on surface', 'muted', 'surface', 4.5],
  ['Accent text/links on background', 'accent', 'bg', 4.5], ['Button label on accent', 'accentText', 'accent', 4.5], ['Accent on tinted chip', 'accent', 'accentSoft', 4.5],
  ['Control border on surface', 'controlBorder', 'surface', 3], ['Focus ring on background', 'accent', 'bg', 3], ['Danger text on surface', 'danger', 'surface', 4.5],
];

const NAMED = {
  apple: {
    name: 'Apple Modern',
    light: { bg: '#f5f5f7', surface: '#ffffff', text: '#1d1d1f', accent: '#0063ce', success: '#1d7648', warning: '#c25000', danger: '#d70015' },
    dark: { bg: '#1c1c1e', surface: '#2c2c2e', text: '#f5f5f7', accent: '#5cadff', success: '#30d158', warning: '#ffd60a', danger: '#ff6b62' },
  },
  sunset: {
    name: 'Vibrant Sunset',
    light: { bg: '#eadada', surface: '#fff8f8', text: '#4d3a4d', accent: '#993d86', success: '#2f6b45', warning: '#8a5a00', danger: '#9c2f3a' },
    dark: { bg: '#241820', surface: '#322430', text: '#f6ecec', accent: '#d28fc4', success: '#7dcea0', warning: '#e9cf8e', danger: '#ff9aa8' },
  },
  ocean: {
    name: 'Ocean Breeze',
    light: { bg: '#e8f6ff', surface: '#ffffff', text: '#0b3d91', accent: '#0b6bad', success: '#0e7460', warning: '#8a5a00', danger: '#b42318' },
    dark: { bg: '#071833', surface: '#0e2a52', text: '#e8f6ff', accent: '#4aaef3', success: '#7fe7d6', warning: '#f5c26b', danger: '#ff9d94' },
  },
  earthy: {
    name: 'Earthy Minimal',
    light: { bg: '#f8f6ee', surface: '#fffdf8', text: '#2e3a2f', accent: '#a14f31', success: '#4e6846', warning: '#8a5a00', danger: '#9c3418' },
    dark: { bg: '#1c241e', surface: '#2a332b', text: '#f8f6ee', accent: '#dca18c', success: '#9aaf8c', warning: '#e9cf8e', danger: '#e8a090' },
  },
  midnight: {
    name: 'Midnight Neon',
    light: { bg: '#ede9fe', surface: '#fbfaff', text: '#0f172a', accent: '#0a6e7e', success: '#067a52', warning: '#8a5a00', danger: '#b42318' },
    dark: { bg: '#0f172a', surface: '#1c1b41', text: '#ede9fe', accent: '#22d3ee', success: '#34d399', warning: '#f5c26b', danger: '#fb7185' },
  },
};

describe('theme builder named presets', () => {
  it('offers Apple Modern, Vibrant Sunset, Ocean Breeze, Earthy Minimal and Midnight Neon in both schemes', () => {
    for (const [id, want] of Object.entries(NAMED)) {
      expect(PRESETS[id], id).toBeTruthy();
      expect(PRESETS[id].name).toBe(want.name);
      expect(PRESETS[id].light).toEqual(want.light);
      expect(PRESETS[id].dark).toEqual(want.dark);
      expect(PRESETS[id].schemes).toBe('both');
    }
  });

  it('meets the builder contrast table in light and dark (4.5:1 text, 3:1 controls and focus)', () => {
    const fails = [];
    for (const id of Object.keys(NAMED)) {
      for (const scheme of ['light', 'dark']) {
        const r = resolve(PRESETS[id][scheme]);
        for (const [label, a, b, need] of CHECKS) {
          const v = ratio(r[a], r[b]);
          if (v < need) fails.push(`${id} ${scheme}: ${label} ${v.toFixed(2)}:1 (needs ${need}:1)`);
        }
      }
    }
    expect(fails).toEqual([]);
  });
});
