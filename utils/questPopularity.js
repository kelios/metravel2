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

module.exports = {
  QUEST_POPULARITY_SORT,
  compareQuestPopularity,
  selectPopularQuests,
  sortQuestsByPopularity,
};
