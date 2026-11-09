// @ts-check
/**
 * Search text for matching: lower case, without accents. "Nguyễn Văn A" becomes "nguyen van a", so a query typed without accents (or with
 * them, or half-composed by a Telex keyboard) finds it. Only the combining marks of the Latin, Greek and Cyrillic accents (U+0300 to U+036F)
 * go: the marks of other scripts are part of their letters. đ and Đ are letters of their own that do not decompose: they fold to d.
 * @param {unknown} value
 */
export const fold = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/đ/g, 'd');
