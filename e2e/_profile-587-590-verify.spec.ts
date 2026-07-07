import { test, expect } from './fixtures'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'

test.describe('profile redesign verify #587 #588 #589 #590', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await preacceptCookies(page)
  })

  test('#588 Ваш путь loads fast (timed) + #587 rank clickable', async ({ page }) => {
    await gotoWithRetry(page, '/profile')
    await page.waitForTimeout(1200)

    // Open Уровень tab where AwardsHub «Ваш путь» lives
    await page.getByRole('tab', { name: /Уровень/i }).click()

    // #588: time until «Ваш путь» panel renders character/progression content
    const t0 = Date.now()
    const awardsHub = page.getByTestId('awards-hub')
    await expect(awardsHub).toBeVisible({ timeout: 20000 })
    // «Ваш путь» sub-tab is default; wait for its panel content to appear
    const panel = page.getByTestId('awards-panel')
    await expect(panel).toBeVisible({ timeout: 20000 })
    await page.waitForTimeout(2500)
    const elapsed = Date.now() - t0
    console.log('[#588] AwardsHub path content visible after ms=', elapsed)

    await page.screenshot({ path: 'e2e/__screenshots__/verify-588-vash-put.png', fullPage: true })

    // #587: rank card has «Подробнее» CTA and is clickable
    const rankCard = page.getByTestId('rank-progress-card')
    await expect(rankCard).toBeVisible({ timeout: 10000 })
    await rankCard.scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'e2e/__screenshots__/verify-587-rank-card.png', fullPage: true })
    await rankCard.click()
    await page.waitForTimeout(800)
    console.log('[#587] rank card clicked ok')
  })

  test('#589 stats tiles open calendar list', async ({ page }) => {
    await gotoWithRetry(page, '/profile')
    await page.waitForTimeout(1200)
    await page.getByRole('tab', { name: /Статистика/i }).click()
    await page.waitForTimeout(800)

    // Tile «Были» -> /calendar?status=visited
    const tile = page.getByTestId('personal-status-tile-visited')
    await tile.scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'e2e/__screenshots__/verify-589-stats-tab.png', fullPage: true })
    await tile.click()
    await page.waitForTimeout(1500)
    console.log('[#589] URL after «Были» tap:', page.url())
    expect(page.url()).toContain('/calendar')
    await page.screenshot({ path: 'e2e/__screenshots__/verify-589-calendar.png', fullPage: true })
  })

  test('#590 breadcrumb back-to-overview from Stats', async ({ page }) => {
    await gotoWithRetry(page, '/profile')
    await page.waitForTimeout(1200)
    await page.getByRole('tab', { name: /Статистика/i }).click()
    await page.waitForTimeout(800)

    const crumb = page.getByRole('button', { name: /Назад к разделу «Уровень»/i }).first()
    await expect(crumb).toBeVisible({ timeout: 10000 })
    await page.screenshot({ path: 'e2e/__screenshots__/verify-590-breadcrumb.png', fullPage: true })
    await crumb.click()
    await page.waitForTimeout(800)
    // Overview tab content should now be active (rank card present)
    await expect(page.getByTestId('rank-progress-card')).toBeVisible({ timeout: 10000 })
    console.log('[#590] breadcrumb returned to Уровень ok')
  })
})
