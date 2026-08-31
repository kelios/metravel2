import { test, expect } from './fixtures'
import { createQuestFixture } from './helpers/questWizardFixture'

/**
 * #1633: ссылка «Пропустить шаг» откладывает точку, но с гейта финала её не
 * снимает. До правки игрок доходил до последней точки маршрута и упирался в
 * тупик: финала нет, объяснения нет, выхода нет — четыре прохождения из шести
 * за 24–28.08.2026 умерли ровно так.
 *
 * Приёмка 31.08 до этого экрана не дошла («прогон срывался на середине
 * маршрута»), поэтому пункты ТЗ про долг маршрута, возврат к отложенной точке и
 * досрочный финал остались непроверенными. Спека закрывает именно их.
 *
 * Перегоны маршрута РОВНЫЕ (~100 м): блок далёкой точки (#1432) показывается
 * ВМЕСТО блока долга и увёл бы проверку на другой механизм.
 */

const POSTPONED_STEP_ID = 'debt-step-1'

const quest = createQuestFixture({
  questId: 'e2e-pending-debt-quest',
  questTitle: 'E2E-квест долга маршрута',
  questNumericId: 91_633,
  progressId: 90_633,
  points: [
    { id: POSTPONED_STEP_ID, lat: 53.9023, lng: 27.5619 },
    { id: 'debt-step-2', lat: 53.9032, lng: 27.5619 },
    { id: 'debt-step-3', lat: 53.9041, lng: 27.5619 },
    { id: 'debt-step-4', lat: 53.905, lng: 27.5619 },
  ],
})

const openQuest = (page: import('@playwright/test').Page) => quest.open(page)

/**
 * Откладывает первую точку ссылкой «Пропустить шаг» и доводит игрока до
 * последней точки маршрута — та самая позиция, в которой игроки застревали.
 * `exact: true` обязателен: приглашение #1430 «Не сходится? Пропустить шаг и
 * идти дальше» содержит ту же подстроку, но зовёт официальный пропуск.
 */
const postponeFirstAndReachLastStep = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: 'Пропустить шаг', exact: true }).click()
  await expect(
    page.getByText('Точка отложена — вернитесь к ней, иначе квест не засчитается'),
  ).toBeVisible({ timeout: 30_000 })

  await quest.answerCurrentStep(page, 'ответ на вторую точку', 1)
  await quest.answerCurrentStep(page, 'ответ на третью точку', 2)
}

test.describe('Долг маршрута после отложенной точки (#1633)', () => {
  test('на последней точке видно, какой точки не хватает, и есть выход на финал', async ({ page }) => {
    await openQuest(page)
    await postponeFirstAndReachLastStep(page)

    const debt = page.getByTestId('quest-step-pending-notice')
    await expect(debt).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Осталась 1 точка')).toBeVisible()
    // Долг назван поимённо, а не числом: игрок должен знать, куда возвращаться.
    await expect(page.getByTestId(`quest-step-pending-go-${POSTPONED_STEP_ID}`)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Вернуться: Точка 1' })).toBeVisible()
    await expect(page.getByTestId('quest-step-pending-finish')).toBeVisible()
  })

  test('отложенная точка помечена в навигации по маршруту отдельным состоянием', async ({ page }) => {
    await openQuest(page)

    // До пропуска состояния нет: точка просто ещё впереди.
    await expect(page.getByRole('button', { name: 'Точка 1 — отложена, ждёт ответа' })).toHaveCount(0)

    await postponeFirstAndReachLastStep(page)

    // Долг назван словами, а не только цветом: состояние читается и скринридером.
    await expect(page.getByRole('button', { name: 'Точка 1 — отложена, ждёт ответа' })).toBeVisible({
      timeout: 30_000,
    })
    // Пройденная точка тем же состоянием не метится.
    await expect(page.getByRole('button', { name: 'Точка 2 — отложена, ждёт ответа' })).toHaveCount(0)
  })

  test('возврат к отложенной точке закрывает гейт: прохождение засчитывается полностью', async ({ page }) => {
    await openQuest(page)
    await postponeFirstAndReachLastStep(page)

    await page.getByTestId(`quest-step-pending-go-${POSTPONED_STEP_ID}`).click()
    await quest.answerCurrentStep(page, 'ответ на отложенную точку', 3)

    // Точки 2 и 3 уже отвечены — проходим их «Далее» до последней.
    await page.getByTestId('quest-step-continue').click()
    await page.getByTestId('quest-step-continue').click()

    // Долга больше нет, и последняя точка ведёт себя как обычная.
    await expect(page.getByTestId('quest-step-pending-notice')).toHaveCount(0)
    await quest.answerCurrentStep(page, 'ответ на последнюю точку', quest.stepTotal)

    await expect(page.getByTestId('quest-finale-not-credited')).toHaveCount(0)
    await expect(page.getByText('Квест завершён.')).toBeVisible({ timeout: 30_000 })
  })

  test('«Завершить квест здесь» из блока долга даёт финал с частичным результатом', async ({ page }) => {
    await openQuest(page)
    await postponeFirstAndReachLastStep(page)

    await page.getByTestId('quest-step-pending-finish').click()

    // Финал есть — но честно помечен как незасчитанный: политика #1443 не тронута.
    await expect(page.getByText('Квест завершён.')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('quest-finale-not-credited')).toBeVisible()
  })
})
