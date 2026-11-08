// The combobox page: both are form controls, `value` is a string, or an array with `multiple` and for tags.
const $ = (selector) => document.querySelector(selector);
const report = () => {
  $('#combo-out').textContent = JSON.stringify({ author: $('#demo-author').value, topics: $('#demo-topics').value, keywords: $('#demo-tags').value });
};
for (const id of ['#demo-author', '#demo-topics', '#demo-tags']) $(id).addEventListener('change', report);
report();
