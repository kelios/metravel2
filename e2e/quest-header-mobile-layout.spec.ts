import type { Page } from '@playwright/test'

import { test, expect } from './fixtures'
import { createQuestFixture } from './helpers/questWizardFixture'

/**
 * Шапка квеста на телефоне: ряд действий не имеет права терять контролы.
 *
 * Дефект, ради которого спека написана: `headerActionRowMobile` стоял с
 * `flexWrap: 'nowrap'` при унаследованном от десктопа `justifyContent:
 * 'flex-end'`, а в ряд, кроме шести иконок и сброса, попадал ещё и счётчик
 * заданий. Семь-восемь контролов по 44dp требуют больше ширины, чем есть на
 * 320–375px, и переполнение уходило ВЛЕВО: первая кнопка («уменьшить шрифт»)
 * оказывалась срезанной краем экрана. Ужать кнопки нельзя — 44dp это минимум
 * тач-таргета (#1274), поэтому счётчик уехал к полосе прогресса, а ряду
 * разрешён перенос.
 *
 * Проверяются реальные ширины устройств, а не одна «мобильная»: 320 — самый
 * узкий, 360 — самый ходовой Android, 375/414 — iPhone.
 */

const MOBILE_WIDTHS = [320, 360, 375, 414]

/**
 * Ряд действий шапки. Он есть только в `QuestHeaderPanel`: на 1280px, откуда
 * стартует фикстура, визард рисует `QuestCompactSidebar` без него. Поэтому
 * ожидание именно этого узла доказывает, что React уже переложил разметку под
 * новую ширину, — кнопка сброса для этого не годится, она есть в обеих ветках.
 */
const headerActions = (page: Page) => page.getByTestId('quest-header-actions')

const quest = createQuestFixture({
  questId: 'e2e-header-layout-quest',
  questTitle: 'E2E-квест шапки на телефоне',
  questNumericId: 91_634,
  progressId: 90_634,
  points: [
    { id: 'layout-step-1', lat: 53.9023, lng: 27.5619 },
    { id: 'layout-step-2', lat: 53.9032, lng: 27.5619 },
    { id: 'layout-step-3', lat: 53.9041, lng: 27.5619 },
    { id: 'layout-step-4', lat: 53.905, lng: 27.5619 },
  ],
})

/**
 * Элементы шапки, вылезшие за края окна. Считаем по факту геометрии, а не по
 * стилям: срезанная кнопка — это именно `left < 0`, каким бы правилом её туда
 * ни вынесло.
 *
 * Обратная сторона геометрического критерия: горизонтальная лента шагов — это
 * ScrollView, и её содержимое выходит за правый край ЗАКОННО. Проба этого не
 * различает, поэтому маршрут фикстуры держится на четырёх точках: лента с
 * интро и финалом ещё умещается целиком даже на 320px. Более длинный маршрут
 * начнёт прокручиваться, и проба сочтёт прокрутку срезом.
 */
const clippedHeaderElements = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('*'))
      .filter((el) => {
        const r = el.getBoundingClientRect()
        if (r.height < 8 || r.width < 8 || r.top > 320 || r.bottom < 0) return false
        return r.left < -0.5 || r.right > window.innerWidth + 0.5
      })
      .map((el) => ({
        label: (el as HTMLElement).getAttribute('aria-label') || (el.textContent || '').trim().slice(0, 24),
        left: Math.round(el.getBoundingClientRect().left),
        right: Math.round(el.getBoundingClientRect().right),
      })),
  )

test.describe('Шапка квеста на мобильных ширинах', () => {
  test('ни один контрол шапки не срезается краем экрана', async ({ page }) => {
    await quest.open(page)
    await quest.answerCurrentStep(page, 'первый ответ', 1)

    for (const width of MOBILE_WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      await expect(headerActions(page)).toBeVisible({ timeout: 30_000 })
      await page.evaluate(() => window.scrollTo(0, 0))

      expect(await clippedHeaderElements(page), `ширина ${width}px`).toEqual([])
    }
  })

  test('счётчик заданий виден на всех мобильных ширинах', async ({ page }) => {
    await quest.open(page)
    await quest.answerCurrentStep(page, 'первый ответ', 1)

    // Счётчик ушёл из ряда действий к полосе прогресса — он обязан остаться
    // видимым, иначе переезд просто спрятал бы информацию.
    for (const width of MOBILE_WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      await expect(headerActions(page)).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText(`Задания: 1 / ${quest.stepTotal}`)).toBeVisible({ timeout: 30_000 })
    }
  })
})
