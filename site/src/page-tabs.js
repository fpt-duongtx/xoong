// The tabs page: show what the control reports.
// `xo-tab-change` carries the selected key (the section's id, or its position).
document.querySelector('#demo-tabs').addEventListener('xo-tab-change', (e) => {
  document.querySelector('#tabs-out').textContent = e.detail.value;
});
