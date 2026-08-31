import { test, expect } from './fixtures'
import { createQuestFixture } from './helpers/questWizardFixture'

/**
 * #1632: официальный пропуск точки и досрочный финиш обязаны доезжать до сервера.
 *
 * Приёмка 31.08.2026 отказала карточке по наблюдению «нажал „Пропустить шаг“ —
 * `skipped` пустой». Нажата была отложенная ссылка (`skipStep`), которая точку с
 * гейта финала не снимает по замыслу (#1633), поэтому пустая карта там —
 * ожидаемое поведение, а не дефект переноса. Этот тест разводит оба действия и
 * ловит РЕАЛЬНОЕ тело PATCH:
 *   - «Пропустить точку» (далёкая точка) → `skipped: {<step>: true}`;
 *   - «Завершить квест здесь» → `early_finish: true`;
 *   - отложенная ссылка «Пропустить шаг» → `skipped` остаётся пустым, но курсор
 *     всё равно уезжает на сервер (PATCH уходит).
 */

const FAR_STEP_ID = 'sync-step-3'

/**
 * Перегоны 100 / 5000 / 100 м. Медиана перегона — 100 м, поэтому третья точка
 * проходит оба порога «далеко» (≥ 800 м и ≥ 3 медиан) и получает блок с
 * официальным пропуском.
 *
 * Четвёртая точка несущая, а не декоративная: без неё медиана станет 2,5 км,
 * порог «3 медианы» уедет за 7 км и блок далёкой точки исчезнет вовсе. Стоит она
 * за тем же пятикилометровым перегоном, чтобы у далёкой точки было ещё и
 * «Завершить квест здесь» (`canFinishHere`).
 */
const quest = createQuestFixture({
  questId: 'e2e-skip-sync-quest',
  questTitle: 'E2E-квест переноса пропусков',
  questNumericId: 91_632,
  progressId: 90_632,
  points: [
    { id: 'sync-step-1', lat: 53.9023, lng: 27.5619 },
    { id: 'sync-step-2', lat: 53.9032, lng: 27.5619 },
    { id: FAR_STEP_ID, lat: 53.9482, lng: 27.5619 },
    { id: 'sync-step-4', lat: 53.9491, lng: 27.5619 },
  ],
})

/**
 * Куда обязан встать курсор после отложенного пропуска первой вопросной точки.
 * Нулевой индекс занимает стартовая карточка (визард всегда подставляет intro),
 * поэтому первая точка маршрута — 1, а пропуск уводит на 2. Точное значение, а
 * не «больше нуля»: сдвиг индексации — это как раз та поломка, ради которой
 * курсор здесь и проверяется.
 */
const CURSOR_AFTER_POSTPONE = 2

test.describe('Перенос пропуска и досрочного финиша на сервер (#1632)', () => {
  test('официальный пропуск далёкой точки уходит в PATCH непустой картой skipped', async ({ page }) => {
    await quest.open(page)

    await quest.answerCurrentStep(page, 'первый ответ', 1)
    await quest.answerCurrentStep(page, 'второй ответ', 2)

    // Третья точка за пятикилометровым перегоном — блок официального пропуска.
    await expect(page.getByTestId('quest-step-far-notice')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('quest-step-far-skip').click()

    await expect
      .poll(() => (quest.lastPatch()?.skipped as Record<string, boolean> | undefined) ?? {}, {
        timeout: 30_000,
      })
      .toEqual({ [FAR_STEP_ID]: true })
  })

  test('«Завершить квест здесь» уходит в PATCH флагом early_finish', async ({ page }) => {
    await quest.open(page)

    await quest.answerCurrentStep(page, 'первый ответ', 1)
    await quest.answerCurrentStep(page, 'второй ответ', 2)

    await expect(page.getByTestId('quest-step-far-notice')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('quest-step-finish-here').click()

    await expect
      .poll(() => quest.lastPatch()?.early_finish ?? false, { timeout: 30_000 })
      .toBe(true)
  })

  test('отложенная ссылка «Пропустить шаг» курсор на сервер шлёт, а точку с гейта не снимает', async ({ page }) => {
    await quest.open(page)

    // Ссылка живёт рядом с подсказкой на самой первой вопросной точке. `exact`
    // здесь обязателен: у приглашения #1430 («Не сходится? Пропустить шаг и идти
    // дальше») accessible name содержит ту же подстроку, но зовёт другой
    // обработчик — `skipStuckStep`, который точку с гейта как раз снимает.
    await page.getByRole('button', { name: 'Пропустить шаг', exact: true }).click()

    // Курсор уехал вперёд — значит серверу есть что записать, PATCH обязан уйти.
    await expect
      .poll(() => quest.lastPatch()?.current_index ?? 0, { timeout: 30_000 })
      .toBe(CURSOR_AFTER_POSTPONE)
    // Но точка осталась обязательной: карта пропусков пуста (#1633 объясняет это игроку).
    expect(quest.lastPatch()?.skipped ?? {}).toEqual({})
  })
})
