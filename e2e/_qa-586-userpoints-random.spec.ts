import { test, expect } from '@playwright/test'

const BASE = process.env.QA_BASE || 'http://localhost:8081'

test.use({ viewport: { width: 390, height: 844 } })

test('#586 «Мои точки»: случайный выбор подписан понятно', async ({ page }) => {
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message))

  await page.goto(`${BASE}/userpoints`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)

  const consent = page.getByText('Принять всё', { exact: true }).first()
  if (await consent.isVisible().catch(() => false)) {
    await consent.click().catch(() => {})
    await page.waitForTimeout(400)
  }

  // Дождаться загрузки точек: ждём появления таб-бара «Карта/Список/Фильтры».
  await page
    .getByText('Карта', { exact: true })
    .first()
    .waitFor({ state: 'visible', timeout: 30000 })
    .catch(() => {})
  await page.waitForTimeout(1500)

  // На мобильном кнопка случайного выбора живёт во вкладке «Фильтры».
  const filtersTab = page.getByText('Фильтры', { exact: true }).first()
  if (await filtersTab.isVisible().catch(() => false)) {
    await filtersTab.click().catch(() => {})
    await page.waitForTimeout(2000)
  }

  await page.screenshot({ path: 'e2e/__screenshots__/qa-586-random-section.png', fullPage: true })

  const randomTitle = page.getByText('Куда поехать? Решим за вас', { exact: false }).first()
  const randomBtn = page.getByText('случайные точки', { exact: false }).first()
  const eyebrow = page.getByText('Случайный выбор', { exact: false }).first()

  const titleVisible = await randomTitle.isVisible().catch(() => false)
  const btnVisible = await randomBtn.isVisible().catch(() => false)
  const eyebrowVisible = await eyebrow.isVisible().catch(() => false)
  console.log('QA586 title=', titleVisible, 'btn=', btnVisible, 'eyebrow=', eyebrowVisible)

  expect(titleVisible || btnVisible || eyebrowVisible).toBeTruthy()
})
