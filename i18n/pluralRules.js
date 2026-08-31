/* global module */

function selectRussianPluralCategory(count) {
  const absoluteCount = Math.abs(count);
  if (!Number.isInteger(absoluteCount)) return 'other';

  const lastDigit = absoluteCount % 10;
  const lastTwoDigits = absoluteCount % 100;
  if (lastDigit === 1 && lastTwoDigits !== 11) return 'one';
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return 'few';
  }
  return 'many';
}

function selectPolishPluralCategory(count) {
  const absoluteCount = Math.abs(count);
  if (!Number.isInteger(absoluteCount)) return 'other';
  if (absoluteCount === 1) return 'one';

  const lastDigit = absoluteCount % 10;
  const lastTwoDigits = absoluteCount % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return 'few';
  }
  return 'many';
}

// Пул `Intl.PluralRules` (#1643): конструктор резолвит данные локали заново на
// каждый вызов, а `selectPlural` зовётся в render'е списков десятками раз с
// одним и тем же языковым тегом. Объект без состояния — переиспользуется.
// Цена повторного конструктора мала (весь разогрев ICU приходится на первый),
// поэтому это устранение лишней работы, а не рычаг TBT.
const pluralRulesCache = new Map();

function getPluralRules(locale) {
  const cached = pluralRulesCache.get(locale);
  if (cached) return cached;
  const rules = new Intl.PluralRules(locale);
  pluralRulesCache.set(locale, rules);
  return rules;
}

function selectPluralCategory(count, locale) {
  if (typeof Intl.PluralRules === 'function') {
    return getPluralRules(locale).select(count);
  }

  // Hermes in the current Android shell may not expose Intl.PluralRules. Keep
  // every supported production locale functional without a startup polyfill.
  const normalizedLocale = String(locale).toLowerCase();
  if (
    normalizedLocale.startsWith('ru') ||
    normalizedLocale.startsWith('be') ||
    normalizedLocale.startsWith('uk')
  ) {
    return selectRussianPluralCategory(count);
  }
  if (normalizedLocale.startsWith('pl')) return selectPolishPluralCategory(count);
  if (normalizedLocale.startsWith('en')) return Math.abs(count) === 1 ? 'one' : 'other';
  return 'other';
}

module.exports = { selectPluralCategory };
