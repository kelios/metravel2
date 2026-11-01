import { test, expect } from './fixtures'
import { createQuestFixture } from './helpers/questWizardFixture'

/**
 * #2905: мягкий старт первой обязательной точки. 55 % стартовавших уходили, не
 * ответив ни разу: строгий «Неверный ответ» на первой же загадке читался как
 * «не для меня». На первой точке подсказка открыта сразу, неверный ответ
 * встречает спокойная заметка и кнопка «Открыть ответ и идти дальше», которая
 * засчитывает точку и ведёт на вторую. Вторая точка — прежняя механика.
 *
 * Первая точка задана проверяемым ответом (`exact`): на свободном ответе
 * мягкого старта нет, открывать там нечего.
 */

const quest = createQuestFixture({
  questId: 'e2e-soft-start-quest',
  questTitle: 'E2E-квест мягкого старта',
  questNumericId: 92_905,
  progressId: 90_905,
  points: [
    {
      id: 'soft-step-1',
      lat: 53.9023,
      lng: 27.5619,
      task: 'Из чего сложены стены?',
      hint: 'Ответ — на табличке у входа: камень.',
      answerPattern: { type: 'exact', value: 'камень' },
    },
    { id: 'soft-step-2', lat: 53.9032, lng: 27.5619 },
  ],
})

test.describe('Мягкий старт первой точки квеста (#2905)', () => {
  test('@smoke подсказка открыта сразу, неверный ответ ведёт к «Открыть ответ», точка засчитана', async ({ page }) => {
    await quest.open(page)

    // Подсказка видна без нажатий; ссылки «Пропустить шаг» на первой точке нет —
    // её место занял мягкий выход.
    await expect(page.getByText('Подсказка: Ответ — на табличке у входа: камень.')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('quest-step-soft-reveal-link')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Пропустить шаг', exact: true })).toHaveCount(0)

    const answer = page.getByRole('textbox').first()
    await answer.fill('дерево')
    await page.getByTestId('quest-step-check').click()

    // Спокойная заметка вместо красного «Неверный ответ» и кнопка выхода.
    await expect(page.getByTestId('quest-step-soft-error')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Неверный ответ', { exact: true })).toHaveCount(0)
    await page.getByTestId('quest-step-soft-reveal').click()

    // Точка засчитана, игрок на второй точке с прежней механикой.
    await expect(page.getByText(`Задания: 1 / ${quest.stepTotal}`)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Точка 2', { exact: true })).toBeVisible()
    await expect(page.getByTestId('quest-step-soft-reveal-link')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Пропустить шаг', exact: true })).toBeVisible()
  })
})
