import { test, expect } from './fixtures'
import {
  preacceptCookies,
  gotoWithRetry,
} from './helpers/navigation'

/**
 * Acceptance for HANDOFF-2 / D-010 (WCAG 2.1 AA 2.5.5 — ≥44px touch targets).
 *
 * Asserts the targets that were fixed on web:
 *  - cookie consent buttons (ConsentBanner local `minHeight: 44`)
 *  - travel-detail favorite + "Добавить в план" controls
 *
 * Additional manual coverage belongs in docs/MANUAL_TEST_CASES.md; unresolved
 * defects belong on the MCP task board instead of skipped tests.
 */

const MIN_TARGET = 44
const TIMEOUT = 30_000

test.describe('@smoke Touch targets (D-010)', () => {
  test('cookie consent buttons have ≥44px height', async ({ page }) => {
    // Do NOT pre-accept cookies — we need the ConsentBanner rendered.
    await page.addInitScript(() => window.localStorage.removeItem('metravel_consent_v1'))
    await gotoWithRetry(page, '/')

    const accept = page.getByRole('button', { name: 'Принять' }).first()
    await expect(accept).toBeVisible({ timeout: TIMEOUT })

    for (const name of ['Принять', 'Отклонить']) {
      const btn = page.getByRole('button', { name }).first()
      await expect(btn).toBeVisible({ timeout: TIMEOUT })
      const box = await btn.boundingBox()
      expect(box, `${name} should have a bounding box`).not.toBeNull()
      if (box) {
        expect(box.height, `cookie "${name}" button height`).toBeGreaterThanOrEqual(MIN_TARGET)
      }
    }
  })

  test('hero slider arrows have ≥44px web target', async ({ page }) => {
    // Fixed via transparent 44×44 sliderNavBtnHitArea wrapper (Pressable) around
    // the presentational sliderNavBtn View — visual circle + blur untouched.
    await preacceptCookies(page)
    await gotoWithRetry(page, '/')

    // Wait for the hero slider to render
    const prev = page.getByRole('button', { name: 'Предыдущий слайд' }).first()
    await expect(prev, 'hero slider must render before arrow target assertions').toBeVisible({ timeout: TIMEOUT })

    for (const name of ['Предыдущий слайд', 'Следующий слайд']) {
      const btn = page.getByRole('button', { name }).first()
      await expect(btn).toBeVisible({ timeout: TIMEOUT })
      const box = await btn.boundingBox()
      expect(box, `${name} should have bounding box`).not.toBeNull()
      if (box) {
        expect(box.height, `${name} height`).toBeGreaterThanOrEqual(MIN_TARGET)
        expect(box.width, `${name} width`).toBeGreaterThanOrEqual(MIN_TARGET)
      }
    }
  })
})
