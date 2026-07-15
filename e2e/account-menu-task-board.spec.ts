import { test, expect } from './fixtures'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth'

// Пункт "Борд задач" в меню аккаунта (components/layout/AccountMenu.tsx) виден
// только супер-админу (authStore.isSuperuser). Обычному юзеру и гостю — нет.

const getAccountAnchor = (page: any) =>
  page
    .locator('[data-testid="account-menu-anchor"]:visible')
    .or(page.getByRole('button', { name: /Открыть меню аккаунта/i }))
    .first()

const isMissingRouteShell = async (page: any) => {
  const text = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '')
  return /Страница не найдена|Not found/i.test(text)
}

const waitForAccountAnchor = async (page: any) => {
  let anchor = getAccountAnchor(page)
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const visible = await anchor.waitFor({ state: 'visible', timeout: attempt === 0 ? 1500 : 5000 })
      .then(() => true)
      .catch(() => false)
    if (visible) return anchor

    if (await isMissingRouteShell(page)) {
      await gotoWithRetry(page, '/', { timeout: 60_000, maxAttempts: 2 })
    } else {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 })
    }
    anchor = getAccountAnchor(page)
  }
  await expect(anchor, `account menu anchor did not render after route stabilization; url=${page.url()}`)
    .toBeVisible({ timeout: 15_000 })
  return anchor
}

const openAccountMenu = async (page: any) => {
  const anchor = await waitForAccountAnchor(page)

  await anchor.hover().catch(() => null)
  await anchor.focus().catch(() => null)
  await anchor.click()

  const menu = page.getByTestId('web-menu-panel')
  await expect(menu).toBeVisible({ timeout: 10_000 })
  return menu
}

const menuAction = (page: any, name: string) =>
  page.getByTestId('web-menu-panel').getByRole('button', { name, exact: true })

const taskBoardItem = (page: any) => menuAction(page, 'Борд задач')

test.describe('@smoke AccountMenu: task-board item visibility', () => {
  test('superuser sees the task-board item', async ({ page }) => {
    await ensureAuthedStorageFallback(page, { isSuperuser: true })
    await mockFakeAuthApis(page)

    await page.setViewportSize({ width: 1280, height: 720 })
    await preacceptCookies(page)
    await gotoWithRetry(page, '/', { waitUntil: 'domcontentloaded', timeout: 60_000, attempts: 4 })

    await openAccountMenu(page)

    await expect(taskBoardItem(page)).toBeVisible({ timeout: 10_000 })
    // sanity: regular account items are present too
    await expect(menuAction(page, 'Выход')).toBeVisible()
  })

  test('regular authenticated user does NOT see the task-board item', async ({ page }) => {
    await ensureAuthedStorageFallback(page) // isSuperuser='false'
    await mockFakeAuthApis(page)

    await page.setViewportSize({ width: 1280, height: 720 })
    await preacceptCookies(page)
    await gotoWithRetry(page, '/', { waitUntil: 'domcontentloaded', timeout: 60_000, attempts: 4 })

    await openAccountMenu(page)

    // account menu is open (Выход present), but no task-board entry
    await expect(menuAction(page, 'Выход')).toBeVisible({ timeout: 10_000 })
    await expect(taskBoardItem(page)).toHaveCount(0)
  })
})

test.describe('@smoke AccountMenu: task-board item hidden for guest', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('guest does NOT see the task-board item', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await preacceptCookies(page)
    await gotoWithRetry(page, '/', { waitUntil: 'domcontentloaded', timeout: 60_000, attempts: 4 })

    await openAccountMenu(page)

    // guest menu shows login entry, never the task board
    await expect(menuAction(page, 'Войти')).toBeVisible({ timeout: 10_000 })
    await expect(taskBoardItem(page)).toHaveCount(0)
  })
})
