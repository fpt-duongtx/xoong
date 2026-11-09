// The matching of the docs search, without a DOM: it runs in the browser (search.js, reference-menu.js) and in Node (the index generator, the tests).
// An item of site/search-index.json is { title, page?, url, group, kind, text, keywords, related? }: `page` is the page a section belongs to, `keywords` are
// written by hand (what a person might type), `related` are synonyms added by the generator.

/**
 * Lower case, without accents, so "dong", "Đồng" and "ĐỒNG" meet. The same rule as `fold()` of @xoong/controls (packages/controls/src/fold.js, used by
 * <xo-combobox> and <xo-command>); test/reference.test.mjs keeps the two equal. Only the combining marks U+0300 to U+036F go; đ is a letter of its own.
 */
export const fold = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\u0111/g, 'd');

/** The words of a query: folded, without the brackets people type around a tag name (`<xo-dialog>`). */
export const tokens = (query) => fold(query).replace(/[<>(){}`"'\\]/g, ' ').split(/\s+/).filter(Boolean);

const KIND_BONUS = { page: 6, element: 5, directive: 5, api: 5, event: 4, syntax: 4, section: 0 };
const wordStart = (text, token) => { for (let i = text.indexOf(token); i >= 0; i = text.indexOf(token, i + 1)) if (i === 0 || !/[a-z0-9]/.test(text[i - 1])) return true; return false; };

/** How well one token matches a field: a title match outranks a keyword match, which outranks the text. 0 is no match. */
function score(token, title, page, keywords, related, text) {
  if (title === token) return 100;
  if (title.startsWith(token)) return 80;
  if (wordStart(title, token)) return 60;
  if (title.includes(token)) return 40;
  if (wordStart(keywords, token)) return 25;
  if (page && wordStart(page, token)) return 20;
  if (wordStart(related, token)) return 15;
  if (keywords.includes(token) || related.includes(token) || (page && page.includes(token))) return 10;
  if (text.includes(token)) return 8;
  return 0;
}

/** Prepare the folded copies of the fields once (the index is a plain JSON file). */
export function prepare(items) {
  return items.map((item) => ({ item, title: fold(item.title).replace(/[<>(){}`]/g, ''), page: fold(item.page ?? ''), keywords: fold(item.keywords ?? ''), related: fold(item.related ?? ''), text: fold(item.text ?? '') }));
}

/**
 * The items that match every word of the query, best first: a title that starts with the word, then a word inside the title, the keywords (synonyms),
 * the page a section belongs to, and last the short text. A short title beats a long one, and a whole entry (a page, an element) wins a tie against a section.
 * @param {ReturnType<typeof prepare>} prepared
 * @param {string} query
 * @param {number} [limit]
 */
export function search(prepared, query, limit = 40) {
  const words = tokens(query);
  if (!words.length) return [];
  const phrase = words.join(' ');
  const found = [];
  for (const entry of prepared) {
    let total = 0;
    for (const word of words) {
      const s = score(word, entry.title, entry.page, entry.keywords, entry.related, entry.text);
      if (!s) { total = 0; break; }
      total += s;
    }
    if (!total) continue;
    if (words.length > 1 && entry.title.startsWith(phrase)) total += 30;
    found.push({ item: entry.item, score: total - Math.min(entry.title.length, 60) / 2 + (KIND_BONUS[entry.item.kind] ?? 0) }); // a word that is most of a short title is a better hit than the same word in a long one
  }
  return found.sort((a, b) => b.score - a.score || a.item.title.length - b.item.title.length || a.item.title.localeCompare(b.item.title)).slice(0, limit).map((f) => f.item);
}
