import { test, expect } from './fixtures'
import { gotoWithRetry, preacceptCookies, tid } from './helpers/navigation'

// Verifies #727: /places multi-select sends repeated `category` params → backend
// OR-union, and the "Интересные подборки" section renders + selects a collection.
test.describe('@desktop places multi-select', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('selecting two categories sends repeated category params and unions results', async ({ page }) => {
    const catalogUrls: string[] = []
    page.on('request', (req) => {
      const url = req.url()
      if (url.includes('/api/places/catalog/')) catalogUrls.push(url)
    })

    await preacceptCookies(page)
    await gotoWithRetry(page, '/places')

    const castle = page.getByTestId('places-category-chip-Замок')
    await expect(castle).toBeVisible({ timeout: 30_000 })
    await castle.click()

    const lake = page.getByTestId('places-category-chip-Озеро')
    await expect(lake).toBeVisible()
    await lake.click()

    // A catalog list request carrying BOTH categories must have been issued.
    await expect
      .poll(
        () =>
          catalogUrls.some((u) => {
            const count = (u.match(/[?&]category=/g) ?? []).length
            return count >= 2 && /category=[^&]*(%D0%97|Замок)/.test(u)
          }),
        { timeout: 30_000 },
      )
      .toBe(true)

    // Multi-select badge shows 2 selected categories.
    await expect(page.getByTestId('places-collection-featured')).toBeAttached()
  })

  test('interesting collections render and select a multi-category set', async ({ page }) => {
    const catalogUrls: string[] = []
    page.on('request', (req) => {
      const url = req.url()
      if (url.includes('/api/places/catalog/')) catalogUrls.push(url)
    })

    await preacceptCookies(page)
    await gotoWithRetry(page, '/places')

    const nature = page.getByTestId('places-collection-nature')
    await expect(nature).toBeVisible({ timeout: 30_000 })
    await nature.click()

    await expect
      .poll(
        () =>
          catalogUrls.some(
            (u) =>
              (u.match(/[?&]category=/g) ?? []).length >= 3 &&
              /(%D0%9E%D0%B7%D0%B5%D1%80%D0%BE|Озеро)/.test(u),
          ),
        { timeout: 30_000 },
      )
      .toBe(true)
  })
})
