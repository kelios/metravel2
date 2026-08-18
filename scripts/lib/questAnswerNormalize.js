/**
 * scripts/lib/questAnswerNormalize.js
 * Нормализация ответа квеста для аудит-скриптов — ровно та же, по которой
 * `utils/questAdapters.normalize` засчитывает ввод игрока.
 *
 * Почему копия, а не импорт: рантайм живёт в TypeScript и тянет alias-импорты
 * (`@/utils/mediaUrl`), а скрипты в `scripts/` — обычный CommonJS без
 * TS-загрузчика (в проекте нет ни ts-node, ни tsx). Копия правил при этом
 * опасна ровно тем, ради чего скан существует: разойдись она с рантаймом хоть
 * одним `replace`, и скан начнёт отчитываться «недостижимых нет» о словаре,
 * который игроку недоступен.
 *
 * Поэтому расхождение ловится тестом, а не соглашением:
 * `__tests__/scripts/scanQuestAnswerReachability.test.ts` сверяет и поведение
 * на корпусе, и сам список преобразований, вырезанный из
 * `utils/questAdapters.ts`. Новое правило в рантайме роняет тест здесь.
 */

/**
 * Один в один тело `utils/questAdapters.normalize`. Менять только вместе с ним —
 * тест паритета сравнивает цепочку преобразований посимвольно.
 */
function normalizeRuntime(s) {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?'„""–—-]/g, '')
    .replace(/ё/g, 'е')
    .trim()
}

/**
 * То же самое, но безопасно к `null`/`undefined`/числу: в бандлах поля шага
 * необязательны, а рантайм получает строку всегда (её даёт сам инпут).
 */
function normalizeAnswer(value) {
  return normalizeRuntime(String(value == null ? '' : value))
}

module.exports = { normalizeRuntime, normalizeAnswer }
