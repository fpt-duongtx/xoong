// Demo behaviour only, so the static sheet feels alive. The real controls (keyboard, ARIA, form values) are the dev side's job.
(() => {
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const pct = (el) => { const min = +el.min || 0, max = +el.max || 100; return ((+el.value - min) / (max - min)) * 100; };
  for (const el of $$('input.xo-range')) {
    if (el.closest('.xo-range-dual')) continue;
    const set = () => el.style.setProperty('--p', pct(el) + '%');
    el.addEventListener('input', set); set();
  }
  for (const w of $$('.xo-range-dual')) {
    const [a, b] = $$('input', w); const fill = $$('.xo-range-dual__fill', w)[0];
    const set = () => { const lo = Math.min(pct(a), pct(b)), hi = Math.max(pct(a), pct(b)); fill.style.left = lo + '%'; fill.style.right = (100 - hi) + '%'; };
    a.addEventListener('input', set); b.addEventListener('input', set); set();
  }
  for (const el of $$('[data-w]')) el.style.width = el.dataset.w + '%';
  for (const el of $$('[data-size]')) { el.style.width = el.dataset.size + 'px'; el.style.height = el.dataset.size + 'px'; }
  for (const s of $$('button.xo-switch:not(:disabled)')) s.addEventListener('click', () => s.setAttribute('aria-checked', String(s.getAttribute('aria-checked') !== 'true')));
  for (const b of $$('button[aria-pressed]')) {
    if (b.closest('.xo-seg')) continue;
    b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')));
  }
  for (const g of $$('.xo-seg')) for (const b of $$('button', g)) b.addEventListener('click', () => { for (const x of $$('button', g)) x.setAttribute('aria-pressed', String(x === b)); });
  for (const st of $$('.xo-stepper')) {
    const [d, i] = $$('button', st); const input = $$('input', st)[0]; const lo = +st.dataset.min || 0;
    const upd = () => { d.disabled = +input.value <= lo; };
    d.addEventListener('click', () => { input.value = Math.max(lo, +input.value - 1); upd(); });
    i.addEventListener('click', () => { input.value = +input.value + 1; upd(); });
    upd();
  }
  for (const eye of $$('.xo-input-end')) eye.addEventListener('click', () => {
    const inp = eye.parentElement.querySelector('input'); const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password'; eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
  for (const o of $$('.xo-otp')) { const ins = $$('input', o); ins.forEach((inp, i) => inp.addEventListener('input', () => { if (inp.value && ins[i + 1]) ins[i + 1].focus(); })); }
  for (const c of $$('.xo-copyfield button')) c.addEventListener('click', () => { c.dataset.state = 'copied'; setTimeout(() => { c.removeAttribute('data-state'); }, 1600); });
  for (const m of $$('.xo-calendar')) m.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    for (const x of $$('button', m)) x.classList.remove('is-sel');
    b.classList.add('is-sel');
  });
  for (const o of $$('[data-open]')) o.addEventListener('click', () => document.querySelector(o.dataset.open).showModal());
  for (const c of $$('[data-close]')) c.addEventListener('click', () => c.closest('dialog').close());
  for (const d of $$('dialog.xo-drawer')) d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
})();
