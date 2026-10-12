import { test, expect } from './fixtures'
import type { Locator } from '@playwright/test'
import type { Page } from '@playwright/test'
import { preacceptCookies } from './helpers/navigation'

// Visibility alone does not detect content clipped by nested book frames.
async function clipping(locator: Locator) {
  return locator.evaluate((node) => {
    const box = node.getBoundingClientRect()
    let left = Math.max(0, box.left), top = Math.max(0, box.top)
    let right = Math.min(innerWidth, box.right), bottom = Math.min(innerHeight, box.bottom)
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const css = getComputedStyle(parent), rect = parent.getBoundingClientRect()
      if (/(auto|scroll|hidden|clip)/.test(css.overflowX)) {
        left = Math.max(left, rect.left + parent.clientLeft)
        right = Math.min(right, rect.left + parent.clientLeft + parent.clientWidth)
      }
      if (/(auto|scroll|hidden|clip)/.test(css.overflowY)) {
        top = Math.max(top, rect.top + parent.clientTop)
        bottom = Math.min(bottom, rect.top + parent.clientTop + parent.clientHeight)
      }
    }
    const area = box.width * box.height
    return { clipped: area ? 1 - Math.max(0, right - left) * Math.max(0, bottom - top) / area : 1, width: box.width, height: box.height }
  })
}

async function revealWithWheel(page: Page, frame: Locator, element: Locator) {
  for (let step = 0; step < 12; step += 1) {
    if ((await clipping(element)).clipped < 0.01) return
    const paper = (await frame.boundingBox())!, target = (await element.boundingBox())!
    const previousScroll = await frame.evaluate(node => node.scrollTop)
    await page.mouse.move(paper.x + paper.width / 2, paper.y + paper.height / 2)
    await page.mouse.wheel(0, target.y < paper.y ? -200 : 200)
    await expect.poll(() => frame.evaluate(node => node.scrollTop)).not.toBe(previousScroll)
  }
}

for (const viewport of [{ width: 2048, height: 900 }, { width: 2560, height: 640 }]) {
  test(`book content can be normally revealed and clicked at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await preacceptCookies(page)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const frame = page.getByTestId('home-hero-left-frame')
    await expect(frame).toBeVisible()
    expect(await frame.evaluate((node) => getComputedStyle(node).overflowY)).toBe('auto')
    const pageContent = page.getByTestId('home-hero-left-page')
    const mandatory = [pageContent.getByRole('heading', { level: 1 }), pageContent.getByTestId('home-hero-subtitle'), pageContent.getByRole('searchbox'), pageContent.getByRole('button', { name: 'Смотреть маршруты', exact: true })]
    for (const element of mandatory) {
      await revealWithWheel(page, frame, element)
      await expect.poll(async () => (await clipping(element)).clipped).toBeLessThan(0.01)
    }
    const input = pageContent.getByRole('searchbox')
    await input.focus() // Normal focus must reveal an off-screen control.
    await expect.poll(async () => (await clipping(input)).clipped).toBeLessThan(0.01)
    await input.click()
    expect((await clipping(input)).height).toBeGreaterThanOrEqual(44)
    await input.fill('Краков')
    await expect(input).toHaveValue('Краков')
    const action = mandatory[3]
    await action.focus()
    await expect.poll(async () => (await clipping(action)).clipped).toBeLessThan(0.01)
    expect((await clipping(action)).height).toBeGreaterThanOrEqual(44)
    expect(await pageContent.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: test.info().outputPath('book-revealed.png') })
    await action.click()
    await expect(page).toHaveURL(/\/search/)
    expect(errors).toEqual([])
  })
}

test('book responds to height-only resize without reload', async ({ page }) => {
  await page.setViewportSize({ width: 2048, height: 900 })
  await preacceptCookies(page)
  await page.goto('/')
  const frame = page.getByTestId('home-hero-left-frame')
  await expect(frame).toBeVisible()
  const original = (await frame.boundingBox())!.height
  await page.setViewportSize({ width: 2048, height: 640 })
  await expect.poll(async () => (await frame.boundingBox())!.height).toBeLessThan(original)
  const action = page.getByTestId('home-hero-left-page').getByRole('button', { name: 'Смотреть маршруты', exact: true })
  await action.focus()
  await expect.poll(async () => (await clipping(action)).clipped).toBeLessThan(0.01)
  await page.setViewportSize({ width: 2048, height: 900 })
  await expect.poll(async () => (await frame.boundingBox())!.height).toBeCloseTo(original, 0)
})

// The visible field must be the real target: a click near its top edge has to
// focus the input on narrow/mobile variants too, not only on the paper book.
for (const viewport of [{ width: 1440, height: 900 }, { width: 1279, height: 900 }, { width: 390, height: 844 }]) {
  test(`search field edge click focuses the input at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await preacceptCookies(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const input = page.getByRole('searchbox').first()
    await expect(input).toBeVisible()
    await input.scrollIntoViewIfNeeded()
    const field = (await input.locator('xpath=..').boundingBox())!
    const box = (await input.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    await page.mouse.click(box.x + 30, field.y + 4)
    await expect(input).toBeFocused()
  })
}
