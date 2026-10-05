import type { Page } from '@playwright/test'

import { test, expect } from './fixtures'
import { createQuestFixture } from './helpers/questWizardFixture'

/**
 * Шапка квеста на телефоне: строка экрана не имеет права терять контролы.
 *
 * #2148: название, (i), офлайн и «⋯» живут в строке экрана (`HeaderContextBar`
 * + декларация `useQuestScreenHeader`); ряда действий `quest-header-actions`
 * над заданием на телефоне больше нет. История ниже — про прежний ряд, её
 * урок (проверять геометрию на реальных ширинах) держит первая проверка.
 *
 * Дефект, ради которого спека написана: `headerActionRowMobile` стоял с
 * `flexWrap: 'nowrap'` при унаследованном от десктопа `justifyContent:
 * 'flex-end'`, а в ряд попадали семь иконочных контролов. Они требовали больше
 * ширины, чем есть на 320–375px, и переполнение уходило ВЛЕВО: первая кнопка
 * («уменьшить шрифт») оказывалась срезанной краем экрана. Ужать кнопки нельзя —
 * 44dp это минимум тач-таргета (#1274). После #1669 редкие действия живут в
 * «Ещё», а счётчик вернулся в ряд как сжимаемый пятый элемент.
 *
 * Проверяются реальные ширины устройств, а не одна «мобильная»: 320 — самый
 * узкий, 360 — самый ходовой Android, 375/414 — iPhone.
 */

const MOBILE_WIDTHS = [320, 360, 375, 414]

/**
 * «⋯» строки экрана. Он есть только на телефоне: на 1280px, откуда стартует
 * фикстура, строка показывает хлебные крошки, а визард — `QuestCompactSidebar`.
 * Поэтому ожидание именно этого узла доказывает, что React уже переложил
 * разметку под новую ширину, — кнопка сброса для этого не годится, на desktop
 * она есть в панели.
 */
const screenRowMore = (page: Page) => page.getByTestId('screen-header-more')

const QUEST_TITLE = 'E2E-квест шапки на телефоне'

const quest = createQuestFixture({
  questId: 'e2e-header-layout-quest',
  questTitle: QUEST_TITLE,
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
      await expect(screenRowMore(page)).toBeVisible({ timeout: 30_000 })
      await page.evaluate(() => window.scrollTo(0, 0))

      expect(await clippedHeaderElements(page), `ширина ${width}px`).toEqual([])
    }
  })

  test('позиция в маршруте видна на всех мобильных ширинах', async ({ page }) => {
    await quest.open(page)
    await quest.answerCurrentStep(page, 'первый ответ', 1)

    // #2149: на телефоне счётчик живёт в полосе маршрута рядом с позицией. У
    // фикстуры нет явных ролей точек (`source: 'fallback'`), поэтому «Задания»
    // полоса не показывает — только «Точка N из M», и строка обязана умещаться.
    for (const width of MOBILE_WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      await expect(screenRowMore(page)).toBeVisible({ timeout: 30_000 })
      const strip = page.getByTestId('quest-route-strip')
      await expect(strip).toBeVisible({ timeout: 30_000 })
      await expect(strip.getByText(new RegExp(`Точка \\d+ из ${quest.stepTotal}`))).toBeVisible()
    }
  })

  /**
   * #1669 увёл редкие действия в «Ещё», #2148 — весь ряд в строку экрана.
   * Проверяем именно то, что действия ПЕРЕЕХАЛИ, а не пропали: тест на «над
   * заданием нет кнопок» прошёл бы и в случае, когда действие потеряно совсем.
   */
  test('действия шапки живут в строке экрана и её «⋯», а не пропадают', async ({ page }) => {
    await quest.open(page)
    await quest.answerCurrentStep(page, 'первый ответ', 1)
    await page.setViewportSize({ width: 375, height: 900 })

    await expect(screenRowMore(page)).toBeVisible({ timeout: 30_000 })
    // Над заданием ряда кнопок нет; офлайн — главное действие строки.
    await expect(page.getByTestId('quest-header-actions')).toHaveCount(0)
    await expect(page.getByTestId('quest-header-offline')).toBeVisible()
    await expect(page.getByTestId('screen-header-title')).toHaveText(QUEST_TITLE)

    await screenRowMore(page).click()

    // Лист открылся и несёт подписи в порядке §12, сброс — последним.
    const items = page.locator('[data-testid^="quest-menu-"]')
    await expect(items.first()).toBeVisible({ timeout: 30_000 })
    const order = await items.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')))
    expect(order[0]).toBe('quest-menu-font-size')
    expect(order[order.length - 1]).toBe('quest-menu-reset')
    await expect(page.getByText('Сбросить прогресс', { exact: true })).toBeVisible()
    await expect(page.getByText('Скачать GPX', { exact: true })).toBeVisible()
    await expect(page.getByText('Открыть в приложении', { exact: true })).toBeVisible()
  })
})
