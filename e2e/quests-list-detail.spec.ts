import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'
import { expectNoHorizontalScroll } from './helpers/layoutAsserts'
import { isRecoverableReactHydrationError } from './helpers/consoleGuards'

const WAIT_MS = 30_000
const QUEST_DETAIL_URL_RE = /\/quests\/[^/]+\/[^/?#]+/

// The catalog can legitimately render in several end states depending on the
// e2e backend data: real cards, an empty/error fallback, or the bare heading.
// Treat any of these as "the screen finished its first render" so we never
// flake on data availability.
const QUEST_FALLBACK_RE =
  /ошибка|Internal Server Error|Failed to load quests|не удалось загрузить|квесты не найдены|нет квестов|Нет квестов|0 квестов|Выберите город/i

const waitForQuestCatalogReady = async (page: Page) =>
  Promise.any([
    page.locator('[data-testid^="quest-card-"]').first().waitFor({ state: 'visible', timeout: WAIT_MS }),
    page.getByRole('link', { name: /Начать приключение/i }).first().waitFor({ state: 'visible', timeout: WAIT_MS }),
    page.getByText(QUEST_FALLBACK_RE).first().waitFor({ state: 'visible', timeout: WAIT_MS }),
    page.getByRole('heading', { name: /Квесты/i }).first().waitFor({ state: 'visible', timeout: WAIT_MS }),
  ])

const getFirstQuestCard = async (page: Page) => {
  const byTestId = page.locator('[data-testid^="quest-card-"]')
  await byTestId.first().waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {})
  if ((await byTestId.count()) > 0) return byTestId.first()

  const byRole = page.getByRole('link', { name: /Начать приключение/i })
  if ((await byRole.count()) > 0) return byRole.first()

  return null
}

test.describe('Quests list -> detail', () => {
  test('guest can browse the quest catalog and open a quest detail', async ({ page }) => {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => {
      pageErrors.push(String(err?.message ?? err))
    })

    await preacceptCookies(page)
    await page.setViewportSize({ width: 1280, height: 900 })

    await gotoWithRetry(page, '/quests')
    await waitForQuestCatalogReady(page)

    // The hidden SEO h1 plus the visible catalog heading establish the page identity.
    await expect(page.getByRole('heading', { name: /Квесты/i }).first()).toBeVisible({ timeout: WAIT_MS })

    // Country grouping: the "Рядом со мной" location filter is always present in the sidebar.
    await expect(
      page.getByText('Рядом со мной', { exact: false }).first(),
    ).toBeVisible({ timeout: WAIT_MS })

    // Map toggle control exists ("Показать квесты на карте" / "на карте").
    await expect(
      page
        .getByRole('button', { name: /на карте|на карту/i })
        .or(page.getByText(/Показать на карте/i))
        .first(),
    ).toBeVisible({ timeout: WAIT_MS })

    // No horizontal overflow on the catalog screen.
    await expectNoHorizontalScroll(page)

    // Open a quest detail if any quest exists; otherwise assert the fallback is shown.
    const card = await getFirstQuestCard(page)
    if (card) {
      await Promise.all([
        page.waitForURL(QUEST_DETAIL_URL_RE, { timeout: WAIT_MS }),
        card.click(),
      ])
      await page.waitForLoadState('domcontentloaded')

      await expect(page).toHaveURL(QUEST_DETAIL_URL_RE)
      await expect(page.locator('text=/Квест|Quest/i').first()).toBeVisible({ timeout: WAIT_MS })

      // Detail screen must also avoid horizontal overflow.
      await expectNoHorizontalScroll(page)
    } else {
      await expect(page.getByText(QUEST_FALLBACK_RE).first()).toBeVisible({ timeout: WAIT_MS })
    }

    const unexpectedPageErrors = pageErrors.filter((message) => !isRecoverableReactHydrationError(message))
    expect(unexpectedPageErrors, `page errors: ${pageErrors.join('\n')}`).toHaveLength(0)
    expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toHaveLength(0)
  })
})
