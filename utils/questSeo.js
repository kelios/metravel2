/* global module, require */

const questSeoRu = require('../i18n/locales/ru/questSeo.json');
const { selectPluralCategory } = require('../i18n/pluralRules');
const { SEO_TITLE_MAX_LENGTH, SEO_TITLE_SUFFIX, buildSeoTitle } = require('./seoText');

const DEFAULT_QUEST_SEO_LOCALE = 'ru-RU';

function interpolateTranslation(template, params = {}) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) =>
    params[key] == null ? '' : String(params[key]));
}

function defaultTranslate(key, params = {}) {
  const resourceKey = String(key).replace(/^seo:/, '');
  return interpolateTranslation(questSeoRu[resourceKey] || key, params);
}

// Набор форм числа — семейство `<ключ>_one/_few/_many/_other` (#2238); без
// переданного `translatePlural` (SSG-генератор) форму выбирают правила RU.
function defaultTranslatePlural(key, count, params = {}, locale = DEFAULT_QUEST_SEO_LOCALE) {
  const resourceKey = String(key).replace(/^seo:/, '');
  const form = questSeoRu[`${resourceKey}_${selectPluralCategory(count, locale)}`];
  return interpolateTranslation(form || questSeoRu[resourceKey] || key, { ...params, count });
}

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
  return buildSeoTitle(normalizeText(base), maxLength);
}

// Имя города для заголовка выдачи: «д.Вашково (Ушачского района)» → «Вашково».
// Тип населённого пункта и уточнение района ответа на запрос не дают, а бюджет
// в 60 символов съедают.
function questCitySerpLabel(cityName) {
  return normalizeText(cityName)
    .replace(/\s*\([^)]*\)\s*/gu, ' ')
    .replace(/^(?:урочище|болото|озеро|оз\.|д\.|г\.|с\.)\s*/iu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

// Называет ли заголовок квеста свой город. В заголовках город стоит в косвенном
// падеже — «Квест по Пинску», «Квест по Гервятам», «Квест по Лунинцу», — поэтому
// сравниваем по корню каждого слова названия города, а не по точному вхождению.
// Из 165 квестов каталога 145 называют город сами, и префикс им был бы повтором.
function questTitleNamesCity(title, cityLabel) {
  const haystack = normalizeText(title).toLowerCase();
  if (!haystack) return false;

  return cityLabel
    .toLowerCase()
    .split(/[\s-]+/u)
    .filter((word) => word.length >= 3)
    .some((word) => haystack.includes(word.slice(0, Math.max(3, word.length - 2))));
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

// Описание собирается целыми предложениями: то, что не помещается в лимит,
// опускается целиком, а не обрывается на полуслове («…прямо со»). Обрезка
// остаётся только для первого предложения, если оно само длиннее лимита.
function joinWholeSentences(parts, maxEncodedLength = SEO_DESCRIPTION_MAX_ENCODED_LENGTH) {
  const sentences = parts.map((part) => normalizeText(part)).filter(Boolean);
  if (sentences.length === 0) return '';
  let description = clampMetaDescription(sentences[0], maxEncodedLength);
  if (description !== sentences[0]) return description;
  for (const sentence of sentences.slice(1)) {
    const next = `${description} ${sentence}`;
    if (encodedAttributeLength(next) <= maxEncodedLength) description = next;
  }
  return description;
}

// Первое предложение несёт название квеста, второе — формат (#3284). Формат
// обязателен: если вместе они не влезают, укорачивается название внутри первого
// предложения (с «…»), а не теряется второе. Без этого 65 из 282 квестов каталога
// (названия длиннее ~52 знаков) оставались в сниппете без «в любой день, без записи».
const MIN_CLIPPED_TITLE_LENGTH = 12;

function fitLeadBeforeFormat(renderLead, title, format, maxEncodedLength = SEO_DESCRIPTION_MAX_ENCODED_LENGTH) {
  const lead = renderLead(title);
  const overflow = encodedAttributeLength(`${normalizeText(lead)} ${normalizeText(format)}`) - maxEncodedLength;
  if (overflow <= 0) return lead;
  const budget = encodedAttributeLength(title) - overflow - 1; // 1 — место под «…»
  if (budget < MIN_CLIPPED_TITLE_LENGTH) return lead;
  return renderLead(`${clampMetaDescription(title, budget)}…`);
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
  translatePlural,
  locale = DEFAULT_QUEST_SEO_LOCALE,
} = {}) {
  const pluralize = translatePlural
    || (translate === defaultTranslate
      ? (key, count, params) => defaultTranslatePlural(key, count, params, locale)
      : (key, count, params) => translate(key, { ...params, count }));
  const questTitle = normalizeText(title, translate('seo:utils.questSeo.gorodskoy_kvest_2737d6fc'));
  const city = normalizeText(cityName);
  const shortTitle = stripRepeatedCityPrefix(questTitle, city);
  // SEO-QUESTS #1756: заголовок больше не открывается формулой «<Город>: что
  // посмотреть». Замер GSC 05.08–01.09.2026 показал, что кластер «что посмотреть
  // / куда сходить / достопримечательности» на сайте держат статьи /travels
  // (1 181 показ, 48 кликов, ср. позиция 14,7), а квест-URL стоят в нём на 65-й
  // позиции и за 28 дней не дали ни одного клика. Вдобавок формула сталкивала
  // детальную страницу с посадочной города: 19 запросов выставляли оба URL
  // сразу — 411 показов из 845, половину видимости раздела. Заголовок строится
  // вокруг названия квеста, город добавляется только когда название молчит о нём.
  const cityLabel = questCitySerpLabel(city);
  const searchTitle = cityLabel && !questTitleNamesCity(questTitle, cityLabel)
    ? translate('seo:utils.questSeo.city_prefixed_quest_title', { value1: cityLabel, value2: questTitle })
    : questTitle;

  // #3284: сразу после названия идёт формат — «сами, в любой день, без записи».
  // Посетитель из поиска принял квест за мероприятие с датой, записью и ценой:
  // слово «бесплатный» в сниппете на вопрос «когда и с кем» не отвечает.
  const renderLead = (leadTitle) => (city
    ? translate('seo:utils.questSeo.gorod_value1_besplatnyy_peshiy_marshrut_valu_951719a3', { value1: city, value2: leadTitle })
    : translate('seo:utils.questSeo.besplatnyy_peshiy_marshrut_value1_po_dostopr_8cbbea0f', { value1: leadTitle }));
  const format = translate('seo:utils.questSeo.selfGuidedAnyDay');
  const descriptionParts = [fitLeadBeforeFormat(renderLead, city ? shortTitle : questTitle, format), format];
  const pointsCount = Number(points) || 0;
  if (pointsCount > 0) {
    descriptionParts.push(`${pointsCount} ${pluralize('seo:utils.questSeo.pointNoun', pointsCount)}.`);
  }
  const duration = formatDuration(durationMin, translate);
  if (duration) descriptionParts.push(translate('seo:utils.questSeo.primerno_value1_cc8b37aa', { value1: duration }));

  return {
    title: buildBrandedSeoTitle(searchTitle),
    description: joinWholeSentences(descriptionParts),
  };
}

// #3236: посадочная города `/quests/<город>` — head из одного источника для
// SSR-проекции и клиентского экрана. Шаблон «Городские квесты: <Город> —
// прогулки с заданиями» отличался между 232 городами только именем; заголовок
// и описание теперь несут то, что есть только у этого города: реальные места
// его маршрутов, названия квестов и соседние города. Формулу «что посмотреть»
// держат статьи /travels (#1756), в описании города её нет.
const CITY_LANDING_TITLE_PLACES = 2;
const CITY_LANDING_DESCRIPTION_QUESTS = 3;
const CITY_LANDING_NEARBY = 4;
const CITY_LANDING_PLACE_MAX_LENGTH = 30;
const CITY_LANDING_PLACE_MAX_WORDS = 4;

// Заголовок точки в квесте — чаще авторская загадка («Знак терпения», «Король,
// который показал пальцем») или родовое слово («Холм», «Двор», «Колокол»), чем
// имя места. Метка места проходит два условия:
// 1. голова заголовка подтверждена адресом точки — каждое значимое слово
//    («Башня Шоломона») встречается в её location («Башня Шоломона
//    (Salamon-torony), Salamontorony utca»);
// 2. в ней есть имя собственное: слово с заглавной не в начале или число
//    («Площадь Дам», «Свято-Духов собор», «Нотр-Дам», «Форт 45»). Одиночное
//    слово этого признака не несёт: «Синтагма» и «Колокол» по написанию не
//    различить, а «Колокол» подтверждается адресом «у Колокольной башни».
// Остальное заголовок не получает: «квесты-прогулки с заданиями» честнее
// «квесты-прогулки — Холм».
const OPTIONAL_PLACE_MARK = /по\s+желанию/iu;
const PLACE_HEAD_BREAK = /\s+[—–-]\s+|:\s|,\s|\s\(/u;
const PROPER_NAME_MARK = /[\s-]«?\p{Lu}|\p{N}/u;
const QUEST_WORD = /^(?:квест|квэст|quest)$/iu;

function placeWords(value) {
  return normalizeText(value).toLowerCase().match(/[\p{L}\p{N}-]+/gu) || [];
}

function wordStem(word) {
  return word.slice(0, Math.max(4, word.length - 2));
}

function questCityLandingPlaceLabel(place) {
  const title = normalizeText(place?.title);
  const location = normalizeText(place?.location);
  if (!title || OPTIONAL_PLACE_MARK.test(title)) return '';
  const head = title.split(PLACE_HEAD_BREAK)[0].trim();
  const words = placeWords(head);
  if (!head || head.length > CITY_LANDING_PLACE_MAX_LENGTH || words.length === 0 || words.length > CITY_LANDING_PLACE_MAX_WORDS) return '';
  if ((head.match(/«/gu) || []).length !== (head.match(/»/gu) || []).length) return '';
  const haystack = location.toLowerCase();
  const significant = words.filter((word) => word.length >= 4);
  if (location && (significant.length === 0 || !significant.every((word) => haystack.includes(wordStem(word))))) return '';
  return PROPER_NAME_MARK.test(head) ? head : '';
}

/** Реальные места маршрутов города в порядке `walk.places`, без повторов и самого города. */
function questCityLandingPlaceLabels(places, cityName) {
  const cityLabel = questCitySerpLabel(cityName).toLowerCase();
  const labels = [];
  for (const place of Array.isArray(places) ? places : []) {
    const label = questCityLandingPlaceLabel(place);
    if (!label || label.toLowerCase() === cityLabel) continue;
    if (labels.some((known) => known.toLowerCase() === label.toLowerCase())) continue;
    labels.push(label);
  }
  return labels;
}

// «Минск: звезда над батлейкой» и «Квест по Минску: звезда над батлейкой» на
// странице Минска — это «звезда над батлейкой»: город уже открывает описание.
// Снимается только префикс до двоеточия или тире, целиком состоящий из города
// («Минск:») или из «Квест <предлог> <город>». «Витебск как галерея: …»,
// «Квест по дворикам Минска: …» и «Велоквест из Гродно: …» несут смысл и
// остаются целиком.
function questLandingQuestTitle(title, cityLabel) {
  const text = normalizeText(title);
  const match = /^(.+?)(?::\s+|\s+[—–]\s+)(.+)$/u.exec(text);
  if (!match || !cityLabel) return text;
  const prefix = match[1];
  const words = prefix.split(/\s+/u);
  const namesCity = prefix.toLowerCase() === cityLabel.toLowerCase()
    || (words.length === 3 && QUEST_WORD.test(words[0]) && questTitleNamesCity(words[2], cityLabel));
  if (!namesCity) return text;
  // «Брест: пока горит свеча» в списке посадочной читается как «Пока горит свеча».
  const rest = match[2].trim();
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

function buildQuestCityLandingMeta({
  cityName,
  countryName,
  questTitles = [],
  places = [],
  nearbyCityNames = [],
  translate = defaultTranslate,
  translatePlural,
  locale = DEFAULT_QUEST_SEO_LOCALE,
} = {}) {
  const pluralize = translatePlural
    || (translate === defaultTranslate
      ? (key, count, params) => defaultTranslatePlural(key, count, params, locale)
      : (key, count, params) => translate(key, { ...params, count }));
  const serpLabel = questCitySerpLabel(cityName);
  const country = normalizeText(countryName);
  const cityLabel = country
    ? translate('seo:utils.questSeo.cityLandingWithCountry', { value1: serpLabel, value2: country })
    : serpLabel;

  const placeLabels = questCityLandingPlaceLabels(places, cityName).slice(0, CITY_LANDING_TITLE_PLACES);
  const titleCandidates = placeLabels
    .map((_, index) => translate('seo:utils.questSeo.cityLandingTitle', {
      value1: cityLabel, value2: placeLabels.slice(0, placeLabels.length - index).join(', '),
    }));
  titleCandidates.push(translate('seo:utils.questSeo.cityLandingTitleBare', { value1: cityLabel }));
  const titleBase = titleCandidates.find((candidate) =>
    normalizeText(candidate).length + SEO_TITLE_SUFFIX.length <= SEO_TITLE_MAX_LENGTH)
    || titleCandidates[titleCandidates.length - 1];

  const sortedTitles = questTitles
    .map((title) => normalizeText(title))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, locale));
  const count = sortedTitles.length;
  const countPhrase = pluralize('seo:utils.questSeo.cityLandingQuestCount', count);
  const quoted = sortedTitles.map((title) =>
    translate('seo:utils.questSeo.cityLandingQuotedTitle', { value1: questLandingQuestTitle(title, serpLabel) }));
  const renderLead = (shown) => {
    if (shown === 0) return translate('seo:utils.questSeo.cityLandingLead', { value1: cityLabel, value2: countPhrase });
    const list = quoted.slice(0, shown).join(', ');
    return translate('seo:utils.questSeo.cityLandingLeadQuests', {
      value1: cityLabel,
      value2: countPhrase,
      value3: shown < quoted.length ? translate('seo:utils.questSeo.cityLandingMoreQuests', { value1: list }) : list,
    });
  };
  const format = translate('seo:utils.questSeo.selfGuidedAnyDay');
  const fits = (parts) => encodedAttributeLength(parts.map((part) => normalizeText(part)).join(' ')) <= SEO_DESCRIPTION_MAX_ENCODED_LENGTH;

  let lead = renderLead(0);
  for (let shown = Math.min(quoted.length, CITY_LANDING_DESCRIPTION_QUESTS); shown > 0; shown -= 1) {
    if (fits([renderLead(shown), format])) {
      lead = renderLead(shown);
      break;
    }
  }
  const descriptionParts = [lead, format];
  const nearby = nearbyCityNames.map((name) => questCitySerpLabel(name)).filter(Boolean).slice(0, CITY_LANDING_NEARBY);
  for (let shown = nearby.length; shown > 0; shown -= 1) {
    const sentence = translate('seo:utils.questSeo.cityLandingNearby', { value1: nearby.slice(0, shown).join(', ') });
    if (fits([...descriptionParts, sentence])) {
      descriptionParts.push(sentence);
      break;
    }
  }

  return {
    title: buildBrandedSeoTitle(titleBase),
    description: joinWholeSentences(descriptionParts),
  };
}

module.exports = {
  buildBrandedSeoTitle,
  buildQuestCityLandingMeta,
  buildQuestSeoMetadata,
  clampMetaDescription,
  encodedAttributeLength,
  questCityLandingPlaceLabels,
};
