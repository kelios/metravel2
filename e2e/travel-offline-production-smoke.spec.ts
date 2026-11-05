import { expect, test } from '@playwright/test'
import { preacceptCookies } from './helpers/navigation'

const TRAVEL = '/travels/karer-v-zabezhuve-velomarshrut-iz-krakova-na-21-km'

test.use({ storageState: { cookies: [], origins: [] } })

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  test(`saved travel opens from the loaded library offline ${viewport.width} (#3066)`, async ({ page, context }, testInfo) => {
    const pageErrors: string[] = []
    const consoleErrors: string[] = []
    const failedRequests: Array<{ path: string; error: string | undefined }> = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    page.on('requestfailed', (request) => failedRequests.push({
      path: new URL(request.url()).pathname,
      error: request.failure()?.errorText,
    }))
    await page.setViewportSize(viewport)
    await preacceptCookies(page)
    await page.goto(TRAVEL, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('offline-save-chip')).toBeVisible({ timeout: 60_000 })
    const heading = await page.getByRole('heading', { level: 1 }).innerText()
    await page.getByTestId('offline-save-chip').click()
    await page.getByText('Текст, точки и маршрут', { exact: true }).click()
    await expect(page.getByTestId('offline-save-chip')).toHaveAttribute('aria-label', 'Сохранено офлайн')
    // Read the real saved payload without warming the deferred points UI online.
    const pointLabel = await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('metravel-offline-v1')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        return await new Promise<string>((resolve, reject) => {
          const request = database.transaction('packages', 'readonly').objectStore('packages').get('travel:765')
          request.onsuccess = () => {
            const point = request.result?.snapshot?.travelAddress?.[0]
            resolve(typeof point === 'string' ? point : point?.address || point?.name || '')
          }
          request.onerror = () => reject(request.error)
        })
      } finally { database.close() }
    })
    expect(pointLabel.trim().length).toBeGreaterThan(0)
    const description = page.getByTestId('travel-details-description')
    await description.scrollIntoViewIfNeeded()
    await expect(description).toBeVisible()
    await expect(description.getByText(/^Месяц поездки:/)).toBeVisible()
    const paragraph = (await description.locator('p').first().innerText()).trim()
    expect(paragraph.length).toBeGreaterThan(20)

    // A new library document still has the public package persisted by the real UI.
    await page.goto('/offline', { waitUntil: 'domcontentloaded' })
    const card = page.getByTestId('offline-item-travel:765')
    await expect(card).toContainText('Доступно офлайн', { timeout: 30_000 })
    await context.setOffline(true)
    try {
      await card.getByRole('button', { name: 'Открыть', exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`${TRAVEL}$`))
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading, { timeout: 45_000 })
      await description.scrollIntoViewIfNeeded()
      await expect(description).toContainText(paragraph)
      const points = page.getByTestId('travel-details-points')
      await points.scrollIntoViewIfNeeded()
      await expect(points).toContainText(pointLabel)
      await expect(page.getByText('Не удалось загрузить страницу', { exact: true })).toBeHidden()
      await page.screenshot({ path: testInfo.outputPath(`offline-${viewport.width}.png`) })
    } finally {
      await context.setOffline(false)
      await testInfo.attach('browser-observations', {
        contentType: 'application/json',
        body: JSON.stringify({ pageErrors, consoleErrors, failedRequests }),
      })
    }
    expect(pageErrors).toEqual([])
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading)
    await expect(description).toContainText(paragraph)
  })
}

test('guest profile owns its title after map/search navigation and Back (#3068)', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await preacceptCookies(page)
  for (const source of ['/map', '/search']) {
    await page.goto(source, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('footer-item-profile')).toBeVisible({ timeout: 60_000 })
    const title = await page.title()
    await page.getByTestId('footer-item-profile').click()
    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByText('Ваш профиль', { exact: true })).toBeVisible()
    await expect(page).toHaveTitle('Профиль | Metravel')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
    await page.screenshot({ path: testInfo.outputPath(`profile-from-${source.slice(1)}.png`) })
    await page.goBack()
    await expect(page).toHaveURL(new RegExp(`${source}$`))
    await expect(page).toHaveTitle(title)
  }
})
