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

const HTML_ENTITY_MAP = Object.freeze({
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '…',
  laquo: '«',
  ldquo: '“',
  lt: '<',
  lsquo: '‘',
  mdash: '—',
  nbsp: ' ',
  ndash: '–',
  quot: '"',
  raquo: '»',
  rdquo: '”',
  rsquo: '’',
});

/** Decode the small HTML entity surface that can appear in API rich text. */
function decodeHtmlEntities(text) {
  return text
    .replace(/&([a-z]+);/gi, (entity, name) => {
      const decoded = HTML_ENTITY_MAP[name.toLowerCase()];
      return typeof decoded === 'string' ? decoded : entity;
    })
    .replace(/&#(\d+);/g, (entity, decimal) => {
      const codePoint = Number.parseInt(decimal, 10);
      return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    })
    .replace(/&#x([\da-f]+);/gi, (entity, hexadecimal) => {
      const codePoint = Number.parseInt(hexadecimal, 16);
      return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    });
}

/**
 * Convert API/editorial HTML to plain SEO text without joining adjacent nodes.
 *
 * Tags become spaces instead of empty strings so `<p>One</p><p>Two</p>` and
 * adjacent inline fragments keep a readable boundary. Whitespace immediately
 * before punctuation is removed afterwards, preserving `word.</strong><strong>`
 * as `word. Next` rather than `word . Next`.
 */
function htmlToPlainText(html) {
  if (!html) return '';

  return decodeHtmlEntities(
    String(html)
      .replace(/<style\b[^>]*>[\s\S]*?(?:<\/style\s*>|$)/gi, ' ')
      .replace(/<script\b[^>]*>[\s\S]*?(?:<\/script\s*>|$)/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+([,.;:!?…)\]}\u00bb”’])/gu, '$1')
    .replace(/([([{«„“‘])\s+/gu, '$1')
    .replace(/([\p{L}\p{N}])\s*(['’/])\s*(?=[\p{L}\p{N}])/gu, '$1$2')
    .replace(/([\p{L}\p{N}][-‐‑])\s+(?=[\p{L}\p{N}])/gu, '$1')
    .replace(/([\p{L}\p{N}])\s+([-‐‑])(?=[\p{L}\p{N}])/gu, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

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

// Невидимые «распорки», которыми в редакторе разделяют абзацы: BRAILLE PATTERN
// BLANK, нулевой пробел, мягкий перенос. Для \s они не пробелы, поэтому доживают
// до content="" и тратят символы бюджета сниппета.
// U+FEFF в набор не входит: он попадает под \s и схлопывается в пробел ещё до
// разбора преамбулы, так что границей абзаца работать не может.
const INVISIBLE_SPACER_CLASS = '\\u00AD\\u200B\\u200C\\u2060\\u2800';
const INVISIBLE_SPACER_RE = new RegExp(`[${INVISIBLE_SPACER_CLASS}]`, 'gu');
// Внутрисловные невидимки (мягкий перенос, несоединитель, word joiner) удаляются
// БЕЗ подстановки пробела: «Ста\u00ADрый» — это «Старый», а не «Ста рый».
const INVISIBLE_JOINER_RE = /[\u00AD\u200C\u2060]/gu;
// Та же распорка как граница абзаца: всё до неё — подпись автора эпиграфа,
// всё после — текст статьи.
// Границей абзаца работают только распорки со смыслом пробела. Мягкий перенос
// U+00AD и U+200C стоят ВНУТРИ слова: приняв их за границу, срез оставил бы в
// сниппете обрубок («Ста\u00ADрый Свержень» → «рый Свержень»).
const PARAGRAPH_SPACER_CLASS = '\\u200B\\u2800';
const SPACER_CHAR_RE = new RegExp(`[${PARAGRAPH_SPACER_CLASS}]`, 'u');
const SPACER_OR_SPACE_RE = new RegExp(`[\\s${INVISIBLE_SPACER_CLASS}]`, 'u');
const PARAGRAPH_SPACER_OR_SPACE_RE = new RegExp(`[\\s${PARAGRAPH_SPACER_CLASS}]`, 'u');
// Разделители перед подписью автора: пробелы, пунктуация и те же невидимые
// распорки — в половине статей распорка стоит и до подписи, и после неё.
const LEADING_SEPARATOR_RE = new RegExp(`^[\\s,;:.\\u2014\\u2013\\-${INVISIBLE_SPACER_CLASS}]+`, 'u');

// Технический блок в начале статьи: «Координаты gps: 53.6006, 24.9567
// Расстояние от Минска: 173 км.» Ответ на запрос он не даёт, а половину сниппета
// съедает: у /travels/nesvizhskiy-zamok-radzivillov это все 516 показов без единого клика.
const LEADING_GEO_BLOCK_RE =
  /^(?:\s*(?:координаты(?:\s+gps)?|gps|широта|долгота)\s*:?\s*-?\d{1,3}[.,]\d+\s*(?:,\s*-?\d{1,3}[.,]\d+)?\s*\.?|\s*расстояние\s+от\s+\p{L}+\s*:?\s*\d+[\s\u00A0]*(?:км|km)(?!\p{L})\s*\.?)+/iu;

// Приветствие авторов вместо сути: «Привет! Мы — Юля и Сергей из metravel.by.»
// Терминатор после самого приветствия обязателен, иначе правило съело бы начало
// осмысленной фразы («Привет из Гродно! Сегодня…»).
const LEADING_GREETING_RE = /^(?:всем\s+)?(?:привет|здравствуйте|здравствуй|добрый\s+день|друзья)\s*[!.…]+\s*/iu;
// Представление следом за приветствием. Тире после «Мы» обязательно: это форма
// именно самопредставления. Точка внутри домена (metravel.by.) не обрывает
// предложение — границей считается «. » перед заглавной буквой.
const LEADING_SELF_INTRO_RE = /^(?:мы|я)\s*[—–]\s[\s\S]{0,140}?\.\s+(?=\p{Lu})/iu;

// Кавычки, которыми оформляют эпиграф. Пары фиксированы: закрывающая ищется
// только своя, иначе «„цитата"» и «"цитата"» смешались бы.
const QUOTE_PAIRS = Object.freeze([
  ['«', '»'],
  ['„', '“'],
  ['“', '”'],
  ['"', '"'],
]);

// Цитата такой длины — эпиграф даже без подписи автора: короткое название
// объекта в кавычках столько не занимает.
const EPIGRAPH_MIN_QUOTE_LENGTH = 60;
// Кавычки сами по себе эпиграфа не доказывают: «Мир» Замок Мир — резиденция…
// держит в кавычках имя объекта, и «Замок Мир» после него неотличимо от подписи
// автора — правило подписи съело бы имя объекта. Отделяем цитату от названия
// двумя признаками сразу: цитата это фраза (название редко длиннее двух слов) и
// подпись автора не повторяет слов цитаты, а «Замок Мир» повторяет.
const EPIGRAPH_MIN_QUOTE_WORDS = 3;
// Ниже этого порога срез считается съевшим лид: статья, целиком построенная на
// цитате, должна остаться с описанием, пусть и неидеальным.
const LEAD_MIN_LENGTH = 40;
// Частицы внутри имени автора: «Оноре де Бальзак», «Людвиг ван Бетховен».
const NAME_PARTICLES = new Set(['де', 'дю', 'да', 'ди', 'ла', 'ле', 'дель', 'ван', 'фон', 'van', 'von', 'de', 'la']);
// Цитата кончается как высказывание, а не как название объекта.
const SENTENCE_END_RE = /[.!?…][»"”'’)\s]*$/u;
const MAX_ATTRIBUTION_WORDS = 3;
// Длиннее — перед распоркой стоит уже текст, а не подпись автора.
const MAX_ATTRIBUTION_LENGTH = 60;

/** Похоже ли слово на часть имени автора эпиграфа. */
function isNameWord(word) {
  return /^\p{Lu}/u.test(word) || NAME_PARTICLES.has(word.toLowerCase());
}

/** Подпись автора: не больше трёх слов, каждое — часть имени. */
function looksLikeAttribution(value) {
  const words = value.trim().split(/\s+/u).filter(Boolean);
  return words.length > 0 && words.length <= MAX_ATTRIBUTION_WORDS && words.every(isNameWord);
}

/** Слов (пробельных токенов с буквой) в строке не меньше порога. */
function hasAtLeastWords(value, minimum) {
  let count = 0;
  for (const token of value.split(/\s+/u)) {
    if (!/\p{L}/u.test(token)) continue;
    count += 1;
    if (count >= minimum) return true;
  }
  return false;
}

/**
 * Повторяет ли кандидат в подпись слово из цитаты.
 *
 * Подпись автора и цитата — разные фразы, общих слов у них нет. А «Хатынь»
 * Мемориал Хатынь находится… повторяет имя объекта: это продолжение текста,
 * а не подпись. Слова короче трёх букв не считаем — предлоги и частицы
 * совпадают у любых двух фраз.
 */
function sharesWord(quoted, attribution) {
  const words = (value) => String(value).toLowerCase().match(/\p{L}{3,}/gu) || [];
  const fromQuote = new Set(words(quoted));
  return words(attribution).some((word) => fromQuote.has(word));
}

/**
 * Делит строку по первой невидимой распорке: слева — кандидат в подпись автора,
 * справа — текст статьи.
 *
 * Проход посимвольный, а не регуляркой: шаблон `[\s⠀]*[⠀][\s⠀]*` — вложенные
 * квантификаторы поверх пересекающихся классов, на длинном однородном прогоне
 * распорок такой шаблон откатывается квадратично, а атомарных групп в JS нет.
 */
function splitAtSpacer(head) {
  const spacer = head.search(SPACER_CHAR_RE);
  if (spacer < 0) return null;

  let attributionEnd = spacer;
  while (attributionEnd > 0 && /\s/u.test(head[attributionEnd - 1])) attributionEnd -= 1;
  if (attributionEnd > MAX_ATTRIBUTION_LENGTH) return null;

  let textStart = spacer;
  while (textStart < head.length && PARAGRAPH_SPACER_OR_SPACE_RE.test(head[textStart])) textStart += 1;

  return { attribution: head.slice(0, attributionEnd), text: head.slice(textStart) };
}

/**
 * Срезает подпись автора после эпиграфа: «…» Пётр Квятковский Попав на усадьбу…
 *
 * Точной границы у подписи нет: и «Квятковский», и следующее за ним «Попав»
 * начинаются с заглавной. Поэтому сначала ищем невидимую распорку — в редакторе
 * ею отделён абзац эпиграфа, и она доживает до текста («Николай Горин ⠀ ⠀Усадьба
 * Бохвицей»). Без распорки берём самый длинный вариант подписи, после которого
 * остаток всё ещё начинается как предложение: у «Сенека Третья и заключительная»
 * это одно слово, потому что «и заключительная» предложением не начинается.
 */
function stripLeadingAttribution(rest) {
  const head = rest.replace(LEADING_SEPARATOR_RE, '');

  const marked = splitAtSpacer(head);
  if (marked && looksLikeAttribution(marked.attribution)) return marked.text;

  // Без распорки подпись не угадывается: русский лид сплошь и рядом открывается
  // двумя словами с заглавной — «Усадьба Павлиново», «Старый Свержень»,
  // «Заславский Спасо-Преображенский». По форме это неотличимо от «Пётр
  // Квятковский», и любая эвристика съедала бы слова текста. Оставляем подпись
  // в сниппете: лишнее имя автора читается хуже, но смысл не теряется.
  return rest;
}

/**
 * Конец цитаты с учётом вложенности той же пары кавычек.
 *
 * `indexOf` брал первую закрывающую и обрывался на вложенной цитате:
 * «Духовная жизнь начинается, когда положение кажется «безвыходным», тогда…» —
 * граница уезжала внутрь эпиграфа, и его вторая половина уходила в сниппет.
 * Для одинаковых открывающей и закрывающей («"») вложенность неразличима,
 * поэтому там остаётся первое вхождение.
 */
function findQuoteEnd(text, [open, close]) {
  if (open === close) return text.indexOf(close, open.length);

  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text.startsWith(open, i)) depth += 1;
    else if (text.startsWith(close, i)) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Срезает ведущий эпиграф — чужую цитату перед рассказом о месте.
 *
 * Кавычки сами по себе признаком не являются: «Родники Святые Криницы» —
 * гидрологический памятник… держит в кавычках название объекта, и фраза
 * продолжается с маленькой буквы. Эпиграфом считаем фразу от
 * EPIGRAPH_MIN_QUOTE_WORDS слов, за которой идёт подпись автора, не повторяющая
 * слов самой цитаты, либо такую же фразу длиннее EPIGRAPH_MIN_QUOTE_LENGTH.
 */
function stripLeadingEpigraph(text) {
  const pair = QUOTE_PAIRS.find(([open]) => text.startsWith(open));
  if (!pair) return text;

  const closeIndex = findQuoteEnd(text, pair);
  if (closeIndex < 0) return text;

  const quoted = text.slice(pair[0].length, closeIndex);
  if (!hasAtLeastWords(quoted, EPIGRAPH_MIN_QUOTE_WORDS)) return text;

  const rest = text.slice(closeIndex + pair[1].length);
  // Фраза продолжается — значит кавычки держали её часть, а не отдельный эпиграф:
  // «Родники Святые Криницы» — гидрологический памятник…
  if (/^\s*[,;:]/u.test(rest) || /^\s*[—–-]?\s*\p{Ll}/u.test(rest)) return text;

  const withoutAuthor = stripLeadingAttribution(rest);
  const attribution = rest.slice(0, rest.length - withoutAuthor.length);
  const hasAuthor = withoutAuthor !== rest && !sharesWord(quoted, attribution);
  // Цитата, законченная точкой или восклицанием, — высказывание, а не название:
  // «Спасо-Преображенская церковь в Заславле» так не заканчивается.
  const isSentence = SENTENCE_END_RE.test(quoted);
  if (!hasAuthor && !isSentence && quoted.length < EPIGRAPH_MIN_QUOTE_LENGTH) return text;

  return (hasAuthor ? withoutAuthor : rest).replace(/^\s+/u, '');
}

/**
 * Хватает ли видимой длины: распорки невидимы, но считаются символами, иначе
 * порог LEAD_MIN_LENGTH проходил бы остаток из пары слов и десятка распорок.
 * Считаем с ранним выходом — на входе полное тело статьи, пересобирать его
 * целиком ради сравнения с сорока символами незачем.
 */
function hasVisibleLength(value, minimum) {
  let count = 0;
  let previousWasSpace = true;
  for (const char of value) {
    const isBlank = SPACER_OR_SPACE_RE.test(char);
    if (isBlank && previousWasSpace) continue;
    count += 1;
    if (count >= minimum) return true;
    previousWasSpace = isBlank;
  }
  return false;
}

/**
 * Срезает приветствие авторов и следующее за ним представление.
 *
 * Представление снимается ТОЛЬКО после приветствия: «Мы — семья из Минска, и вот
 * наш маршрут по Полесью» без «Привет!» — это уже содержательная фраза, а не
 * расшаркивание, и терять её нельзя.
 */
function stripLeadingGreeting(text) {
  const withoutGreeting = text.replace(LEADING_GREETING_RE, '');
  if (withoutGreeting === text) return text;
  return withoutGreeting.replace(LEADING_SELF_INTRO_RE, '');
}

/** Один проход по преамбулам. Каждый срез отменяется, если он съедает лид. */
function stripLeadingPreamble(text) {
  const steps = [
    (value) => value.replace(LEADING_GEO_BLOCK_RE, ''),
    stripLeadingEpigraph,
    stripLeadingGreeting,
  ];

  let lead = text;
  for (const step of steps) {
    const next = step(lead).trim();
    if (next !== lead && hasVisibleLength(next, LEAD_MIN_LENGTH)) lead = next;
  }
  return lead;
}

/**
 * Чистит лид статьи перед сборкой meta description: убирает декоративные
 * пиктограммы, невидимые распорки, служебную строку маршрута и непояснительную
 * преамбулу (координатный блок, эпиграф, приветствие авторов), чтобы сниппет
 * начинался с сути. Текст самой статьи при этом не меняется — правится только
 * то, что уходит в выдачу.
 */
function normalizeSeoLead(text) {
  const plain = String(text == null ? '' : text);
  if (!plain) return '';

  // Невидимые распорки снимаем ПОСЛЕ преамбулы: до этого они единственная
  // надёжная граница между подписью автора эпиграфа и текстом статьи.
  const cleaned = plain
    .replace(DECORATIVE_PICTOGRAPH_RE, ' ')
    // Схлопывание идёт ПЕРЕД правилом «пробел перед знаком»: на длинном прогоне
    // пробелов `\s+([,.;:!?])` квадратичен, а прогон приезжает и из статьи, и из
    // распорок, которые ниже станут пробелами (50k распорок = 4,4 с на вызов).
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();

  const withoutRoute = cleaned.replace(LEADING_ROUTE_LINE_RE, '') || cleaned;

  return stripLeadingPreamble(withoutRoute)
    .replace(INVISIBLE_JOINER_RE, '')
    .replace(INVISIBLE_SPACER_RE, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/^[\s,;:.–—-]+/u, '')
    .trim();
}

module.exports = {
  SEO_TITLE_MAX_LENGTH,
  SEO_TITLE_SUFFIX,
  buildSeoTitle,
  htmlToPlainText,
  normalizeSeoLead,
};
