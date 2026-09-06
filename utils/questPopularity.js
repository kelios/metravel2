/* global module */

/**
 * Единственное правило «популярности» квеста, общее для приложения и SSG.
 *
 * Порядок дословно повторяет серверный `?sort=popular`
 * (`quests/catalog.py:apply_catalog_query` — `-completions_count`,
 * `-views_count`, `id`). Одно правило в двух местах нужно потому, что витрину
 * главной и её статический двойник собирают разные раннеры: приложение берёт
 * готовый порядок у бэкенда одним запросом (#1239: каталог ради шести плиток не
 * выкачиваем), а генератор `scripts/generate-seo-pages.js` уже держит весь
 * каталог в памяти и сортирует его локально, без лишнего HTTP. Если бы правила
 * разошлись, краулер и человек видели бы на главной разные подборки.
 *
 * Модуль намеренно CommonJS без зависимостей: его требует и Node-генератор, и
 * бандл приложения (см. соседние `questSeo.js`, `questContent.js`).
 */

/** Значение параметра `sort`, которым бэкенд отдаёт этот же порядок. */
const QUEST_POPULARITY_SORT = 'popular';

/**
 * Сколько прохождений делают квест «популярным» для витрины каталога.
 *
 * Порог продиктован данными, а не вкусом: прод-срез
 * `/api/quests/?compact=1&page_size=500` от 06.09.2026 — 182 квеста, из них
 * 166 без единого прохождения, 12 с одним, 3 с двумя и 1 с тремя. Один
 * случайный проход (в том числе собственный QA-прогон) не отличает квест от
 * соседа, поэтому «популярно» начинается с двух.
 */
const POPULAR_QUEST_MIN_COMPLETIONS = 2;

/**
 * Ниже двух таких квестов сортировать нечего: витрина показала бы один и тот же
 * список в другом порядке. На этом пороге каталог не предлагает переключатель
 * вовсе — вместо пустой или однокарточной «подборки популярного».
 */
const POPULAR_QUEST_MIN_MATCHES = 2;

function numericField(quest, snakeKey, camelKey) {
  const raw = quest && (quest[snakeKey] != null ? quest[snakeKey] : quest[camelKey]);
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Компаратор популярности. Читает и snake_case (сырой ответ API, кэш каталога),
 * и camelCase (адаптированные метаданные) — генератор в остальных местах уже
 * допускает обе формы одного поля.
 */
function compareQuestPopularity(a, b) {
  const byCompletions =
    numericField(b, 'completions_count', 'completionsCount') -
    numericField(a, 'completions_count', 'completionsCount');
  if (byCompletions !== 0) return byCompletions;

  const byViews =
    numericField(b, 'views_count', 'viewsCount') - numericField(a, 'views_count', 'viewsCount');
  if (byViews !== 0) return byViews;

  return numericField(a, 'id', 'id') - numericField(b, 'id', 'id');
}

/** Копия списка, отсортированная по популярности (исходный массив не трогаем). */
function sortQuestsByPopularity(quests) {
  return (Array.isArray(quests) ? quests.slice() : []).sort(compareQuestPopularity);
}

/**
 * Топ-N по популярности. `limit` без конечного числа означает «весь список»:
 * блок с нулевыми данными о прохождениях обязан показать хоть что-то (порядок
 * тогда вырождается в id), а не опустеть.
 */
function selectPopularQuests(quests, limit) {
  const sorted = sortQuestsByPopularity(quests);
  if (!Number.isFinite(limit)) return sorted;
  return sorted.slice(0, Math.max(0, limit));
}

/** Сколько квестов набора перешагнули порог популярности. */
function countPopularQuests(quests) {
  if (!Array.isArray(quests)) return 0;
  let count = 0;
  for (const quest of quests) {
    if (numericField(quest, 'completions_count', 'completionsCount') >= POPULAR_QUEST_MIN_COMPLETIONS) {
      count += 1;
    }
  }
  return count;
}

/** Есть ли в наборе достаточно прохождений, чтобы сортировка что-то значила. */
function canRankQuestsByPopularity(quests) {
  return countPopularQuests(quests) >= POPULAR_QUEST_MIN_MATCHES;
}

module.exports = {
  POPULAR_QUEST_MIN_COMPLETIONS,
  POPULAR_QUEST_MIN_MATCHES,
  QUEST_POPULARITY_SORT,
  canRankQuestsByPopularity,
  compareQuestPopularity,
  countPopularQuests,
  selectPopularQuests,
  sortQuestsByPopularity,
};
