/* global module */

const SEO_TITLE_MAX_LENGTH = 60;
const SEO_TITLE_SUFFIX = ' | Metravel';
const SEO_DESCRIPTION_MAX_ENCODED_LENGTH = 160;

function normalizeText(value, fallback = '') {
  return String(value || fallback)
    .replace(/\s+/g, ' ')
    .trim();
}

function pluralizeRu(value, one, few, many) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function stripRepeatedCityPrefix(title, cityName) {
  if (!title || !cityName) return title;
  if (!title.toLocaleLowerCase('ru').startsWith(cityName.toLocaleLowerCase('ru'))) return title;

  const remainder = title.slice(cityName.length);
  if (remainder && !/^[\s:–—-]/u.test(remainder)) return title;
  return remainder.replace(/^[\s:–—-]+/u, '').trim() || title;
}

function buildBrandedSeoTitle(base, maxLength = SEO_TITLE_MAX_LENGTH) {
  const normalized = normalizeText(base);
  if (!normalized) return 'Metravel';

  const maxBaseLength = Math.max(10, maxLength - SEO_TITLE_SUFFIX.length);
  if (normalized.length <= maxBaseLength) return `${normalized}${SEO_TITLE_SUFFIX}`;

  const hardLimit = maxBaseLength - 1;
  const slice = normalized.slice(0, hardLimit);
  const lastSpace = slice.lastIndexOf(' ');
  const clippedAtWord = lastSpace >= Math.floor(hardLimit * 0.6) ? slice.slice(0, lastSpace) : slice;
  const clippedBase = `${clippedAtWord.replace(/[\s.,;:!?·–—-]+$/u, '')}…`;
  return `${clippedBase}${SEO_TITLE_SUFFIX}`;
}

function encodedAttributeLength(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .length;
}

function clampMetaDescription(value, maxEncodedLength = SEO_DESCRIPTION_MAX_ENCODED_LENGTH) {
  const normalized = normalizeText(value);
  if (!normalized || encodedAttributeLength(normalized) <= maxEncodedLength) return normalized;

  let low = 0;
  let high = normalized.length;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (encodedAttributeLength(normalized.slice(0, middle)) <= maxEncodedLength) low = middle;
    else high = middle - 1;
  }

  const slice = normalized.slice(0, low);
  const lastSpace = slice.lastIndexOf(' ');
  const clipped = lastSpace >= Math.floor(low * 0.7) ? slice.slice(0, lastSpace) : slice;
  return clipped.replace(/[\s.,;:!?·–—-]+$/u, '').trim();
}

function formatDuration(durationMin) {
  const minutesTotal = Number(durationMin) || 0;
  if (minutesTotal <= 0) return '';
  const hours = Math.floor(minutesTotal / 60);
  const minutes = minutesTotal % 60;
  if (hours <= 0) return `${minutes} мин`;
  return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
}

function buildQuestSeoMetadata({ title, cityName, points, durationMin } = {}) {
  const questTitle = normalizeText(title, 'Городской квест');
  const city = normalizeText(cityName);
  const shortTitle = stripRepeatedCityPrefix(questTitle, city);
  const searchTitle = city
    ? `${city}: что посмотреть${shortTitle ? ` — ${shortTitle}` : ''}`
    : `${questTitle}: что посмотреть`;

  const descriptionParts = [
    city
      ? `Город ${city}: бесплатный пеший маршрут «${shortTitle}» по достопримечательностям.`
      : `Бесплатный пеший маршрут «${questTitle}» по достопримечательностям.`,
  ];
  const pointsCount = Number(points) || 0;
  if (pointsCount > 0) {
    descriptionParts.push(`${pointsCount} ${pluralizeRu(pointsCount, 'точка', 'точки', 'точек')}.`);
  }
  const duration = formatDuration(durationMin);
  if (duration) descriptionParts.push(`Примерно ${duration}.`);
  descriptionParts.push('Задания и легенды — прямо со смартфона.');

  return {
    title: buildBrandedSeoTitle(searchTitle),
    description: clampMetaDescription(descriptionParts.join(' ')),
  };
}

module.exports = {
  buildBrandedSeoTitle,
  buildQuestSeoMetadata,
  clampMetaDescription,
  encodedAttributeLength,
};
