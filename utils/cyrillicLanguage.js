/* global module */

/**
 * Язык кириллических цитат внутри текста на латинице (#2472).
 *
 * Переводы квестов на PL/EN цитируют вывески как есть: «Kawiarnia «Ландыш»»,
 * «Львівська копальня кави», «Лесвіца ў Падміколле». Чтобы программа чтения
 * с экрана и поисковик не читали их по-польски или по-английски, каждый
 * кириллический фрагмент получает язык оригинала.
 *
 * Язык выводится из алфавита (какие языки вообще могут содержать все буквы
 * фрагмента) и страны квеста (какие языки там правдоподобны на вывеске).
 * Буквы однозначны не всегда: «Ландыш» пишется одинаково по-русски и
 * по-белорусски — тогда берётся первый правдоподобный язык страны, для
 * Беларуси это русский язык источника квеста. Фрагмент, который целиком не
 * подходит ни одному правдоподобному языку («Капліца-пахавальня
 * Святополк-Мирских»), размечается пословно.
 */

const CYRILLIC_LETTER = /[\u0400-\u04FF]/;
// A run: Cyrillic words joined by spaces or dots («ул. Ленина», «Лесные озёра»).
// The stress mark U+0301 stays out of the class: it combines with a letter.
const CYRILLIC_RUN = /[\u0400-\u04FF](?:[\u0400-\u04FF'’ʼ-]|\u0301|[\s.]+(?=[\u0400-\u04FF]))*/g;
const CYRILLIC_WORD = /[\u0400-\u04FF](?:[\u0400-\u04FF'’ʼ-]|\u0301)*/g;

const RUSSIAN = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
const ALPHABETS = Object.freeze({
  ru: new Set(RUSSIAN),
  be: new Set('абвгдеёжзйклмнопрстуўфхцчшыьэюяі'),
  uk: new Set('абвгґдеєжзиіїйклмнопрстуфхцчшщьюя'),
  kk: new Set(`${RUSSIAN}әғқңөұүһі`),
  uz: new Set(`${RUSSIAN}ўқғҳ`),
  tg: new Set(`${RUSSIAN}ғӣқӯҳҷ`),
  sr: new Set('абвгдђежзијклљмнњопрстћуфхцчџш'),
  mk: new Set('абвгдѓежзѕијклљмнњопрстќуфхцчџш'),
});
const DEFAULT_ORDER = Object.freeze(['ru', 'be', 'uk', 'kk', 'uz', 'tg', 'sr', 'mk']);
// Languages a sign in the country is plausibly written in, most likely first.
const COUNTRY_LANGUAGES = Object.freeze({
  BY: ['ru', 'be'],
  UA: ['uk', 'ru'],
  KZ: ['kk', 'ru'],
  UZ: ['uz', 'ru'],
  TJ: ['tg', 'ru'],
  RS: ['sr'],
  ME: ['sr'],
  BA: ['sr'],
  MK: ['mk'],
});

function lettersOf(fragment) {
  return [...String(fragment).toLowerCase()].filter((char) => CYRILLIC_LETTER.test(char));
}

function fittingLanguages(fragment) {
  const letters = lettersOf(fragment);
  return DEFAULT_ORDER.filter((lang) => letters.every((char) => ALPHABETS[lang].has(char)));
}

function plausibleLanguages(countryCode) {
  return COUNTRY_LANGUAGES[String(countryCode || '').trim().toUpperCase()] || DEFAULT_ORDER;
}

/** Language of one word: plausible for the country first, then any alphabet that fits. */
function wordLanguage(word, plausible) {
  const fitting = fittingLanguages(word);
  return plausible.find((lang) => fitting.includes(lang)) || fitting[0] || 'und';
}

/**
 * Splits a Cyrillic run into `{ text, lang }` parts. Whole run when one
 * plausible language fits every letter; otherwise word by word, adjacent
 * words of one language merged with what lies between them.
 */
function cyrillicRunLanguages(run, { countryCode } = {}) {
  const plausible = plausibleLanguages(countryCode);
  const fitting = fittingLanguages(run);
  const whole = plausible.find((lang) => fitting.includes(lang));
  if (whole) return [{ text: run, lang: whole }];
  const parts = [];
  let last = 0;
  for (const match of run.matchAll(CYRILLIC_WORD)) {
    const lang = wordLanguage(match[0], plausible);
    const previous = parts[parts.length - 1];
    if (previous && previous.lang === lang) {
      previous.text += run.slice(last, match.index) + match[0];
    } else {
      if (previous) parts.push({ text: run.slice(last, match.index), lang: null });
      parts.push({ text: match[0], lang });
    }
    last = match.index + match[0].length;
  }
  return parts;
}

/**
 * Text as `{ text, lang }` segments: `lang` is null for everything that is
 * not a Cyrillic run, a BCP 47 primary tag for each run.
 */
function cyrillicLanguageSegments(text, options = {}) {
  const source = String(text ?? '');
  const segments = [];
  let last = 0;
  for (const match of source.matchAll(CYRILLIC_RUN)) {
    if (match.index > last) segments.push({ text: source.slice(last, match.index), lang: null });
    segments.push(...cyrillicRunLanguages(match[0], options));
    last = match.index + match[0].length;
  }
  if (last < source.length) segments.push({ text: source.slice(last), lang: null });
  return segments;
}

module.exports = {
  CYRILLIC_LETTER,
  cyrillicLanguageSegments,
  cyrillicRunLanguages,
};
