// Theme builder: pick a preset, change colours, shape, shadow and type, watch a live preview, download theme.css.
// No dependencies, no inline styles: the preview is themed by setting custom properties on one element (CSSOM, allowed by a strict CSP).
(() => {
  'use strict';
  /* ---------- colour maths (sRGB, the same as CSS color-mix(in srgb)) ---------- */
  const hex2rgb = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const rgb2hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, p) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v * p + B[i] * (1 - p))); };
  const lum = (h) => { const c = hex2rgb(h).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const onColor = (bg) => (ratio('#ffffff', bg) >= ratio('#111111', bg) ? '#ffffff' : '#111111');
  const isHex = (v) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
  const norm = (v) => { v = v.trim(); if (!v.startsWith('#')) v = '#' + v; if (v.length === 4) v = '#' + [...v.slice(1)].map((c) => c + c).join(''); return v.toLowerCase(); };

  /* ---------- fonts: system stacks only (no font files, strict CSP); name an installed or self-hosted font to use it ---------- */
  const FONTS = {
    avenir: ['Avenir Next (Calm)', '"Avenir Next", "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif'],
    system: ['System UI', 'system-ui, -apple-system, "Segoe UI", sans-serif'],
    roboto: ['Roboto', 'Roboto, system-ui, "Segoe UI", sans-serif'],
    segoe: ['Segoe UI', '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif'],
    plex: ['IBM Plex Sans', '"IBM Plex Sans", system-ui, "Segoe UI", sans-serif'],
    humanist: ['Humanist', 'Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", sans-serif'],
    geometric: ['Geometric', 'Montserrat, Avenir, "Century Gothic", system-ui, sans-serif'],
    serif: ['Serif', '"Iowan Old Style", "Palatino Linotype", Georgia, serif'],
    mono: ['Monospace', 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'],
  };
  const MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';

  /* ---------- presets: design languages, each a full set of inputs ---------- */
  const P = (name, note, light, dark, shape) => ({ name, note, light, dark, ...shape });
  const PRESETS = {
    mist: P('Mist', 'The Rainlet design system: soft grey, white cards, one blue. The xoong default.',
      { bg: '#f5f7f8', surface: '#ffffff', text: '#1f2a33', accent: '#0b63ce', success: '#1d7648', warning: '#8a5a00', danger: '#b3322b' },
      { bg: '#121b22', surface: '#1b2933', text: '#e8eef2', accent: '#6aa8f0', success: '#5fc88f', warning: '#e0b04a', danger: '#f08a82' },
      { radius: 8, height: 40, border: 1, focus: 2, shadow: 'soft', strength: 60, font: 'system', size: 16, schemes: 'both' }),
    calm: P('Calm', 'Clay and sage on warm paper. The xoong default.',
      { bg: '#f7f4ec', surface: '#fffdf8', text: '#2b2623', accent: '#9a4d33', success: '#2f7a4d', warning: '#b7791f', danger: '#b42318' },
      { bg: '#171513', surface: '#201d1a', text: '#eee8dc', accent: '#eeaa90', success: '#8cc3a0', warning: '#e9cf8e', danger: '#ff9d94' },
      { radius: 10, height: 40, border: 1, focus: 3, shadow: 'soft', strength: 100, font: 'avenir', size: 16, schemes: 'both' }),
    ember: P('Ember', 'The loud sibling: warm cream, vivid orange.',
      { bg: '#fff8ee', surface: '#ffffff', text: '#1c1512', accent: '#b93a0a', success: '#2f8f57', warning: '#a86a00', danger: '#b42318' },
      { bg: '#15110f', surface: '#1f1916', text: '#f6ebdd', accent: '#ff9068', success: '#6fcf8e', warning: '#f5c04a', danger: '#ff9d94' },
      { radius: 10, height: 40, border: 1, focus: 3, shadow: 'soft', strength: 100, font: 'avenir', size: 16, schemes: 'both' }),
    tonal: P('Tonal', 'Rounded, tonal surfaces, generous touch targets (Material-like).',
      { bg: '#fef7ff', surface: '#ffffff', text: '#1d1b20', accent: '#6750a4', success: '#1b6b3a', warning: '#8a5a00', danger: '#b3261e' },
      { bg: '#141218', surface: '#1d1b20', text: '#e6e0e9', accent: '#d0bcff', success: '#7bdc9a', warning: '#f5c26b', danger: '#f2b8b5' },
      { radius: 18, height: 44, border: 1, focus: 3, shadow: 'soft', strength: 70, font: 'roboto', size: 16, schemes: 'both' }),
    enterprise: P('Enterprise', 'Compact, quiet, blue; for dense business apps (Fluent-like).',
      { bg: '#f5f5f5', surface: '#ffffff', text: '#242424', accent: '#0f6cbd', success: '#107c10', warning: '#9d5d00', danger: '#b10e1c' },
      { bg: '#1f1f1f', surface: '#292929', text: '#ffffff', accent: '#479ef5', success: '#6ccb5f', warning: '#f7b955', danger: '#f1707b' },
      { radius: 4, height: 32, border: 1, focus: 2, shadow: 'crisp', strength: 100, font: 'segoe', size: 14, schemes: 'both' }),
    industrial: P('Industrial', 'Flat, square, high contrast, no shadows (Carbon-like).',
      { bg: '#f4f4f4', surface: '#ffffff', text: '#161616', accent: '#0f62fe', success: '#198038', warning: '#8e6a00', danger: '#da1e28' },
      { bg: '#161616', surface: '#262626', text: '#f4f4f4', accent: '#78a9ff', success: '#42be65', warning: '#f1c21b', danger: '#ff8389' },
      { radius: 0, height: 40, border: 1, focus: 2, shadow: 'none', strength: 100, font: 'plex', size: 14, schemes: 'both' }),
    brutalist: P('Brutalist', 'Thick black borders, hard offset shadows, loud colour.',
      { bg: '#fff4cf', surface: '#ffffff', text: '#000000', accent: '#c4001d', success: '#006b2b', warning: '#8a5a00', danger: '#c4001d' },
      { bg: '#0b0b0b', surface: '#161616', text: '#ffffff', accent: '#ffe14d', success: '#5ee38b', warning: '#ffd166', danger: '#ff6b6b' },
      { radius: 0, height: 42, border: 2, focus: 4, shadow: 'hard', strength: 100, font: 'mono', size: 15, schemes: 'both' }),
  };
  const SWATCH_KEYS = ['bg', 'surface', 'text', 'accent'];

  /* ---------- state ---------- */
  const COLORS = [['bg', 'Background'], ['surface', 'Surface'], ['text', 'Text'], ['accent', 'Accent'], ['success', 'Success'], ['warning', 'Warning'], ['danger', 'Danger']];
  const clone = (o) => JSON.parse(JSON.stringify(o));
  let state = { preset: 'mist', ...clone(PRESETS.mist) }; let mode = 'light'; // mode = which colour set the colour inputs show
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- tokens ---------- */
  const mixp = (a, pa, b) => `color-mix(in srgb, ${a} ${pa}%, ${b})`;
  const shadows = (style, k) => {
    const t = (p) => mixp('var(--xo-color-text)', Math.round(p * k), 'transparent');
    if (style === 'none') return { pop: '0 0 0 1px var(--xo-color-border)', raised: 'none' };
    if (style === 'crisp') return { pop: `0 4px 12px ${t(22)}, 0 1px 2px ${t(30)}`, raised: `0 1px 3px ${t(22)}` };
    if (style === 'hard') return { pop: '6px 6px 0 var(--xo-color-text)', raised: '4px 4px 0 var(--xo-color-text)' };
    return { pop: `0 14px 34px -14px ${t(55)}, 0 2px 6px ${t(10)}`, raised: `0 1px 2px ${t(8)}, 0 8px 24px -14px ${t(30)}` };
  };
  const rem = (px) => `${+(px / 16).toFixed(3)}rem`;
  function resolve(scheme) { // the inputs plus the derived colours, as hex, for the contrast table
    const c = state[scheme]; const bg = c.bg, surface = c.surface, text = c.text, accent = c.accent;
    return { ...c, subtle: mix(text, bg, 0.06), muted: mix(text, bg, 0.7), border: mix(text, bg, 0.14), controlBorder: mix(text, bg, 0.55), accentSoft: mix(accent, surface, 0.14), accentText: onColor(accent) };
  }
  function tokens() {
    const both = state.schemes === 'both'; const ld = (a, b) => (both ? `light-dark(${a}, ${b})` : state.schemes === 'light' ? a : b);
    const L = state.light, D = state.dark; const sh = shadows(state.shadow, state.strength / 100);
    const accentText = ld(onColor(L.accent), onColor(D.accent));
    const h = state.height;
    return [
      ['--xo-color-bg', ld(L.bg, D.bg)], ['--xo-color-surface', ld(L.surface, D.surface)], ['--xo-color-text', ld(L.text, D.text)],
      ['--xo-color-subtle', mixp('var(--xo-color-text)', 6, 'var(--xo-color-bg)')], ['--xo-color-muted', mixp('var(--xo-color-text)', 70, 'var(--xo-color-bg)')],
      ['--xo-color-border', mixp('var(--xo-color-text)', 14, 'var(--xo-color-bg)')], ['--xo-color-control-border', mixp('var(--xo-color-text)', 55, 'var(--xo-color-bg)')],
      ['--xo-color-accent', ld(L.accent, D.accent)], ['--xo-color-accent-text', accentText], ['--xo-color-accent-soft', mixp('var(--xo-color-accent)', 14, 'var(--xo-color-surface)')],
      ['--xo-color-accent-strong', mixp('var(--xo-color-accent)', 78, 'var(--xo-color-text)')], ['--xo-color-text-2', mixp('var(--xo-color-text)', 82, 'var(--xo-color-bg)')],
      ['--xo-color-primary', 'var(--xo-color-accent)'], ['--xo-color-primary-text', 'var(--xo-color-accent-text)'],
      ['--xo-color-success', ld(L.success, D.success)], ['--xo-color-warning', ld(L.warning, D.warning)], ['--xo-color-danger', ld(L.danger, D.danger)],
      ['--xo-color-inverse', both ? 'light-dark(var(--xo-color-text), color-mix(in srgb, var(--xo-color-text) 18%, var(--xo-color-bg)))' : state.schemes === 'light' ? 'var(--xo-color-text)' : 'color-mix(in srgb, var(--xo-color-text) 18%, var(--xo-color-bg))'],
      ['--xo-color-inverse-text', both ? 'light-dark(var(--xo-color-bg), var(--xo-color-text))' : state.schemes === 'light' ? 'var(--xo-color-bg)' : 'var(--xo-color-text)'],
      ['--xo-font', FONTS[state.font][1]], ['--xo-font-mono', MONO], ['--xo-text', rem(state.size)],
      ['--xo-radius', `${state.radius}px`], ['--xo-border-width', `${state.border}px`],
      ['--xo-control-height', rem(h)], ['--xo-control-height-sm', rem(Math.round(h * 0.8))], ['--xo-control-height-lg', rem(Math.round(h * 1.2))], ['--xo-control-padding', rem(Math.round(h * 0.36 * 10) / 10 * 1)],
      ['--xo-focus', `${state.focus}px solid var(--xo-color-accent)`], ['--xo-focus-thin', '2px solid var(--xo-color-accent)'], ['--xo-focus-inverse', `${state.focus}px solid var(--xo-color-inverse-text)`],
      ['--xo-shadow-pop', sh.pop], ['--xo-shadow-raised', sh.raised],
    ];
  }
  const GROUPS = [['colour', ['--xo-color-']], ['type', ['--xo-font', '--xo-text']], ['shape and size', ['--xo-radius', '--xo-border-width', '--xo-control-', '--xo-focus']], ['shadow', ['--xo-shadow']]];
  function css() {
    const t = tokens(); const used = new Set(); let body = '';
    for (const [name, prefixes] of GROUPS) {
      const rows = t.filter(([k]) => !used.has(k) && prefixes.some((p) => k.startsWith(p)));
      if (!rows.length) continue; body += `\n  /* ${name} */\n` + rows.map(([k, v]) => { used.add(k); return `  ${k}: ${v};`; }).join('\n') + '\n';
    }
    const cs = state.schemes === 'both' ? 'light dark' : state.schemes;
    const name = PRESETS[state.preset] ? PRESETS[state.preset].name + (isCustom() ? ' (customised)' : '') : 'Custom';
    const root = `:root {\n  color-scheme: ${cs};\n${body}}`;
    const note = state.layer ? 'It sits in its own layer, declared after the xoong layers, so it beats them and your unlayered CSS beats it.' : 'It is unlayered, so it beats every xoong layer. Load it after xoong.css and controls.css.';
    const head = `/* xoong theme: ${name}\n * Made with the xoong theme builder. Everything here is a custom property: override any of them in your own CSS, on :root or on one element.\n * ${note} */\n`;
    if (!state.layer) return `${head}${root}\n`;
    return `${head}@layer xoong, xoong-controls, xoong-richtext, xoong-standard, xoong-theme;\n@layer xoong-theme {\n${root.replace(/^/gm, '  ')}\n}\n`;
  }
  const isCustom = () => { const p = PRESETS[state.preset]; if (!p) return true; const keys = ['light', 'dark', 'radius', 'height', 'border', 'focus', 'shadow', 'strength', 'font', 'size', 'schemes']; return keys.some((k) => JSON.stringify(state[k]) !== JSON.stringify(p[k])); };

  /* ---------- preview ---------- */
  const preview = $('#theme-preview'); let previewScheme = 'light';
  // site rules may read the palette variables (--text, --muted, --danger ...) instead of the --xo-* tokens: inside the preview they all point at the previewed theme
  const ALIASES = [['--text', '--xo-color-text'], ['--text-2', '--xo-color-text-2'], ['--text-3', '--xo-color-muted'], ['--muted', '--xo-color-muted'], ['--bg', '--xo-color-bg'], ['--surface', '--xo-color-surface'], ['--card', '--xo-color-surface'], ['--broth', '--xo-color-subtle'], ['--sunken', '--xo-color-subtle'], ['--line', '--xo-color-border'], ['--line-strong', '--xo-color-control-border'], ['--accent', '--xo-color-accent'], ['--ember', '--xo-color-accent'], ['--ember-deep', '--xo-color-accent'], ['--accent-strong', '--xo-color-accent-strong'], ['--ember-soft', '--xo-color-accent-soft'], ['--accent-tint', '--xo-color-accent-soft'], ['--danger', '--xo-color-danger'], ['--herb', '--xo-color-success'], ['--ok', '--xo-color-success'], ['--sesame', '--xo-color-warning'], ['--warn', '--xo-color-warning'], ['--primary', '--xo-color-primary'], ['--primary-text', '--xo-color-primary-text'], ['--shadow-float', '--xo-shadow-pop']];
  function applyPreview() {
    for (const [k, v] of tokens()) preview.style.setProperty(k, v);
    for (const [k, v] of ALIASES) preview.style.setProperty(k, `var(${v})`);
    preview.style.colorScheme = state.schemes === 'both' ? previewScheme : state.schemes;
    preview.style.background = 'var(--xo-color-bg)'; preview.style.color = 'var(--xo-color-text)'; preview.style.fontFamily = 'var(--xo-font)'; preview.style.fontSize = 'var(--xo-text)';
  }

  /* ---------- contrast table ---------- */
  const CHECKS = [
    ['Text on background', 'text', 'bg', 4.5], ['Text on surface', 'text', 'surface', 4.5], ['Muted text on surface', 'muted', 'surface', 4.5],
    ['Accent text/links on background', 'accent', 'bg', 4.5], ['Button label on accent', 'accentText', 'accent', 4.5], ['Accent on tinted chip', 'accent', 'accentSoft', 4.5],
    ['Control border on surface', 'controlBorder', 'surface', 3], ['Focus ring on background', 'accent', 'bg', 3], ['Danger text on surface', 'danger', 'surface', 4.5],
  ];
  function renderContrast() {
    const rows = []; let fails = 0;
    for (const scheme of state.schemes === 'both' ? ['light', 'dark'] : [state.schemes]) {
      const r = resolve(scheme);
      for (const [label, a, b, need] of CHECKS) { const v = ratio(r[a], r[b]); const ok = v >= need; if (!ok) fails++; rows.push({ scheme, label, v, need, ok, a, b }); }
    }
    const body = $('#contrast-body'); body.textContent = '';
    for (const row of rows) {
      const tr = document.createElement('tr');
      const cells = [row.scheme, row.label, row.v.toFixed(2) + ' : 1', row.need + ' : 1'];
      cells.forEach((t, i) => { const td = document.createElement('td'); td.textContent = t; if (i === 1) td.className = 'primary-cell'; tr.append(td); });
      const td = document.createElement('td'); const badge = document.createElement('span'); badge.className = 'badge ' + (row.ok ? 'ok' : 'danger'); badge.textContent = row.ok ? 'pass' : 'fail'; td.append(badge);
      if (!row.ok && (row.a === 'accent' || row.a === 'danger')) { const fix = document.createElement('button'); fix.type = 'button'; fix.className = 'sm'; fix.textContent = 'Fix'; fix.addEventListener('click', () => fixColor(row)); td.append(' ', fix); }
      tr.append(td); body.append(tr);
    }
    const s = $('#contrast-summary'); s.className = 'notice ' + (fails ? 'warn' : 'ok'); s.querySelector('p').textContent = fails ? `${fails} pair${fails > 1 ? 's' : ''} below the WCAG minimum. Use Fix to nudge the colour, or change it yourself.` : 'Every checked pair meets WCAG AA (4.5:1 text, 3:1 controls and focus).';
  }
  function fixColor(row) { // nudge the colour toward the text colour until every pair it takes part in passes
    const key = row.a === 'danger' ? 'danger' : 'accent'; const c = state[row.scheme]; let v = c[key]; let guard = 0;
    const ok = (col) => { const r = { ...resolve(row.scheme), [key]: col }; if (key === 'accent') { r.accentSoft = mix(col, r.surface, 0.14); return ratio(col, r.bg) >= 4.5 && ratio(col, r.accentSoft) >= 4.5 && ratio(col, r.surface) >= 4.5; } return ratio(col, r.surface) >= 4.5; };
    while (guard++ < 60 && !ok(v)) v = mix(v, c.text, 0.93);
    c[key] = v; sync();
  }

  /* ---------- UI wiring ---------- */
  function renderPresets() {
    const grid = $('#presets'); grid.textContent = '';
    for (const [id, p] of Object.entries(PRESETS)) {
      const label = document.createElement('label'); label.className = 'preset';
      const input = document.createElement('input'); input.type = 'radio'; input.name = 'preset'; input.value = id; input.checked = state.preset === id;
      const dots = document.createElement('span'); dots.className = 'preset-dots'; dots.setAttribute('aria-hidden', 'true');
      for (const k of SWATCH_KEYS) { const d = document.createElement('i'); d.style.setProperty('background', p.light[k]); dots.append(d); }
      const b = document.createElement('b'); b.textContent = p.name; const sm = document.createElement('small'); sm.textContent = p.note;
      label.append(input, dots, b, sm); grid.append(label);
      input.addEventListener('change', () => { state = { preset: id, ...clone(PRESETS[id]) }; sync(true); });
    }
  }
  function renderColors() {
    const box = $('#colors'); box.textContent = '';
    for (const [k, label] of COLORS) {
      const row = document.createElement('div'); row.className = 'color-row';
      const l = document.createElement('label'); l.textContent = label; l.htmlFor = 'c-' + k;
      const pick = document.createElement('input'); pick.type = 'color'; pick.id = 'c-' + k; pick.value = state[mode][k]; pick.setAttribute('aria-label', `${label} colour (${mode})`);
      const hx = document.createElement('input'); hx.type = 'text'; hx.className = 'hex'; hx.value = state[mode][k]; hx.setAttribute('aria-label', `${label} hex (${mode})`); hx.maxLength = 7; hx.spellcheck = false;
      pick.addEventListener('input', () => { state[mode][k] = pick.value; hx.value = pick.value; hx.removeAttribute('aria-invalid'); sync(); });
      hx.addEventListener('input', () => { const v = norm(hx.value); if (isHex(v)) { state[mode][k] = v; pick.value = v; hx.removeAttribute('aria-invalid'); sync(); } else hx.setAttribute('aria-invalid', 'true'); });
      row.append(l, pick, hx); box.append(row);
    }
  }
  function bindRange(id, key, fmt) { const el = $(id); const out = $(id + '-out'); el.addEventListener('input', () => { state[key] = +el.value; out.textContent = fmt(+el.value); sync(); }); }
  function setControls() {
    const set = (id, v, fmt) => { const el = $(id); el.value = v; const o = $(id + '-out'); if (o) o.textContent = fmt(v); };
    set('#t-radius', state.radius, (v) => v + 'px'); set('#t-height', state.height, (v) => v + 'px'); set('#t-border', state.border, (v) => v + 'px'); set('#t-focus', state.focus, (v) => v + 'px'); set('#t-strength', state.strength, (v) => v + '%'); set('#t-size', state.size, (v) => v + 'px');
    $('#t-shadow').value = state.shadow; $('#t-font').value = state.font; $('#t-schemes').value = state.schemes; $('#t-layer').checked = !!state.layer;
    $('#preview-scheme-tabs').hidden = state.schemes !== 'both'; $('#mode-tabs').hidden = state.schemes !== 'both';
    if (state.schemes !== 'both') mode = state.schemes;
    $$('[data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
    $$('[data-pscheme]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.pscheme === previewScheme)));
  }
  let timer = 0;
  function sync(full) {
    if (full) { renderPresets(); } else { $$('#presets input').forEach((i) => { i.checked = i.value === state.preset && !isCustom(); }); }
    renderColors(); setControls(); applyPreview(); renderContrast();
    const out = $('#theme-css'); out.textContent = css(); $('#theme-name').textContent = (PRESETS[state.preset] ? PRESETS[state.preset].name : 'Custom') + (isCustom() ? ' · customised' : '');
    clearTimeout(timer); timer = setTimeout(() => { try { history.replaceState(null, '', '#t=' + btoa(encodeURIComponent(JSON.stringify(state)))); } catch (e) { /* ignore */ } }, 300);
  }
  function status(msg) { const s = $('#status'); s.textContent = msg; clearTimeout(status.t); status.t = setTimeout(() => { s.textContent = ''; }, 2400); }

  /* ---------- events ---------- */
  bindRange('#t-radius', 'radius', (v) => v + 'px'); bindRange('#t-height', 'height', (v) => v + 'px'); bindRange('#t-border', 'border', (v) => v + 'px');
  bindRange('#t-focus', 'focus', (v) => v + 'px'); bindRange('#t-strength', 'strength', (v) => v + '%'); bindRange('#t-size', 'size', (v) => v + 'px');
  $('#t-shadow').addEventListener('change', (e) => { state.shadow = e.target.value; sync(); });
  $('#t-font').addEventListener('change', (e) => { state.font = e.target.value; sync(); });
  $('#t-layer').addEventListener('change', (e) => { state.layer = e.target.checked; sync(); });
  $('#t-schemes').addEventListener('change', (e) => { state.schemes = e.target.value; sync(); });
  $$('[data-mode]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; sync(); }));
  $$('[data-pscheme]').forEach((b) => b.addEventListener('click', () => { previewScheme = b.dataset.pscheme; sync(); }));
  $('#tb-reset').addEventListener('click', () => { const id = PRESETS[state.preset] ? state.preset : 'mist'; state = { preset: id, ...clone(PRESETS[id]) }; sync(true); status('Reset to ' + PRESETS[id].name); });
  $('#tb-download').addEventListener('click', () => { const blob = new Blob([css()], { type: 'text/css' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'theme.css'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); status('theme.css downloaded'); });
  $('#tb-copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(css()); status('CSS copied'); } catch (e) { const r = document.createRange(); r.selectNodeContents($('#theme-css')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); status('Press Ctrl+C to copy'); } });
  $('#tb-share').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); status('Link copied'); } catch (e) { status('Copy the address bar to share'); } });

  /* ---------- start (a link carries a theme in the hash) ---------- */
  try { const m = location.hash.match(/^#t=(.+)$/); if (m) { const s = JSON.parse(decodeURIComponent(atob(m[1]))); if (s && s.light && s.dark && FONTS[s.font]) state = { ...clone(PRESETS.mist), ...s }; } } catch (e) { /* ignore a bad link */ }
  sync(true);
})();
