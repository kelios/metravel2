/* global module, require */

// Собственное содержание посадочной города `/quests/<alias>`: что именно можно
// увидеть в этом городе на прогулке. Модель считается из бандлов квестов города
// и общего каталога, поэтому SSG (`scripts/generate-seo-pages.js`) и экран
// приложения (`app/(tabs)/quests/[city]/index.tsx`) публикуют один и тот же
// текст. Разные модели здесь означали бы, что краулер видит не то, что человек.
//
// #1569: до этой модели страница города несла 118–182 слова общего шаблона с
// подставленным названием (замер по проду 14.09.2026, own wording 0%), то есть
// ничего сверх карточки единственного дочернего квеста.

const {
  getQuestIntro,
  getQuestSteps,
  parseQuestJsonField,
  questAnswerLiterals,
  questTextRevealsAnswer,
  selectQuestSafeSentences,
  trimQuestPointTitle,
} = require('./questStoryText');

/**
 * Сколько квестов города разбирается по точкам.
 *
 * Лимит один и для сборки, и для рантайма: приложение тянет ровно эти бандлы
 * отдельными запросами, а статическая страница обязана показать тот же набор.
 * Подними его только вместе с ценой запросов на экране города.
 */
const QUEST_CITY_WALK_QUEST_LIMIT = 3;
/** Сколько мест получают собственный абзац; остальные идут перечислением. */
const QUEST_CITY_WALK_PLACE_LIMIT = 10;
/** Сколько предложений публикуется об одном месте. */
const QUEST_CITY_WALK_SENTENCE_LIMIT = 2;

/**
 * Предложения, обращённые к идущему, которых нет в общем фильтре дайджеста.
 *
 * Дайджест детальной страницы (#1763) отбирает ГОЛОВУ рассказа, где автор ещё
 * представляет объект. Посадочная города публикует ХВОСТ, а там плотность
 * инструкций выше: на корпусе прода 15.09.2026 из 7 746 хвостовых предложений
 * 507 (6,5%) обращены к игроку формой, которую общий фильтр не ловит —
 * «Пересчитай его буквы», «Разгляди, в какой позе застыл художник». На странице
 * города такое предложение читается как задание и раскрывает механику точки,
 * поэтому фильтр здесь строже. Общий фильтр не расширяется: он решает другую
 * задачу на другой поверхности, и его порог объёма уже принят отдельной
 * карточкой.
 */
const QUEST_WALK_IMPERATIVES = [
  'постой', 'подними', 'приглядись', 'рассмотри', 'назови', 'разгляди', 'зайди',
  'отойди', 'осмотрись', 'пройдись', 'вспомни', 'отметься', 'помни', 'пересчитай',
  'подсчитай', 'замри', 'закрой', 'послушай', 'прислушайся', 'проверь', 'сравни',
  'потрогай', 'погляди', 'всмотрись', 'шагай', 'продолжай', 'возьми', 'попробуй',
  'угадай', 'реши', 'ответь', 'введи', 'запиши', 'начни', 'вдохни', 'представь',
  'обернись', 'посети', 'выбери', 'поставь', 'отсчитай', 'сверься', 'заметь',
  'отметь', 'сядь', 'присядь', 'считай', 'взгляни', 'глянь', 'держись', 'позови',
  'поищи', 'прочти', 'дотронься', 'коснись', 'задержись', 'прогуляйся', 'убедись',
  'сфотографируй', 'загадай',
];

/**
 * Короткая фраза не описывает место, а осталась от разбора на предложения:
 * «Адрес: ул.» — это обрыв на сокращении, «История у них такая.» — связка
 * перед абзацем, которого здесь уже не будет. Порог тот же, по которому сверка
 * спойлеров (#1763) не считает фразу значимой.
 */
const QUEST_CITY_WALK_MIN_SENTENCE_WORDS = 6;

// `\b` в JS не работает с кириллицей, поэтому границы слова задаются явно.
const QUEST_WALK_IMPERATIVE_RE = new RegExp(
  `(?:^|[^а-яёa-z])(?:${QUEST_WALK_IMPERATIVES.join('|')})(?:[^а-яёa-z]|$)`,
  'i',
);

/**
 * Глагол второго лица единственного числа: «увидишь», «переходишь».
 *
 * Такое предложение либо ведёт игрока, либо пересказывает его путь — на
 * странице «что тут интересного» оно не к месту. Существительные на «-ишь»
 * («тишь») под правило тоже попадают; цена ошибки — одно снятое предложение,
 * поэтому правило остаётся простым.
 */
const QUEST_WALK_SECOND_PERSON_RE = /[а-яё](?:е|ё|и)шь(?:ся)?(?:[^а-яёa-z]|$)/i;

/** Вопрос в рассказе — это почти всегда само задание точки. */
const QUEST_WALK_QUESTION_RE = /\?\s*["»)]?\s*$/;

function isQuestWalkSentence(sentence) {
  const text = String(sentence || '').trim();
  if (!text) return false;
  if (text.split(/\s+/).filter(Boolean).length < QUEST_CITY_WALK_MIN_SENTENCE_WORDS) return false;
  if (QUEST_WALK_QUESTION_RE.test(text)) return false;
  if (QUEST_WALK_IMPERATIVE_RE.test(text)) return false;
  return !QUEST_WALK_SECOND_PERSON_RE.test(text);
}

/**
 * Название точки как имя места, а не как строка маршрута.
 *
 * В квесте точки пронумерованы («7. Банк, где хранят любовь») и иногда
 * начинаются со значка («☕ Портофино»): это порядок прохождения и подсказка
 * карточки шага. На странице города порядок чужой — здесь перечислены места, а
 * не шаги, — поэтому номер и значок снимаются.
 */
function questWalkPlaceTitle(title) {
  return String(title || '')
    .trim()
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/^\d{1,2}\s*[.)]\s*/, '')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .trim();
}

/** `quest_id` каталога и `id` адаптированного квеста — одно и то же поле. */
function questWalkKey(quest) {
  return String(quest?.quest_id ?? quest?.id ?? '').trim();
}

function questWalkNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
}

function bundleFor(bundles, questId) {
  if (!questId) return null;
  if (bundles instanceof Map) return bundles.get(questId) || null;
  if (bundles && typeof bundles === 'object') return bundles[questId] || null;
  return null;
}

/**
 * Хвост авторского рассказа о точке — то, чего нет на странице квеста.
 *
 * Детальная страница публикует первые предложения (`selectQuestSafeSentences`
 * со своими лимитами), поэтому пересечение двух страниц здесь нулевое по
 * построению, а не по совпадению: город берёт ровно то, что дайджест оставил.
 */
function questPointWalkSentences(step, sentenceLimit, questAnswerLiteralsAll) {
  const answerLiterals = questAnswerLiterals(step?.answer_pattern);
  const all = selectQuestSafeSentences(step?.story, answerLiterals, {
    maxSentences: Number.MAX_SAFE_INTEGER,
    maxWords: Number.MAX_SAFE_INTEGER,
  });
  const publishedOnQuestPage = selectQuestSafeSentences(step?.story, answerLiterals);
  return all
    .slice(publishedOnQuestPage.length)
    .filter(isQuestWalkSentence)
    // Общий отбор снимает ответ САМОЙ точки — на карточке шага чужой ответ
    // игроку и не показывают. Здесь страница читается до выхода и целиком, так
    // что ответ соседней точки раскрыт так же, как свой: на корпусе прода
    // 15.09.2026 это 64 предложения из 2 183.
    .filter((sentence) => !questTextRevealsAnswer(sentence, questAnswerLiteralsAll))
    .slice(0, sentenceLimit);
}

function questPointPoi(step) {
  const poi = parseQuestJsonField(step?.poi_info, null);
  if (!poi || typeof poi !== 'object') return { isMuseum: false, openingHours: '', ticketPrice: '' };
  return {
    isMuseum: Boolean(poi.is_museum ?? poi.isMuseum),
    openingHours: String(poi.opening_hours || poi.openingHours || '').trim(),
    ticketPrice: String(poi.ticket_price || poi.ticketPrice || '').trim(),
  };
}

/**
 * Квесты города, которые разбираются по точкам, — общий ответ для сборки и
 * приложения.
 *
 * Приложение тянет ровно эти бандлы, сборка ровно из них собирает статический
 * текст. Считай приложение выбор по-своему — человек после гидратации получил
 * бы заметки о других местах, чем краулер, то есть разный контент по одному
 * адресу. Порядок каталога для этого не годится: он зависит от сортировки
 * ответа API.
 */
function questCityWalkQuestIds(quests, options = {}) {
  const questLimit = options.questLimit ?? QUEST_CITY_WALK_QUEST_LIMIT;
  return (Array.isArray(quests) ? quests : [])
    .map(questWalkKey)
    .filter(Boolean)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, questLimit);
}

/**
 * Сколько из разбираемых квестов города пришли с бандлом.
 *
 * Сравнение с числом разбираемых квестов (`questCityWalkQuestIds`) отличает
 * транспортную ошибку — `by-quest-id` не ответил хотя бы за один квест
 * города — от города, чьи истории точек короче дайджеста детальной
 * страницы и хвоста для заметок не оставляют (партия 19.09.2026: 15 городов по
 * 1–2 предложения на точку). Первое обязано ронять сборку, второе — только
 * снимать посадочную с индекса: страница собрана без ошибок, ей просто нечего
 * публиковать сверх карточки квеста. `places` пусты в обоих случаях, поэтому
 * граница держится отдельным счётчиком.
 */
function questCityWalkBundleCount(quests, bundles, options = {}) {
  return questCityWalkQuestIds(quests, options)
    .filter((questId) => Boolean(bundleFor(bundles, questId)))
    .length;
}

/**
 * Модель блока «что увидите по дороге» для одного города.
 *
 * `quests` — квесты города в любом из двух видов каталога (сырой `ApiQuestMeta`
 * из сборки или адаптированный `QuestMeta` из приложения), `bundles` — карта
 * `quest_id → бандл`. Квесты без бандла в модель не попадают: выдумывать текст
 * за отсутствующие данные нельзя, а пустая модель — это сигнал сборке падать
 * (`assertQuestCityLandingBundlesResolved`) или снимать посадочную с выдачи
 * (`selectIndexableQuestCityLandings`) — границу между этими случаями держит
 * `questCityWalkBundleCount`.
 */
function buildQuestCityWalkModel(quests, bundles, options = {}) {
  const placeLimit = options.placeLimit ?? QUEST_CITY_WALK_PLACE_LIMIT;
  const sentenceLimit = options.sentenceLimit ?? QUEST_CITY_WALK_SENTENCE_LIMIT;

  const byQuestId = new Map(
    (Array.isArray(quests) ? quests : [])
      .filter((quest) => questWalkKey(quest))
      .map((quest) => [questWalkKey(quest), quest]),
  );
  const selected = questCityWalkQuestIds(quests, options)
    .map((questId) => byQuestId.get(questId))
    .filter(Boolean);

  const places = [];
  const otherPlaces = [];
  const routes = [];
  const publishedSentences = new Set();

  for (const quest of selected) {
    const questId = questWalkKey(quest);
    const bundle = bundleFor(bundles, questId);
    if (!bundle) continue;

    const steps = getQuestSteps(bundle);
    if (!steps.length) continue;

    const questTitle = String(quest?.title || bundle?.title || '').trim();
    const questAnswers = steps.flatMap((item) => questAnswerLiterals(item?.answer_pattern));
    let optionalCount = 0;
    let museumCount = 0;

    const questPlaces = [];
    for (const [index, step] of steps.entries()) {
      if (!step || typeof step !== 'object') continue;
      if (step.point_role === 'optional' || step.pointRole === 'optional') optionalCount += 1;

      const poi = questPointPoi(step);
      if (poi.isMuseum) museumCount += 1;

      const answerLiterals = questAnswerLiterals(step.answer_pattern);
      const title = questWalkPlaceTitle(trimQuestPointTitle(step.title, answerLiterals));
      const location = questWalkPlaceTitle(trimQuestPointTitle(step.location, answerLiterals));
      if (!title && !location) continue;

      questPlaces.push({
        questId,
        questTitle,
        pointIndex: index,
        title: title || location,
        location: location && location !== title ? location : '',
        sentences: questPointWalkSentences(step, sentenceLimit, questAnswers),
        openingHours: poi.openingHours,
        ticketPrice: poi.ticketPrice,
      });
    }

    // Название, повторяющееся у нескольких точек одного квеста, — это не место,
    // а заглушка: квест «Афиша, с которой убежали герои» (Гомель) намеренно
    // прячет объекты за «1. Герой», «2. Герой». Списком таких строк страница
    // города ничего не сообщает, а заметки к ним — это сам текст загадки.
    const titleUses = new Map();
    for (const place of questPlaces) {
      titleUses.set(place.title, (titleUses.get(place.title) || 0) + 1);
    }

    for (const place of questPlaces) {
      if (titleUses.get(place.title) > 1) continue;
      // Точки-привалы описаны одной и той же авторской фразой («Можно выпить
      // кофе, перевести дух и идти дальше»), и в Гомеле таких точек две. Второй
      // раз эта фраза не сообщает ничего — место уходит в перечисление.
      const sentences = place.sentences.filter((sentence) => !publishedSentences.has(sentence));
      if (sentences.length === 0) {
        otherPlaces.push(place.title);
        continue;
      }
      for (const sentence of sentences) publishedSentences.add(sentence);
      places.push({ ...place, sentences });
    }

    const intro = getQuestIntro(bundle);
    const lastStep = steps[steps.length - 1];
    routes.push({
      questId,
      title: questTitle,
      pointCount: questWalkNumber(quest?.points, steps.length),
      optionalCount,
      museumCount,
      durationMin: questWalkNumber(quest?.duration_min, quest?.durationMin, bundle?.duration_min),
      difficulty: String(quest?.difficulty || '').trim(),
      petFriendly: Boolean(quest?.pet_friendly ?? quest?.petFriendly),
      startLocation: String(intro?.location || steps[0]?.location || '').trim(),
      finishLocation: String(lastStep?.location || lastStep?.title || '').trim(),
    });
  }

  const published = places.slice(0, placeLimit);
  const rest = [
    ...places.slice(placeLimit).map((place) => place.title),
    ...otherPlaces,
  ].filter(Boolean);

  return { places: published, otherPlaces: rest, routes };
}

/** Есть ли у города собственный текст сверх шаблона. */
function questCityWalkHasContent(walk) {
  return Boolean(walk && Array.isArray(walk.places) && walk.places.length > 0);
}

module.exports = {
  QUEST_CITY_WALK_QUEST_LIMIT,
  QUEST_CITY_WALK_PLACE_LIMIT,
  QUEST_CITY_WALK_SENTENCE_LIMIT,
  buildQuestCityWalkModel,
  isQuestWalkSentence,
  questCityWalkQuestIds,
  questCityWalkBundleCount,
  questCityWalkHasContent,
  questWalkKey,
};
