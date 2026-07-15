import type { Locator, Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { gotoWithRetry, preacceptCookies } from './helpers/navigation'

const CONSENT_KEY = 'metravel_consent_v1'

const waitForMetaContent = async (page: Page, selector: string) => {
  await page.waitForFunction(
    (resolvedSelector) => {
      const element = document.querySelector(resolvedSelector)
      const content = element?.getAttribute('content')
      return typeof content === 'string' && content.trim().length > 0
    },
    selector,
    { timeout: 20_000 }
  )

  return page.locator(selector).getAttribute('content')
}

const expectOneVisible = async (locators: Locator[], timeout = 20_000) => {
  await Promise.any(
    locators.map((locator) => locator.waitFor({ state: 'visible', timeout }))
  )
}

const expectCanonicalPath = async (page: Page, path: string) => {
  const canonicalLinks = page.locator('link[rel="canonical"]')
  await expect
    .poll(
      async () => {
        const hrefs = await canonicalLinks.evaluateAll((links) =>
          links.map((link) => link.getAttribute('href')).filter(Boolean)
        )
        return hrefs.some((href) => href?.includes(path))
      },
      { timeout: 20_000, message: `canonical link for ${path} should be present` },
    )
    .toBe(true)
}

test.describe('@smoke Public regressions', () => {
  test.beforeEach(async ({ page }) => {
    await preacceptCookies(page)
  })

  test('unknown route shows noindex not-found screen and lets user recover', async ({ page }) => {
    await gotoWithRetry(page, '/this-page-does-not-exist-12345')

    await expect(page.getByText('Страница не найдена')).toBeVisible({ timeout: 15_000 })

    const robots = await waitForMetaContent(page, 'meta[name="robots"]')
    expect(robots).toContain('noindex')

    await page.getByRole('link', { name: 'На главную' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('guest auth surfaces expose login and registration pages', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await gotoWithRetry(page, '/')

    await expect(
      page.getByTestId('account-menu-anchor').or(page.getByRole('button', { name: /Открыть меню аккаунта/i })).first()
    ).toBeVisible({ timeout: 15_000 })

    await gotoWithRetry(page, '/login')

    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('button', { name: 'Войти через Google' }).first()).toBeVisible({ timeout: 15_000 })

    await page.getByText('Зарегистрируйтесь', { exact: true }).click()
    await expect(page).toHaveURL(/\/registration/)

    const robots = await waitForMetaContent(page, 'meta[name="robots"]')
    expect(robots).toContain('noindex')
    await expectCanonicalPath(page, '/registration')
  })

  test('legal pages expose canonical SEO and main content', async ({ page }) => {
    const cases = [
      {
        path: '/about',
        title: /О проекте MeTravel/i,
        content: [page.getByText(/О проекте MeTravel/i).first(), page.getByText(/MeTravel/i).first()],
      },
      {
        path: '/privacy',
        title: /Политика конфиденциальности/i,
        content: [page.getByText(/Политика конфиденциальности/i).first()],
      },
      {
        path: '/cookies',
        title: /Настройки cookies/i,
        content: [page.getByText(/Настройки cookies и аналитики/i).first()],
      },
    ]

    for (const current of cases) {
      await gotoWithRetry(page, current.path)
      await expect(page).toHaveTitle(current.title)
      await expectCanonicalPath(page, current.path)
      await expectOneVisible(current.content)
    }
  })
})

test.describe('@smoke Cookie consent', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('accepting consent hides the banner and persists analytics preference', async ({ page }) => {
    await page.addInitScript((consentKey) => {
      try {
        window.localStorage.removeItem(consentKey)
      } catch {
        // ignore
      }
    }, CONSENT_KEY)

    await gotoWithRetry(page, '/')

    const consentBanner = page.getByTestId('consent-banner')
    await expect(consentBanner).toBeVisible({ timeout: 15_000 })

    await consentBanner.getByRole('button', { name: 'Принять' }).click()
    await expect(consentBanner).toBeHidden({ timeout: 5_000 })

    const storedConsent = await page.evaluate((consentKey) => {
      const raw = window.localStorage.getItem(consentKey)
      if (!raw) return null

      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    }, CONSENT_KEY)

    expect(storedConsent).toMatchObject({ necessary: true, analytics: true })
  })
})
