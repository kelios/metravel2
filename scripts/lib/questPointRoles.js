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
 */
const REST_STOP_MARKER = /(^\s*[☕✨🍦🍨]|привал)/i

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

/**
 * Ожидаемые роли для нумерованных шагов одного квеста.
 *
 * Возвращает Map `step.id → role`. Интро не трогаем вовсе: его роль (`start`)
 * ставит бэкенд и валидирует сериализатор.
 *
 * `final` получает последняя точка маршрута — но только если она сама не
 * обещана необязательной. Квест, который заканчивается привалом, остаётся без
 * финала намеренно: выбирать «настоящий финал» за автора скрипт не должен, и
 * такие квесты уходят в отчёт отдельной строкой.
 */
function expectedRoles(steps) {
  const numbered = steps
    .filter((step) => !step.is_intro)
    .slice()
    .sort((a, b) => Number(a.order) - Number(b.order))

  const roles = new Map()
  numbered.forEach((step, index) => {
    const isLast = index === numbered.length - 1
    if (isOptionalByTitle(step)) {
      roles.set(step.id, 'optional')
      return
    }
    roles.set(step.id, isLast ? 'final' : 'required')
  })
  return roles
}

/** Расхождения между тем, что стоит в базе, и ожидаемой ролью. */
function findRoleMismatches(bundle, steps) {
  const expected = expectedRoles(steps)
  const rows = []
  for (const step of steps) {
    if (step.is_intro) continue
    const want = expected.get(step.id)
    const have = step.point_role || null
    if (want && have !== want) {
      rows.push({
        questId: bundle.quest_id,
        stepDbId: step.id,
        stepId: step.step_id,
        order: Number(step.order),
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
  const numbered = steps
    .filter((step) => !step.is_intro)
    .slice()
    .sort((a, b) => Number(a.order) - Number(b.order))
  const last = numbered[numbered.length - 1]
  return Boolean(last && isOptionalByTitle(last))
}

module.exports = {
  EXPLICIT_OPTIONAL,
  REST_STOP_MARKER,
  answerType,
  isOptionalByTitle,
  expectedRoles,
  findRoleMismatches,
  endsWithOptional,
}
