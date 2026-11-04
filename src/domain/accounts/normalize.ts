// Normalization used to match account-link requests to soldiers (D-030, D-066).

/** Combining marks: Hebrew niqqud and cantillation, Latin accents (after NFKD). */
const COMBINING_MARKS = /\p{M}/gu
/** Geresh, gershayim, apostrophes, quotes and backticks are dropped. */
const QUOTES = /[׳״'"`‘’“”]/gu
/** Hyphens, maqaf, dashes and underscores separate words like a space. */
const WORD_JOINERS = /[-_־‐-―]/gu
const WHITESPACE = /\s+/gu

/** Hebrew final letters and their regular forms. */
const FINAL_LETTERS: Readonly<Record<string, string>> = {
  'ך': 'כ',
  'ם': 'מ',
  'ן': 'נ',
  'ף': 'פ',
  'ץ': 'צ',
}
const FINAL_LETTER = /[ךםןףץ]/gu

/**
 * A name in comparable form: no niqqud or accents, no quotes, hyphens as spaces, final
 * letters as regular letters, lower case, single spaces, trimmed.
 */
export function normalizeName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .replace(QUOTES, '')
    .replace(WORD_JOINERS, ' ')
    .replace(FINAL_LETTER, (letter) => FINAL_LETTERS[letter] ?? letter)
    .toLowerCase()
    .replace(WHITESPACE, ' ')
    .trim()
}

/** Spaces, dashes and dots inside a personal id are formatting, not content. */
const ID_SEPARATORS = /[\s.\-־‐-―]/gu
const DIGITS_ONLY = /^\d+$/u
const LEADING_ZEROS = /^0+(?=\d)/u

/**
 * A personal id in canonical form (D-066): separators removed; an all-digit id loses its
 * leading zeros; letters are upper case. NULL when nothing remains. The data layer stores
 * this form, so the unique index sees one value per person.
 */
export function normalizePersonalId(value: string): string | null {
  const compact = value.normalize('NFKC').replace(ID_SEPARATORS, '')
  if (compact === '') return null
  if (DIGITS_ONLY.test(compact)) return compact.replace(LEADING_ZEROS, '')
  return compact.toUpperCase()
}

/** Emails compare without surrounding spaces and case. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}
