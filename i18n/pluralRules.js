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

function selectPluralCategory(count, locale) {
  if (typeof Intl.PluralRules === 'function') {
    return new Intl.PluralRules(locale).select(count);
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
