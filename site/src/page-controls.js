// The controls page: show what the controls report, to see the events and values.
const $ = (selector) => document.querySelector(selector);

// Tabs: `xo-tab-change` carries the selected key.
$('#demo-tabs').addEventListener('xo-tab-change', (e) => { $('#tabs-out').textContent = e.detail.value; });

// Menu: choosing an item runs it as it is (a handler, a link, xo-click); here a click handler notes it.
$('#demo-menu').addEventListener('click', (e) => {
  const item = e.target.closest('button:not([xo-menu-trigger]), a');
  if (item) $('#menu-out').textContent = item.textContent;
});

// Combobox and tags are form controls: `value` is a string, or an array with `multiple` and for tags.
const report = () => {
  $('#combo-out').textContent = JSON.stringify({ author: $('#demo-author').value, topics: $('#demo-topics').value, keywords: $('#demo-tags').value });
};
for (const id of ['#demo-author', '#demo-topics', '#demo-tags']) $(id).addEventListener('change', report);
report();
