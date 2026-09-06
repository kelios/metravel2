/**
 * scripts/lib/questPointRoles.js
 * Правило структурной роли точки квеста в ОДНОМ экземпляре: по нему и чинит
 * бэкфилл (`backfill-quest-point-roles.js`), и проверяет гвардия
 * (`scan-quest-point-roles.js`).
 *
 * Роль (`quest_steps.point_role`) видна игроку: подпись под заголовком точки
 * (`components/quests/questWizardStepCard.tsx`), суффикс в списке точек
 * (`questWizardShell.tsx`), подпись на карте (`questMapPoints.ts`) и в
 * офлайн-экспорте, плюс счётчики `utils/questCountModel.ts`. Поле появилось
 * позже самих квестов, старые строки получили `required` по умолчанию и не
 * бэкфилились: на 05.09.2026 167 точек из 196, у которых «(по желанию)»
 * написано в самом заголовке, были подписаны «Обязательная точка», а финал не
 * помечен у 165 квестов из 183 (#1802).
 *
 * ПОЧЕМУ НЕ ПРАВИЛО ЗАЛИВЩИКА. `scripts/migrate-quest-from-file.js` выводит
 * роль из типа ответа: `any` → `optional`. Для нового контента это верно, но
 * задним числом по проду так считать нельзя: в квестах из статей (#1652) `any`
 * стоял на ОБЯЗАТЕЛЬНЫХ точках маршрута с плохими вопросами, а не на привалах.
 * Поэтому здесь ведёт авторский текст заголовка — он и есть то обещание,
 * которое игрок читает, — а тип ответа только подтверждает маркеры-иконки.
 */

/** Заголовок прямо называет точку необязательной. Достаточное условие. */
const EXPLICIT_OPTIONAL = /(по\s+желанию|опционально|не\s+обязательн)/i

/**
 * Косвенные маркеры остановки: иконка привала в начале заголовка или слово
 * «привал». Сами по себе роль не решают — только вместе со свободным ответом
 * (`any`), иначе под них попала бы вопросная точка с кофейней в названии.
 *
 * Флаг `u` обязателен: 🍦 и 🍨 — суррогатные пары, и без него класс символов
 * содержит их ПОЛОВИНКИ, а не сами эмодзи. Раньше файл не попадал под eslint
 * (в check:fast линтуются только изменённые файлы), поэтому ошибка дожила до
 * #1810.
 */
const REST_STOP_MARKER = /(^\s*[☕✨🍦🍨]|привал)/iu

const FREE_PASS_ANSWER_TYPES = new Set(['any'])

function answerType(step) {
  const raw = step && step.answer_pattern
  if (!raw) return undefined
  const parsed = typeof raw === 'string' ? safeParse(raw) : raw
  return parsed && typeof parsed.type === 'string' ? parsed.type : undefined
}

function safeParse(text) {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** Точка обещает игроку, что её можно не проходить. */
function isOptionalByTitle(step) {
  const title = String((step && step.title) || '')
  if (EXPLICIT_OPTIONAL.test(title)) return true
  return REST_STOP_MARKER.test(title) && FREE_PASS_ANSWER_TYPES.has(answerType(step))
}

/** Заголовок сам, словами, обещает игроку необязательность. */
function isExplicitlyOptional(step) {
  return EXPLICIT_OPTIONAL.test(String((step && step.title) || ''))
}

/**
 * #1810 — устойчивая идентичность шага. У прод-бандла есть и `id` (первичный
 * ключ строки), и `step_id` (авторский слаг); у локального
 * `scripts/<city>-quest-data.js` — только второй. Ключом `Map` брали `id`, и на
 * локальной форме все десять шагов схлопывались в одну запись с ключом
 * `undefined`: гвардия печатала «Расхождений: 10» на здоровом файле.
 */
function stepKey(step) {
  const dbId = step && step.id
  if (dbId !== undefined && dbId !== null) return dbId
  const slug = step && step.step_id
  return slug === undefined || slug === null ? undefined : `slug:${slug}`
}

/**
 * #1810 — нумерованные шаги в порядке маршрута. Сортировка по `order` возможна
 * только когда поле есть у ВСЕХ шагов: в локальном файле его нет вовсе, и
 * `Number(a.order) - Number(b.order)` возвращал `NaN` на каждой паре.
 * Точность важна, чтобы не чинили не то: `NaN` спецификация приводит к `+0`, а
 * `sort` стабилен, поэтому на файле БЕЗ `order` порядок как раз сохранялся —
 * ломался ключ `Map`, а не последовательность. Опасен смешанный случай: если
 * `order` есть у части шагов, компаратор перестаёт быть последовательным и
 * результат `sort` не определён. Там, где `order` нет, порядок задаёт сам файл:
 * он и есть авторский маршрут (так же считает последнюю точку заливщик,
 * `migrate-quest-from-file.js` → `pointRoleFor`).
 */
function orderedSteps(steps) {
  const numbered = (steps || []).filter((step) => !step.is_intro)
  const everyStepHasOrder = numbered.every((step) => Number.isFinite(Number(step && step.order)))
  if (!everyStepHasOrder) return numbered.slice()
  return numbered.slice().sort((a, b) => Number(a.order) - Number(b.order))
}

/**
 * Ожидаемые роли для нумерованных шагов одного квеста.
 *
 * Возвращает Map `stepKey(step) → role`. Интро не трогаем вовсе: его роль
 * (`start`) ставит бэкенд и валидирует сериализатор.
 *
 * `final` получает последняя точка маршрута — но только если она сама не
 * обещана необязательной. Квест, который заканчивается привалом, остаётся без
 * финала намеренно: выбирать «настоящий финал» за автора скрипт не должен, и
 * такие квесты уходят в отчёт отдельной строкой.
 */
function expectedRoles(steps) {
  const numbered = orderedSteps(steps)

  const roles = new Map()
  numbered.forEach((step, index) => {
    const isLast = index === numbered.length - 1
    if (isOptionalByTitle(step)) {
      roles.set(stepKey(step), 'optional')
      return
    }
    roles.set(stepKey(step), isLast ? 'final' : 'required')
  })
  return roles
}

/** Расхождения между тем, что стоит в базе, и ожидаемой ролью. */
function findRoleMismatches(bundle, steps) {
  const expected = expectedRoles(steps)
  const rows = []
  for (const step of steps) {
    if (step.is_intro) continue
    const want = expected.get(stepKey(step))
    const have = step.point_role || null
    if (want && have !== want) {
      rows.push({
        questId: bundle.quest_id,
        stepDbId: step.id,
        stepId: step.step_id,
        order: Number.isFinite(Number(step.order)) ? Number(step.order) : null,
        title: String(step.title || ''),
        have,
        want,
      })
    }
  }
  return rows
}

/** Квест закончился точкой «по желанию» — финал за автора не выбираем. */
function endsWithOptional(steps) {
  const numbered = orderedSteps(steps)
  const last = numbered[numbered.length - 1]
  return Boolean(last && isOptionalByTitle(last))
}

/**
 * Роль, объявленная в самом data-файле. Заливщик проносит её на бэкенд как есть
 * (`migrate-quest-from-file.js` → `pointRoleFor`: явное поле имеет приоритет над
 * выводом по заголовку), поэтому для авторской проверки это такой же источник
 * будущей подписи под заголовком, как и текст.
 */
function declaredRole(step) {
  const raw = step && (step.point_role || step.pointRole)
  return typeof raw === 'string' ? raw : undefined
}

/**
 * #1810 — проверка АВТОРСКОГО файла, где `point_role` обычно ещё нет: его
 * проставляет заливщик. Сверять пустое поле с ожидаемой ролью бессмысленно — так
 * гвардия и выдавала десять строк «null → final» на здоровом квесте. До заливки
 * проверяемо другое: обещает ли точке необязательность сам заголовок.
 *
 * Роль читает игрок подписью под заголовком, поэтому единственное честное
 * основание для «по желанию» — слова в самом заголовке. Ловим два пути к
 * подписи «Необязательная точка», у которых этих слов нет:
 *   1) косвенный — иконка привала плюс свободный ответ. Для разбора прода
 *      задним числом (#1802) этой пары достаточно, но для нового контента это
 *      ровно тот случай, который однажды уже увёл разметку: в квестах из статей
 *      (#1652) свободный ответ стоял на ОБЯЗАТЕЛЬНЫХ точках с плохими вопросами;
 *   2) объявленный — `point_role: 'optional'` прямо в шаге data-файла. Так
 *      помечают опциональную точку с проверяемым ответом (правило авторинга
 *      `metravel-quest` → «point_role»), и заливщик отдаёт её на бэкенд без
 *      всякой оглядки на заголовок. Без этой ветки гвардия молчала бы именно
 *      там, где намерение автора выражено сильнее всего: 8 таких шагов в 5
 *      локальных файлах, и все они сегодня несут «(по желанию)» в заголовке —
 *      значит ветка описывает норму, а не ужесточает её.
 */
function findAuthoringRoleIssues(bundle, steps) {
  const numbered = orderedSteps(steps)
  const rows = []
  numbered.forEach((step) => {
    if (isExplicitlyOptional(step)) return
    const declaredOptional = declaredRole(step) === 'optional'
    if (!declaredOptional && !isOptionalByTitle(step)) return
    rows.push({
      questId: bundle && bundle.quest_id,
      stepDbId: step.id ?? null,
      stepId: step.step_id,
      order: Number.isFinite(Number(step.order)) ? Number(step.order) : null,
      title: String(step.title || ''),
      have: declaredOptional ? 'point_role: optional' : 'implicit-optional',
      want: declaredOptional
        ? 'optional в заголовке'
        : 'optional в заголовке или вопрос вместо свободного ответа',
    })
  })
  return rows
}

module.exports = {
  EXPLICIT_OPTIONAL,
  REST_STOP_MARKER,
  answerType,
  isOptionalByTitle,
  isExplicitlyOptional,
  declaredRole,
  stepKey,
  orderedSteps,
  expectedRoles,
  findRoleMismatches,
  findAuthoringRoleIssues,
  endsWithOptional,
}
