import path from 'node:path'
import { test, expect } from './fixtures'
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'

const SCREENSHOTS_DIR = path.join(__dirname, '__screenshots__', 'profile-redesign-587-590')

// Consolidated /achievements/me/ payload that ALSO carries character +
// progression_lines (как реальный прод-эндпоинт). Засев кэшей (#588) делает
// отдельные /character/me/ и /progression/me/ ненужными.
const ACHIEVEMENTS_ME_DTO = {
  rank: { level: 2, title: 'Странник', total_points: 80, badges_count: 3 },
  rank_levels: [
    { level: 1, title: 'Новичок', min_points: 0 },
    { level: 2, title: 'Странник', min_points: 50 },
    { level: 3, title: 'Путешественник', min_points: 150 },
  ],
  earned_badges: [],
  progress: [],
  recently_earned: [],
  character: {
    user_id: 1,
    selected_path: {
      slug: 'dog',
      name: 'Собачья',
      activity_type: 'participant',
      activity_label: 'Участник',
      level: { level: 1, title: 'Щенок', min_score: 0 },
      next_level: { level: 2, title: 'Следопыт стаи', min_score: 25 },
    },
    switch_unlocked: false,
    available_paths: [],
    visual_details: [],
  },
  progression_lines: [
    {
      slug: 'dog',
      name: 'Собачья',
      activity_type: 'participant',
      activity_label: 'Участник',
      score: 1,
      level: { level: 1, title: 'Щенок', min_score: 0 },
      next_level: { level: 2, title: 'Следопыт стаи', min_score: 25 },
    },
  ],
}

interface Counters {
  characterMe: number
  progressionMe: number
}

async function mockApis(page: import('@playwright/test').Page, counters: Counters) {
  await page.route('**/api/**', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  })
  await page.route('**/api/metravel/**', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
    })
  })
  await page.route('**/api/subscriptions/**', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })
  await page.route('**/api/messages/**', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) })
  })

  await page.route('**/api/achievements/me/**', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ACHIEVEMENTS_ME_DTO) })
  })

  // Track the redundant endpoints — should NOT be hit once seeding works (#588).
  await page.route('**/api/achievements/character/me/**', (route) => {
    if (route.request().method() === 'GET') counters.characterMe += 1
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ACHIEVEMENTS_ME_DTO.character) })
  })
  await page.route('**/api/achievements/progression/me/**', (route) => {
    if (route.request().method() === 'GET') counters.progressionMe += 1
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ACHIEVEMENTS_ME_DTO.progression_lines) })
  })

  await page.route('**/api/achievements/place-badges/me/**', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })
  await page.route('**/api/achievements/rare-awards/me/**', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })
  await page.route('**/api/achievements/badges/**', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })
}

async function setup(page: import('@playwright/test').Page, counters: Counters) {
  await ensureAuthedStorageFallback(page)
  await mockFakeAuthApis(page)
  await mockApis(page, counters)
  await preacceptCookies(page)
}

async function openOverview(page: import('@playwright/test').Page) {
  const tab = page.getByRole('tab', { name: /Обзор/i })
  await tab.waitFor({ state: 'visible', timeout: 20_000 })
  await tab.click()
}

async function openStats(page: import('@playwright/test').Page) {
  const tab = page.getByRole('tab', { name: /Статистика/i })
  await tab.waitFor({ state: 'visible', timeout: 20_000 })
  await tab.click()
}

test.describe('Profile redesign #587-590', () => {
  test('#587 mobile — rank card is visible, explains rank and is clickable', async ({ page }) => {
    const counters: Counters = { characterMe: 0, progressionMe: 0 }
    await page.setViewportSize({ width: 390, height: 844 })
    await setup(page, counters)
    await gotoWithRetry(page, '/profile')
    await openOverview(page)

    const card = page.getByTestId('rank-progress-card')
    await card.waitFor({ state: 'visible', timeout: 20_000 })

    // Explains: rank title + "до следующего" copy
    await expect(card.getByText(/Ваш ранг/i)).toBeVisible()
    await expect(card.getByText(/Странник/)).toBeVisible()
    await expect(card.getByText(/До «Путешественник»/)).toBeVisible()
    await expect(card.getByText(/Зарабатывайте XP/)).toBeVisible()

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'mobile-rank-card.png') })

    // Clickable → opens AwardsHub "all" tab (panel content switches from default "path").
    const panel = page.getByTestId('awards-panel')
    const before = await panel.innerHTML()
    await card.getByText(/Подробнее/).click()
    await page.waitForTimeout(500)
    const after = await panel.innerHTML()
    expect(before, 'Подробнее should switch AwardsHub panel content').not.toBe(after)
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'mobile-rank-card-opened-all.png') })
  })

  test('#588 — opening Overview does NOT trigger redundant character/progression calls', async ({ page }) => {
    const counters: Counters = { characterMe: 0, progressionMe: 0 }
    await page.setViewportSize({ width: 390, height: 844 })
    await setup(page, counters)
    await gotoWithRetry(page, '/profile')
    await openOverview(page)

    // Wait for AwardsHub + default "Ваш путь" content to settle from seeded cache.
    const hub = page.getByTestId('awards-hub')
    await hub.waitFor({ state: 'visible', timeout: 20_000 })
    // path tab content (progression line) should render from seeded cache
    await expect(hub.getByText(/Тропы развития|Собачья|Щенок/i).first()).toBeVisible({ timeout: 10_000 })

    // Give any stray network a moment
    await page.waitForTimeout(1500)

    expect(
      counters.characterMe,
      'character/me should be seeded from achievements/me, not fetched',
    ).toBe(0)
    expect(
      counters.progressionMe,
      'progression/me should be seeded from achievements/me, not fetched',
    ).toBe(0)
  })

  test('#589 mobile — status tiles open calendar filtered by status', async ({ page }) => {
    const counters: Counters = { characterMe: 0, progressionMe: 0 }
    await page.setViewportSize({ width: 390, height: 844 })
    await setup(page, counters)
    await gotoWithRetry(page, '/profile')
    // /profile static build self-recovers from a React #419 (Suspense hydration)
    // — wait for it to settle before interacting so the click isn't swallowed by
    // the recovery re-render.
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(1500)

    await openStats(page)

    // Ensure PersonalStatusSummary card rendered
    await expect(page.getByText(/Мои статусы поездок/)).toBeVisible({ timeout: 20_000 })

    // "Были" tile (visited) inside the personal-status card. Engagement
    // metrics above use the same visible label and should not be clicked here.
    // Retry the click: the first tap can land during a hydration re-render.
    const visitedTile = page.getByTestId('personal-status-tile-visited')
    await expect(async () => {
      await visitedTile.scrollIntoViewIfNeeded()
      await visitedTile.click()
      await page.waitForTimeout(600)
      expect(page.url()).toMatch(/calendar/)
    }).toPass({ timeout: 20_000 })

    expect(page.url()).toMatch(/status=visited/)
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'mobile-tile-visited-calendar.png') })
  })

  test('#590 mobile — section headers render in Overview and Stats', async ({ page }) => {
    const counters: Counters = { characterMe: 0, progressionMe: 0 }
    await page.setViewportSize({ width: 390, height: 844 })
    await setup(page, counters)
    await gotoWithRetry(page, '/profile')

    await openOverview(page)
    await expect(page.getByText(/Награды и прогресс/).first()).toBeVisible({ timeout: 20_000 })
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'mobile-overview-headers.png'), fullPage: true })

    await openStats(page)
    await expect(page.getByText(/Статистика маршрутов/).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/Мои поездки/).first()).toBeVisible()
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'mobile-stats-headers.png'), fullPage: true })
  })
})
