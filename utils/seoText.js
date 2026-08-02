/* global module */

/**
 * Единые правила текста для выдачи: `<title>` и лид, из которого собирается
 * сниппет. Используются и SSG-страницами (`scripts/generate-seo-pages.js`), и
 * рантаймом travel/quests. Раньше логика заголовка была скопирована в три места
 * и могла разъехаться — тогда статический `<title>` и заголовок после гидрации
 * отличались бы.
 */

const SEO_TITLE_MAX_LENGTH = 60;
const SEO_TITLE_SUFFIX = ' | Metravel';

// Хвостовые знаки, которые нельзя оставлять перед многоточием: «…центр,…» читается хуже «…центр…».
const TRAILING_PUNCTUATION = /[\s.,;:!?·–—-]+$/u;

/**
 * `<title>` в пределах бюджета SERP.
 *
 * Бренд-суффикс — необязательная часть заголовка: на ранжирование он не влияет,
 * а места занимает 11 символов. Поэтому при нехватке бюджета жертвуем брендом,
 * а не ключевыми словами: «Смолевуд: натурная площадка Беларусьфильма под Минском»
 * вместо «Смолевуд: натурная площадка Беларусьфильма под… | Metravel».
 */
function buildSeoTitle(base, maxLength = SEO_TITLE_MAX_LENGTH) {
  const normalized = String(base == null ? '' : base)
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return 'Metravel';

  if (normalized.length + SEO_TITLE_SUFFIX.length <= maxLength) {
    return `${normalized}${SEO_TITLE_SUFFIX}`;
  }
  if (normalized.length <= maxLength) return normalized;

  // Не влезает даже без бренда — режем по границе слова, чтобы в выдаче не было
  // обрубка вида «…Нитосл…». Один символ бюджета резервируем под многоточие.
  const hardLimit = Math.max(1, maxLength - 1);
  const slice = normalized.slice(0, hardLimit);
  const lastSpace = slice.lastIndexOf(' ');
  // Слишком ранняя граница слова съела бы заголовок целиком (одно длинное слово
  // в начале) — в этом случае честнее жёсткий срез.
  const clipped = lastSpace >= Math.floor(hardLimit * 0.6) ? slice.slice(0, lastSpace) : slice;

  return `${clipped.replace(TRAILING_PUNCTUATION, '')}…`;
}

// Декоративные пиктограммы: эмодзи, дингбаты, звёзды/стрелки-иконки, модификаторы
// тона кожи, флаги и служебные селекторы вариаций. Типографику (— № ° → «») не трогаем.
const DECORATIVE_PICTOGRAPH_RE =
  /[\u{1F000}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{2B00}-\u{2BFF}]|\u{FE0E}|\u{FE0F}|\u{200D}/gu;

// Служебная строка «откуда — куда» в начале статьи: «Краков - Каспровый Верх (107км 1 час 40 минут)».
// В сниппете она занимает половину бюджета и не отвечает на запрос.
// После единицы длины стоит (?!\p{L}), а не \b: у кириллицы \b не срабатывает.
const LEADING_ROUTE_LINE_RE = /^[^.!?]{0,80}\(\s*\d+[\s\u00A0]*(?:км|km)(?!\p{L})[^)]*\)[\s:—–-]*/iu;

/**
 * Чистит лид статьи перед сборкой meta description: убирает декоративные
 * пиктограммы и служебную строку маршрута, чтобы сниппет начинался с сути.
 * Текст самой статьи при этом не меняется — правится только то, что уходит в выдачу.
 */
function normalizeSeoLead(text) {
  const plain = String(text == null ? '' : text);
  if (!plain) return '';

  const withoutRoute = plain.replace(LEADING_ROUTE_LINE_RE, '');
  return (withoutRoute || plain)
    .replace(DECORATIVE_PICTOGRAPH_RE, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:.–—-]+/u, '')
    .trim();
}

module.exports = {
  SEO_TITLE_MAX_LENGTH,
  SEO_TITLE_SUFFIX,
  buildSeoTitle,
  normalizeSeoLead,
};
