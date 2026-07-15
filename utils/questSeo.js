/* global module, require */

const questSeoRu = require('../i18n/locales/ru/questSeo.json');
const { selectPluralCategory } = require('../i18n/pluralRules');

const DEFAULT_QUEST_SEO_LOCALE = 'ru-RU';

function interpolateTranslation(template, params = {}) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) =>
    params[key] == null ? '' : String(params[key]));
}

function defaultTranslate(key, params = {}) {
  const resourceKey = String(key).replace(/^seo:/, '');
  return interpolateTranslation(questSeoRu[resourceKey] || key, params);
}

function selectPlural(count, forms, locale) {
  const category = selectPluralCategory(count, locale);
  return forms[category] || forms.other;
}

const SEO_TITLE_MAX_LENGTH = 60;
const SEO_TITLE_SUFFIX = ' | Metravel';
const SEO_DESCRIPTION_MAX_ENCODED_LENGTH = 160;

function normalizeText(value, fallback = '') {
  return String(value || fallback)
    .replace(/\s+/g, ' ')
    .trim();
}

function stripRepeatedCityPrefix(title, cityName) {
  if (!title || !cityName) return title;
  if (!title.toLowerCase().startsWith(cityName.toLowerCase())) return title;

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

function formatDuration(durationMin, translate) {
  const minutesTotal = Number(durationMin) || 0;
  if (minutesTotal <= 0) return '';
  const hours = Math.floor(minutesTotal / 60);
  const minutes = minutesTotal % 60;
  if (hours <= 0) return translate('seo:utils.questSeo.value1_min_7c081c0f', { value1: minutes });
  return minutes > 0 ? translate('seo:utils.questSeo.value1_ch_value2_min_a31b9fed', { value1: hours, value2: minutes }) : translate('seo:utils.questSeo.value1_ch_d6644461', { value1: hours });
}

function buildQuestSeoMetadata({
  title,
  cityName,
  points,
  durationMin,
  translate = defaultTranslate,
  locale = DEFAULT_QUEST_SEO_LOCALE,
} = {}) {
  const questTitle = normalizeText(title, translate('seo:utils.questSeo.gorodskoy_kvest_2737d6fc'));
  const city = normalizeText(cityName);
  const shortTitle = stripRepeatedCityPrefix(questTitle, city);
  const searchTitle = city
    ? translate('seo:utils.questSeo.value1_chto_posmotret_value2_c7c9b7ba', { value1: city, value2: shortTitle ? ` — ${shortTitle}` : '' })
    : translate('seo:utils.questSeo.value1_chto_posmotret_3257ff8c', { value1: questTitle });

  const descriptionParts = [
    city
      ? translate('seo:utils.questSeo.gorod_value1_besplatnyy_peshiy_marshrut_valu_951719a3', { value1: city, value2: shortTitle })
      : translate('seo:utils.questSeo.besplatnyy_peshiy_marshrut_value1_po_dostopr_8cbbea0f', { value1: questTitle }),
  ];
  const pointsCount = Number(points) || 0;
  if (pointsCount > 0) {
    descriptionParts.push(`${pointsCount} ${selectPlural(pointsCount, {
      one: translate('seo:utils.questSeo.tochka_1aa8f86f'),
      few: translate('seo:utils.questSeo.tochki_8aa14238'),
      many: translate('seo:utils.questSeo.tochek_0509b34c'),
      other: translate('seo:utils.questSeo.tochek_0509b34c'),
    }, locale)}.`);
  }
  const duration = formatDuration(durationMin, translate);
  if (duration) descriptionParts.push(translate('seo:utils.questSeo.primerno_value1_cc8b37aa', { value1: duration }));
  descriptionParts.push(translate('seo:utils.questSeo.zadaniya_i_legendy_pryamo_so_smartfona_33796e9b'));

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
