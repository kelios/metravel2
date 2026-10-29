import type { Page } from '@playwright/test'

import { test, expect } from './fixtures'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth'
import { waitForMoreSheetController } from './helpers/chrome'

const STATS = {
  days: [{ date: '2026-10-27', new_installs: 2, active_installs: 5, sessions: 8 }],
  retention: {
    d1: { cohort_size: 10, retained: 4, rate: 40 },
    d7: { cohort_size: 8, retained: 2, rate: 25 },
    d30: { cohort_size: 0, retained: 0, rate: 0 },
  },
  crash_free: [{
    app_version: '1.2.3',
    platform: 'ios',
    sessions: 8,
    crashed_sessions: 1,
    crash_free_percent: 87.5,
  }],
  top_crashes: [{
    signature: 'abc',
    count: 3,
    installs_affected: 2,
    first_seen: '2026-10-20T10:00:00Z',
    last_seen: '2026-10-27T12:00:00Z',
    app_versions: ['1.2.3'],
    message: 'Boom in map',
    stack: 'at renderMap (MapScreen.tsx:10:5)',
  }],
  funnel: [
    { name: 'app_first_open', count: 2 },
    { name: 'app_open', count: 0 },
  ],
}

const mockStats = async (page: Page) => {
  await page.route('**/api/app-telemetry/stats/**', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(STATS),
    })
  })
}

const expectNoHorizontalScroll = async (page: Page) => {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)
}

test.describe('статистика приложения для администратора (#2843)', () => {
  test('пункт в меню ведёт на экран с пятью блоками и стеком', async ({ page }) => {
    await ensureAuthedStorageFallback(page, { isSuperuser: true })
    await mockFakeAuthApis(page)
    await mockStats(page)
    await page.setViewportSize({ width: 1280, height: 800 })
    await preacceptCookies(page)
    await gotoWithRetry(page, '/', { waitUntil: 'domcontentloaded', timeout: 60_000, attempts: 4 })

    await page.locator('[data-testid="account-menu-anchor"]:visible').first().click()
    const item = page.getByRole('link', { name: 'Статистика приложения', exact: true })
    await expect(item).toBeVisible()
    await item.click()

    await expect(page.getByTestId('app-stats-days')).toBeVisible()
    await expect(page.getByTestId('app-stats-retention')).toBeVisible()
    await expect(page.getByTestId('app-stats-crash-free')).toBeVisible()
    await expect(page.getByTestId('app-stats-crashes')).toBeVisible()
    await expect(page.getByTestId('app-stats-funnel')).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByTestId('app-stats-crash-0').click()
    await expect(page.getByText('at renderMap (MapScreen.tsx:10:5)')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('на ширине 390 пункт есть в листе «Ещё» только у суперпользователя', async ({ page }) => {
    await ensureAuthedStorageFallback(page, { isSuperuser: true })
    await mockFakeAuthApis(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await preacceptCookies(page)
    await gotoWithRetry(page, '/', { waitUntil: 'domcontentloaded', timeout: 60_000, attempts: 4 })

    await waitForMoreSheetController(page)
    await page.getByTestId('footer-dock-row').getByTestId('footer-item-more').click()
    await expect(page.getByTestId('footer-more-item-app-stats')).toBeVisible()
  })

  test('обычный пользователь не видит пункт, прямой адрес не запрашивает статистику', async ({ page }) => {
    let statsRequests = 0
    await ensureAuthedStorageFallback(page, { isSuperuser: false })
    await mockFakeAuthApis(page)
    await page.route('**/api/app-telemetry/stats/**', (route) => {
      statsRequests += 1
      return route.fulfill({ status: 403, contentType: 'application/json', body: '{}' })
    })
    await page.setViewportSize({ width: 1280, height: 800 })
    await preacceptCookies(page)
    await gotoWithRetry(page, '/app-stats', { waitUntil: 'domcontentloaded', timeout: 60_000, attempts: 4 })

    await expect.poll(() => page.url()).not.toContain('/app-stats')
    expect(statsRequests).toBe(0)

    await gotoWithRetry(page, '/', { waitUntil: 'domcontentloaded', timeout: 60_000, attempts: 2 })
    await page.locator('[data-testid="account-menu-anchor"]:visible').first().click()
    await expect(page.getByRole('button', { name: 'Выход', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Статистика приложения', exact: true })).toHaveCount(0)
  })
})
