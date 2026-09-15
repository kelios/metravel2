/* global module */

// Разбор и безопасный отбор авторского текста квеста. Модуль общий для SSG
// (`scripts/generate-seo-pages.js`) и приложения (`utils/questCityWalk.js` →
// экран `/quests/<город>`): и статическая страница, и рантайм публикуют
// предложения из `story`, поэтому правило «что можно показать до прохождения»
// обязано быть одно. Две копии этого фильтра означали бы, что задание или
// ответ утекают ровно на той поверхности, где копию забыли обновить.

function parseQuestJsonField(value, fallback) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getQuestSteps(bundle) {
  const parsed = parseQuestJsonField(bundle?.steps, []);
  return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
}

function getQuestIntro(bundle) {
  const parsed = parseQuestJsonField(bundle?.intro, null);
  return parsed && typeof parsed === 'object' ? parsed : null;
}

// ---------------------------------------------------------------------------
// Безопасный пересказ маршрута для SSG-среза (#1763)
// ---------------------------------------------------------------------------

/**
 * Сколько авторского текста точки уходит в статический HTML.
 *
 * Замер по всем 165 квестам прода (04.09.2026): 1 предложение на точку даёт
 * 133 слова уникального текста на квест, 2 — 297, 3 — 450, весь отфильтрованный
 * `story` — 968. При сегодняшних 104–291 слове вне общего шаблона лимит в два
 * предложения лечит тонкость среза и оставляет страницу анонсом маршрута, а не
 * полной публикацией контента квеста (корпус `story` целиком — 221 285 слов).
 * Лимит по словам страхует случай, когда два предложения оказались абзацем.
 */
const QUEST_DIGEST_MAX_SENTENCES = 2;
const QUEST_DIGEST_MAX_WORDS = 60;

/**
 * Приметы предложения, обращённого к игроку.
 *
 * Отбор идёт по предложениям, а не по абзацам: гипотеза «первый абзац `story`
 * описывает объект, наводки идут дальше» на корпусе НЕ подтвердилась —
 * обращение к игроку встречается в первом абзаце даже чаще, чем в последующих
 * (506/1601 = 31,6% против 853/3460 = 24,7%). Абзац как единица публикации
 * протаскивал бы наводки на трети точек.
 */
const QUEST_PLAYER_ADDRESSED_RE = new RegExp(
  '(?:^|[^а-яёa-z])(?:' +
    'остановись|найди|отыщи|обрати|посмотри|подойди|встань|пройди|поверни|загляни|' +
    'сосчитай|посчитай|прочитай|вглядись|оглядись|присмотрись|запомни|дойди|сверни|' +
    'поднимись|спустись|ищи|смотри|обойди|двигайся|иди|идём|идем|дай|' +
    'ты|тебя|тебе|тобой|твой|твоя|твои|твоё|твое|твоего|твоей' +
  ')(?:[^а-яёa-z]|$)',
  'i',
);

/**
 * Служебные формулы, которыми открываются точки «по желанию».
 *
 * Одна и та же фраза стоит у 49 точек в 40 квестах, а настоящее описание места
 * («Изысканная польская кухня прямо на Главном рынке…») идёт следующим абзацем.
 * Без этого фильтра лимит в два предложения съедал бы ровно шаблон, и 40
 * страниц несли бы одинаковый текст вместо своего.
 */
// `\b` в JS считает границей только латиницу и цифры, поэтому после кириллицы
// он не срабатывает вовсе — конец слова проверяем явным «дальше не буква».
const QUEST_BOILERPLATE_RE = /^(?:необязательн(?:ая|ое|ый)|рядом с маршрутом есть место|лучшие открытия в путешествии)(?![а-яё])/i;

/**
 * Сокращения, после которых точка не закрывает предложение.
 *
 * Список, а не общее правило: у точки после сокращения и точки в конце фразы
 * нет различимой приметы, кроме самого слова, — поэтому новое сокращение
 * добавляется строкой сюда, а не переписыванием разбора. Состав проверен по
 * прод-каталогу 15.09.2026: реально режут «ул.» (10 адресов музеев), «им.» (3),
 * «пр.» (2), «н. э.» (2), «пл.» (1); остальные внесены на будущий текст.
 *
 * «им» здесь — осознанный размен, а не недосмотр: это ещё и местоимение, и
 * «построен им. Позже его снесли» склеится в одну фразу. В каталоге таких
 * концовок нет, а «музея им. Чюрлёниса» есть трижды, и цена ошибки разная —
 * склеенная пара читается как прежде (фразы всё равно соединяются пробелом),
 * а обрывок «Чюрлёниса.» уходит на сайт началом заметки.
 */
const QUEST_SENTENCE_ABBREVIATIONS = new Set([
  'ул', 'пл', 'пр', 'просп', 'пер', 'наб', 'д', 'корп', 'стр', 'кв',
  'г', 'гг', 'в', 'вв', 'н', 'э', 'им', 'оз', 'р', 'ок', 'тыс', 'млн', 'млрд',
]);

/** Последний токен сегмента как «слово.»: скобки и кавычки не мешают сверке. */
const QUEST_TRAILING_WORD_RE = /(?:^|[^\p{L}\p{N}])([\p{L}]{1,5})\.$/u;

/** Инициал: одна заглавная и необязательная строчная — «В.», «Св.», «Дж.». */
const QUEST_TRAILING_INITIAL_RE = /(?:^|[^\p{L}\p{N}])(\p{Lu})\p{Ll}?\.$/u;

/**
 * Число перед сокращением: «1905 г.», «XV в.» — мера относится к числу и точка
 * после неё предложение ЗАКРЫВАЕТ, в отличие от «г. Минск» и «ул. Ленина».
 * Римские цифры только заглавными: строчная «в» — предлог, а не пятёрка.
 */
const QUEST_NUMERIC_TOKEN_RE = /^[\p{N}IVXLCDM]+$/u;

/**
 * Кириллица как БЛОК, а не русский алфавит: в каталоге уже есть «і», «ў», «қ»,
 * «ј». Возьми `[а-яё]`, и белорусский инициал («І. Луцкевіч») окажется в другом
 * алфавите, чем фамилия за ним, — разбор снова вернёт кусок с середины мысли,
 * ровно тот дефект, ради которого сверка алфавитов и написана.
 */
const QUEST_CYRILLIC_LETTER_RE = /[\u0400-\u052F]/;

/** Пауза автора: многоточие одним знаком или тремя точками. */
const QUEST_AUTHOR_PAUSE_RE = /(?:…|\.\.\.)$/;

/**
 * Настоящая ли это граница предложения между двумя кусками разбора.
 *
 * Замер по прод-каталогу 15.09.2026 (182 квеста, 13 095 кусков): точка как
 * граница врёт в трёх случаях — пауза автора многоточием («кинотеатр «Победа»
 * сыграл... кинотеатр», 20 мест), сокращение («Адрес: ул. Ленина», 18) и
 * инициал («скульпторы В. Андрющенко», 27). Во всех трёх опубликованный кусок
 * начинался с середины мысли.
 */
function isQuestSentenceBoundary(before, after) {
  // Многоточие, за которым идёт строчная буква, — пауза автора внутри фразы
  // («сыграл... кинотеатр»), а не конец мысли: предложение со строчной буквы не
  // начинается. Правило намеренно спрашивает и про многоточие тоже: «склеивать
  // всё, что продолжается строчной» схлопнуло бы в один кусок любой текст без
  // заглавных начал, и город остался бы вовсе без заметок.
  if (QUEST_AUTHOR_PAUSE_RE.test(before) && /^\p{Ll}/u.test(after)) return false;

  const initial = before.match(QUEST_TRAILING_INITIAL_RE);
  if (initial) {
    // Алфавит сверяется с первой буквой следующего куска: одинокая ЛАТИНСКАЯ
    // заглавная в русском тексте — это римская цифра или форма буквы («короля
    // Людвига I. Образец…», «в форме буквы X. Этот знак…»), а не имя. Латинский
    // инициал остаётся инициалом только перед латинской фамилией («I. M. Pei»,
    // «улица V. Putvinskio») — на корпусе правило не ошибается ни разу.
    const nextLetter = after.match(/\p{L}/u);
    if (nextLetter
      && QUEST_CYRILLIC_LETTER_RE.test(initial[1]) === QUEST_CYRILLIC_LETTER_RE.test(nextLetter[0])) {
      return false;
    }
  }

  const word = before.match(QUEST_TRAILING_WORD_RE);
  if (word && QUEST_SENTENCE_ABBREVIATIONS.has(word[1].toLowerCase())) {
    const tokens = before.split(' ');
    const previous = (tokens[tokens.length - 2] || '').replace(/[^\p{L}\p{N}]/gu, '');
    if (!QUEST_NUMERIC_TOKEN_RE.test(previous)) return false;
  }

  return true;
}

/** Разбор описания точки на предложения; абзацы схлопываются в общий поток. */
function splitQuestStorySentences(text) {
  const sentences = [];
  for (const piece of String(text || '').replace(/\s+/g, ' ').split(/(?<=[.!?…])\s+/)) {
    const part = piece.trim();
    if (!part) continue;
    const previous = sentences[sentences.length - 1];
    if (previous !== undefined && !isQuestSentenceBoundary(previous, part)) {
      sentences[sentences.length - 1] = `${previous} ${part}`;
      continue;
    }
    sentences.push(part);
  }
  return sentences;
}

/**
 * Конкретные ответы, которые нельзя раскрывать.
 *
 * `any`, `any_text` и `any_number` конкретного ответа не задают — раскрывать у
 * них нечего. У `range` спойлер — любое число диапазона, а не только границы.
 */
function questAnswerLiterals(answerPattern) {
  const pattern = parseQuestJsonField(answerPattern, null);
  if (!pattern || typeof pattern !== 'object') return [];
  const value = parseQuestJsonField(pattern.value, pattern.value);

  if (pattern.type === 'exact_any') {
    return Array.isArray(value) ? value.map((item) => String(item)) : [];
  }
  if (pattern.type === 'exact') {
    return value === null || value === undefined || value === '' ? [] : [String(value)];
  }
  if (pattern.type === 'range' && value && typeof value === 'object') {
    const min = Number(value.min);
    const max = Number(value.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return [];
    // Диапазон шире сотни — не ответ, а мера; перечислять его бессмысленно.
    if (max - min > 100) return [];
    const literals = [];
    for (let n = min; n <= max; n++) literals.push(String(n));
    return literals;
  }
  return [];
}

/** Нормализация для сверки: регистр, ё/е и пунктуация не должны прятать совпадение. */
function normalizeQuestText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Содержит ли текст ответ целиком (все слова ответа как отдельные токены).
 *
 * Сверка идёт по токенам, а не подстрокой, как в `scan-quest-hint-leak.js`, и
 * это не рассинхрон, а разная цена ошибки: у скана есть baseline и редактор,
 * который разбирает находку, а здесь совпадение молча выбрасывает предложение
 * из публикации. Подстрочное правило на корпусе даёт 4 совпадения, и 3 из них —
 * внутри чужого слова («кот» в «который», «три» в «смотрители», «лев» в
 * «уцелевшие»), то есть три выброшенных описания на ровном месте.
 */
function questTextRevealsAnswer(text, answerLiterals) {
  const tokens = new Set(normalizeQuestText(text).split(' ').filter(Boolean));
  if (!tokens.size) return false;
  return answerLiterals.some((literal) => {
    const words = normalizeQuestText(literal).split(' ').filter(Boolean);
    return words.length > 0 && words.every((word) => tokens.has(word));
  });
}

/**
 * Описание точки для статического HTML: подмножество авторского `story`.
 *
 * Новый текст не сочиняется — берутся только те предложения, что не обращены к
 * игроку и не содержат ответа. На корпусе фильтр снимает 1 732 предложения из
 * 11 164 (16%) и 17 предложений с дословным ответом, не оставляя без текста ни
 * одной из 1 436 точек.
 */
function selectQuestSafeSentences(story, answerLiterals, options = {}) {
  const maxSentences = options.maxSentences ?? QUEST_DIGEST_MAX_SENTENCES;
  const maxWords = options.maxWords ?? QUEST_DIGEST_MAX_WORDS;
  const kept = [];
  let words = 0;

  for (const sentence of splitQuestStorySentences(story)) {
    if (kept.length >= maxSentences) break;
    if (QUEST_BOILERPLATE_RE.test(sentence)) continue;
    if (QUEST_PLAYER_ADDRESSED_RE.test(sentence)) continue;
    if (questTextRevealsAnswer(sentence, answerLiterals)) continue;
    const sentenceWords = sentence.split(/\s+/).filter(Boolean).length;
    // Обрыв только по границе предложения: половина фразы в HTML хуже, чем её
    // отсутствие. Первое предложение берём даже если оно длиннее лимита —
    // иначе точка с одним длинным предложением осталась бы без описания.
    if (kept.length > 0 && words + sentenceWords > maxWords) break;
    kept.push(sentence);
    words += sentenceWords;
  }

  return kept;
}

/** Практическая справка о точке: только заполненные поля, без пустых подписей. */
function buildQuestPointFacts(poiInfo) {
  const poi = parseQuestJsonField(poiInfo, null);
  if (!poi || typeof poi !== 'object') return [];
  const facts = [];
  const hours = String(poi.opening_hours || poi.openingHours || '').trim();
  const price = String(poi.ticket_price || poi.ticketPrice || '').trim();
  if (hours) facts.push(`Часы работы: ${hours}`);
  if (price) facts.push(`Билет: ${price}`);
  return facts;
}

/**
 * Название точки без хвоста, который выдаёт ответ.
 *
 * Названия сделаны по образцу «Объект — деталь», и деталь порой и есть ответ
 * («Памятник Тысячелетия — ангел над городом» при ответе «ангел»). На корпусе
 * ответ попадает в название у 15 точек; обрезка по тире лечит 9 из них,
 * сохраняя идентификацию объекта. Оставшиеся 6 — те, где ответ и есть имя
 * объекта («Прикуривающий»): там обрезать нечего, и это разбирает редактор по
 * предупреждению сборки, а не код.
 */
function trimQuestPointTitle(title, answerLiterals) {
  const full = String(title || '').trim();
  if (!full || !answerLiterals.length) return full;
  const head = full.split(/\s+[—–-]\s+/)[0].trim();
  if (!head || head === full) return full;
  if (!questTextRevealsAnswer(full, answerLiterals)) return full;
  return questTextRevealsAnswer(head, answerLiterals) ? full : head;
}

/**
 * Ключ точки, общий для модели и сверки.
 *
 * Оба места обязаны считать его из СЫРЫХ полей шага. Возьми модель обрезанное
 * название, а сверка — исходное, и ключи разойдутся ровно на той точке, ради
 * которой обрезка и сделана: сверка не найдёт опубликованное описание и молча
 * пропустит проверку ответа. Порядковый номер как запасной ключ ещё и уникален —
 * два одноимённых объекта без `step_id` не схлопнутся в одну запись.
 */
function questPointId(step, index) {
  const explicit = String(step?.step_id || step?.id || '').trim();
  return explicit || `точка ${index + 1}`;
}

module.exports = {
  QUEST_DIGEST_MAX_SENTENCES,
  QUEST_DIGEST_MAX_WORDS,
  QUEST_PLAYER_ADDRESSED_RE,
  QUEST_BOILERPLATE_RE,
  parseQuestJsonField,
  getQuestSteps,
  getQuestIntro,
  splitQuestStorySentences,
  questAnswerLiterals,
  normalizeQuestText,
  questTextRevealsAnswer,
  selectQuestSafeSentences,
  buildQuestPointFacts,
  trimQuestPointTitle,
  questPointId,
};
