// Demo behaviour for live-admin.html and live-landing.html. The look is the kit; the logic here is a stand-in so the pages feel real.
// The real versions (data, sorting, toasts, validation, persistence) are the dev side's job, see LIVE-DEMOS.md.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ic = (n, c = 'icon') => `<svg class="${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

  // ---- theme toggle (data-theme on <html>) ----
  const root = document.documentElement;
  const saved = store.get('xoong-demo-theme');
  if (saved) root.dataset.theme = saved;
  for (const b of $$('[data-theme-toggle]')) {
    const sync = () => { const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; b.setAttribute('aria-pressed', String(dark)); b.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'); b.innerHTML = ic(dark ? 'sun' : 'moon'); };
    b.addEventListener('click', () => { const dark = b.getAttribute('aria-pressed') === 'true'; root.dataset.theme = dark ? 'light' : 'dark'; store.set('xoong-demo-theme', root.dataset.theme); $$('[data-theme-toggle]').forEach((x) => x.dispatchEvent(new Event('sync'))); });
    b.addEventListener('sync', sync); sync();
  }

  // ---- toasts ----
  const toasts = $('.xo-toasts');
  const toast = (msg, kind = 'status') => {
    if (!toasts) return;
    const t = document.createElement('div');
    t.className = 'xo-toast' + (kind === 'status' ? ' xo-toast-status' : '');
    t.setAttribute('role', kind === 'status' ? 'status' : 'alert');
    t.innerHTML = `${ic(kind === 'status' ? 'success' : 'error')}<span>${esc(msg)}</span><button class="xo-toast-action" type="button">Dismiss</button>`;
    t.querySelector('button').addEventListener('click', () => t.remove());
    toasts.append(t);
    setTimeout(() => t.remove(), 5000);
  };
  window.demoToast = toast;
  for (const b of $$('[data-toast]')) b.addEventListener('click', () => toast(b.dataset.toast));

  // ---- dialogs ----
  for (const o of $$('[data-open]')) o.addEventListener('click', () => $(o.dataset.open)?.showModal());
  for (const c of $$('[data-close]')) c.addEventListener('click', () => c.closest('dialog')?.close());
  for (const d of $$('dialog')) d.addEventListener('click', (e) => { if (e.target === d && d.classList.contains('xo-drawer')) d.close(); });

  // ---- generic popover (notifications, user menu) ----
  for (const b of $$('[data-popover]')) {
    const pop = $(b.dataset.popover);
    const close = () => { pop.hidden = true; b.setAttribute('aria-expanded', 'false'); };
    b.addEventListener('click', (e) => { e.stopPropagation(); const open = pop.hidden; $$('.xo-popover').forEach((p) => { p.hidden = true; }); pop.hidden = !open; b.setAttribute('aria-expanded', String(open)); });
    document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target)) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { close(); b.focus(); } });
  }
  $('[data-mark-read]')?.addEventListener('click', () => { $('.xo-notify__dot').hidden = true; $$('.xo-popover .xo-feed li').forEach((l) => { l.style.opacity = '.6'; }); toast('All notifications marked as read'); });

  // ---- command palette (⌘K / Ctrl+K) ----
  const cmd = $('#cmd');
  if (cmd) {
    const input = $('input', cmd); const opts = $$('.xo-option', cmd);
    const filter = () => { const q = input.value.trim().toLowerCase(); for (const o of opts) o.hidden = q && !o.textContent.toLowerCase().includes(q); };
    input.addEventListener('input', filter);
    document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); cmd.showModal(); input.focus(); } });
    for (const o of opts) o.addEventListener('click', () => { cmd.close(); const v = o.dataset.go; if (v) show(v); });
  }

  // ---- admin: views ----
  function show(name) {
    const views = $$('[data-view]'); if (!views.length) return;
    if (!views.some((v) => v.dataset.view === name)) name = 'dashboard';
    for (const v of views) v.hidden = v.dataset.view !== name;
    for (const a of $$('[data-go]')) if (a.classList.contains('xo-nav__link')) { if (a.dataset.go === name && a.getAttribute('href') === '#' + name && !a.hasAttribute('data-skip')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
    const crumb = $('[data-crumb]'); if (crumb) crumb.textContent = { dashboard: 'Dashboard', articles: 'Articles', settings: 'Settings' }[name];
    document.title = ({ dashboard: 'Dashboard', articles: 'Articles', settings: 'Settings' }[name]) + ' · Acme Studio admin · xoong demo';
    $('#drawer')?.close();
  }
  if ($('[data-view]')) {
    for (const a of $$('[data-go]:not(.xo-option)')) a.addEventListener('click', (e) => { e.preventDefault(); history.replaceState(null, '', '#' + a.dataset.go); show(a.dataset.go); });
    addEventListener('hashchange', () => show(location.hash.slice(1)));
    show(location.hash.slice(1));
  }

  // ---- admin: articles table (data -> filter -> sort -> page) ----
  const tbody = $('#rows');
  if (tbody) {
    const people = ['Mai Tran', 'Lucas Perez', 'Sofia Rossi', 'Daniel Kim', 'Amira Hassan'];
    const titles = ['Why Greece still appeals', 'Portugal Golden Visa: what changed', 'Five regions to know in Spain', 'Visa FAQ', 'Buying property as a non-resident', 'Tax residency in plain words', 'Lisbon or Porto?', 'Renovating a farmhouse', 'Winter in the Algarve', 'How long does a permit take?', 'Notaries explained', 'Mortgage rates this quarter', 'Moving with children', 'Schools abroad: a checklist', 'The cost of living, compared', 'A guide to Crete', 'Healthcare for newcomers', 'Remote work and residency', 'Closing costs, line by line', 'What to ask an agent'];
    const statuses = ['Published', 'Draft', 'Scheduled', 'Published', 'Published'];
    let rows = titles.map((t, i) => ({ id: i + 1, title: t, path: '/news/' + t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28), status: statuses[i % 5], author: people[i % 5], views: 3200 - i * 137 + (i % 3) * 211, age: i }));
    const state = { status: 'All', q: '', sort: 'age', dir: 1, page: 1, per: 6, sel: new Set() };
    const when = (a) => a === 0 ? '2 hours ago' : a === 1 ? 'Yesterday' : a < 7 ? a + ' days ago' : (Math.round(a / 7) === 1 ? '1 week' : Math.round(a / 7) + ' weeks') + ' ago';
    const badge = (s) => `<span class="badge ${s === 'Published' ? 'ok' : s === 'Draft' ? 'warn' : ''}">${s}</span>`;
    const visible = () => rows.filter((r) => (state.status === 'All' || r.status === state.status) && (!state.q || (r.title + r.path).toLowerCase().includes(state.q)))
      .sort((a, b) => (typeof a[state.sort] === 'number' ? a[state.sort] - b[state.sort] : String(a[state.sort]).localeCompare(String(b[state.sort]))) * state.dir);
    const draw = () => {
      const list = visible(); const pages = Math.max(1, Math.ceil(list.length / state.per)); state.page = Math.min(state.page, pages);
      const slice = list.slice((state.page - 1) * state.per, state.page * state.per);
      tbody.innerHTML = slice.length ? slice.map((r) => `<tr${state.sel.has(r.id) ? ' aria-selected="true"' : ''}><td class="select"><input type="checkbox" data-id="${r.id}" aria-label="Select ${esc(r.title)}"${state.sel.has(r.id) ? ' checked' : ''}></td><td data-title data-label="Title"><a href="#articles" class="primary-cell">${esc(r.title)}</a><br><span class="muted path">${esc(r.path)}</span></td><td data-status data-label="Status">${badge(r.status)}</td><td data-label="Author" class="muted">${r.author}</td><td data-label="Views" class="muted">${r.views.toLocaleString('en')}</td><td data-label="Updated" class="muted">${when(r.age)}</td><td class="cell-actions"><button class="ghost sm" type="button" data-edit="${r.id}">${ic('edit', 'icon sm')}Edit</button><button class="icon-only ghost sm" type="button" data-del="${r.id}" aria-label="Delete ${esc(r.title)}">${ic('trash')}</button></td></tr>`).join('')
        : `<tr><td colspan="7"><div class="state" role="status"><h3>No articles match</h3><p>Try another status or clear the search.</p></div></td></tr>`;
      $('#foot-count').textContent = list.length ? `Showing ${(state.page - 1) * state.per + 1}–${(state.page - 1) * state.per + slice.length} of ${list.length}` : 'Showing 0 of 0';
      $('#prev').disabled = state.page <= 1; $('#next').disabled = state.page >= pages; $('#pageno').textContent = state.page + ' / ' + pages;
      const n = state.sel.size; $('#bulk').hidden = !n; $('#bulk-n').textContent = n + ' selected';
      const all = $('#all'); all.checked = slice.length > 0 && slice.every((r) => state.sel.has(r.id)); all.indeterminate = !all.checked && slice.some((r) => state.sel.has(r.id));
      for (const th of $$('th[data-sort]')) th.setAttribute('aria-sort', th.dataset.sort === state.sort ? (state.dir > 0 ? 'ascending' : 'descending') : 'none');
      const counts = { All: rows.length }; for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
      for (const c of $$('[data-count]')) c.textContent = counts[c.dataset.count] || 0;
    };
    for (const b of $$('#status-seg button')) b.addEventListener('click', () => { for (const x of $$('#status-seg button')) x.setAttribute('aria-pressed', String(x === b)); state.status = b.dataset.status; state.page = 1; draw(); });
    $('#q').addEventListener('input', (e) => { state.q = e.target.value.trim().toLowerCase(); state.page = 1; draw(); });
    for (const th of $$('th[data-sort]')) { const b = th.querySelector('button'); b.addEventListener('click', () => { if (state.sort === th.dataset.sort) state.dir *= -1; else { state.sort = th.dataset.sort; state.dir = th.dataset.sort === 'age' || th.dataset.sort === 'views' ? 1 : 1; } draw(); }); }
    $('#prev').addEventListener('click', () => { state.page--; draw(); }); $('#next').addEventListener('click', () => { state.page++; draw(); });
    $('#all').addEventListener('change', (e) => { for (const cb of $$('input[data-id]', tbody)) { const id = +cb.dataset.id; if (e.target.checked) state.sel.add(id); else state.sel.delete(id); } draw(); });
    tbody.addEventListener('change', (e) => { const id = +e.target.dataset.id; if (!id) return; if (e.target.checked) state.sel.add(id); else state.sel.delete(id); draw(); });
    let pending = [];
    const askDelete = (ids) => { pending = ids; $('#del-text').textContent = ids.length === 1 ? `“${rows.find((r) => r.id === ids[0]).title}” will be removed.` : `${ids.length} articles will be removed.`; $('#confirm').showModal(); };
    tbody.addEventListener('click', (e) => { const d = e.target.closest('[data-del]'); if (d) askDelete([+d.dataset.del]); const ed = e.target.closest('[data-edit]'); if (ed) { const r = rows.find((x) => x.id === +ed.dataset.edit); $('#f-title').value = r.title; $('#editor').showModal(); } });
    $('#bulk-del').addEventListener('click', () => askDelete([...state.sel]));
    $('#bulk-pub').addEventListener('click', () => { rows.forEach((r) => { if (state.sel.has(r.id)) r.status = 'Published'; }); toast(state.sel.size + ' articles published'); state.sel.clear(); draw(); });
    $('#confirm-ok').addEventListener('click', () => { rows = rows.filter((r) => !pending.includes(r.id)); pending.forEach((id) => state.sel.delete(id)); $('#confirm').close(); toast(pending.length === 1 ? 'Article deleted' : pending.length + ' articles deleted'); draw(); });
    // new article form with validation
    const form = $('#editor-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const t = $('#f-title'); const err = $('#f-title-err');
      if (!t.value.trim()) { err.hidden = false; t.setAttribute('aria-invalid', 'true'); t.focus(); return; }
      err.hidden = true; t.removeAttribute('aria-invalid');
      rows.unshift({ id: Date.now(), title: t.value.trim(), path: '/news/' + t.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28), status: $('#f-status').value, author: 'Admin', views: 0, age: 0 });
      t.value = ''; $('#editor').close(); toast('Article saved'); draw();
    });
    $('#f-title').addEventListener('input', (e) => { if (e.target.value.trim()) { $('#f-title-err').hidden = true; e.target.removeAttribute('aria-invalid'); } });
    $('#new-article').addEventListener('click', () => { form.reset(); $('#editor').showModal(); });
    draw();
  }

  // ---- admin: dropzone ----
  for (const dz of $$('.xo-dropzone')) {
    const input = $('input', dz); const out = $('[data-dz-out]', dz);
    const take = (files) => { if (files.length) { out.textContent = [...files].map((f) => f.name).join(', '); toast(files.length + (files.length === 1 ? ' file' : ' files') + ' ready to upload'); } };
    input.addEventListener('change', () => take(input.files));
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.dataset.over = ''; });
    dz.addEventListener('dragleave', () => dz.removeAttribute('data-over'));
    dz.addEventListener('drop', (e) => { e.preventDefault(); dz.removeAttribute('data-over'); take(e.dataTransfer.files); });
  }

  // ---- admin: chart range switch ----
  const chart = $('#chart');
  if (chart) {
    const sets = { 7: [42, 58, 51, 74, 66, 88, 79], 30: [52, 61, 48, 70, 64, 77, 59, 83, 72, 91, 68, 86], 90: [30, 44, 39, 58, 62, 55, 71, 66, 80, 74, 92, 97] };
    const labels = { 7: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], 30: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12'], 90: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
    const drawChart = (k) => {
      const d = sets[k], W = 640, H = 220, p = 28, bw = (W - p * 2) / d.length;
      const max = 100; const y = (v) => H - p - (v / max) * (H - p * 2);
      let g = ''; for (const t of [0, 50, 100]) g += `<line class="grid" x1="${p}" x2="${W - p}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="0" y="${y(t) + 4}">${t}</text>`;
      let bars = ''; d.forEach((v, i) => { const x = p + i * bw + bw * .2; bars += `<rect class="bar" tabindex="0" x="${x}" y="${y(v)}" width="${bw * .6}" height="${H - p - y(v)}" rx="4"><title>${labels[k][i]}: ${v}k visits</title></rect><text class="axis" x="${x + bw * .3}" y="${H - 8}" text-anchor="middle">${labels[k][i]}</text>`; });
      chart.innerHTML = g + bars;
      $('#chart-table tbody').innerHTML = d.map((v, i) => `<tr><td>${labels[k][i]}</td><td>${v}k</td></tr>`).join('');
    };
    for (const b of $$('#range-seg button')) b.addEventListener('click', () => { for (const x of $$('#range-seg button')) x.setAttribute('aria-pressed', String(x === b)); drawChart(b.dataset.range); });
    drawChart(7);
  }

  // ---- admin: settings save ----
  $('#settings-form')?.addEventListener('submit', (e) => { e.preventDefault(); toast('Settings saved'); });
  for (const s of $$('button.xo-switch')) s.addEventListener('click', () => s.setAttribute('aria-checked', String(s.getAttribute('aria-checked') !== 'true')));
  for (const b of $$('.xo-seg:not(#status-seg):not(#range-seg):not(#bill)')) for (const x of $$('button', b)) x.addEventListener('click', () => { for (const y of $$('button', b)) y.setAttribute('aria-pressed', String(y === x)); });

  // ---- landing: billing toggle ----
  const bill = $('#bill');
  if (bill) {
    const set = (yearly) => { for (const b of $$('button', bill)) b.setAttribute('aria-pressed', String((b.dataset.bill === 'year') === yearly)); for (const p of $$('[data-month]')) { p.textContent = yearly ? p.dataset.year : p.dataset.month; } for (const s of $$('[data-per]')) s.textContent = yearly ? '/ month, billed yearly' : '/ month'; };
    for (const b of $$('button', bill)) b.addEventListener('click', () => set(b.dataset.bill === 'year'));
    set(true);
  }

  // ---- landing: testimonial carousel ----
  const car = $('#quotes');
  if (car) {
    const items = $$('figure', car); let i = 0;
    const go = (n) => { i = (n + items.length) % items.length; items.forEach((f, k) => { f.hidden = k !== i; }); $('#q-pos').textContent = `${i + 1} / ${items.length}`; };
    $('#q-prev').addEventListener('click', () => go(i - 1)); $('#q-next').addEventListener('click', () => go(i + 1)); go(0);
  }

  // ---- landing: signup validation ----
  const su = $('#signup');
  if (su) su.addEventListener('submit', (e) => {
    e.preventDefault();
    const em = $('#su-email'); const err = $('#su-err'); const ok = $('#su-ok');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value)) { err.hidden = false; em.setAttribute('aria-invalid', 'true'); em.focus(); ok.textContent = ''; return; }
    err.hidden = true; em.removeAttribute('aria-invalid'); ok.textContent = 'Thanks! Check your inbox to confirm.'; em.value = '';
  });

  for (const el of $$('[data-w]')) el.style.width = el.dataset.w + '%';
  $('#cookie-reopen')?.addEventListener('click', () => { $('#cookie').hidden = false; });

  // ---- landing: cookie banner ----
  const ck = $('#cookie');
  if (ck) {
    if (store.get('xoong-demo-cookie')) ck.hidden = true;
    for (const b of $$('[data-cookie]', ck)) b.addEventListener('click', () => { store.set('xoong-demo-cookie', b.dataset.cookie); ck.hidden = true; });
  }
})();
