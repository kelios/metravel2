import { test, expect } from './fixtures'
import {
  preacceptCookies,
  gotoWithRetry,
  openFallbackTravelDetails,
} from './helpers/navigation'

/**
 * Acceptance for HANDOFF-2 / D-010 (WCAG 2.1 AA 2.5.5 — ≥44px touch targets).
 *
 * Asserts the targets that were fixed on web:
 *  - cookie consent buttons (ConsentBanner local `minHeight: 44`)
 *  - travel-detail favorite + "Добавить в план" controls
 *
 * Deferred web targets are tracked in docs/DESIGN_HANDOFF_2026-06-02.md instead of
 * being encoded as skipped tests in this suite.
 */

const MIN_TARGET = 44
const TIMEOUT = 30_000

const annotate = (description: string) =>
  test.info().annotations.push({ type: 'note', description })

test.describe('@smoke Touch targets (D-010)', () => {
  test('cookie consent buttons have ≥44px height', async ({ page }) => {
    // Do NOT pre-accept cookies — we need the ConsentBanner rendered.
    await gotoWithRetry(page, '/')

    const accept = page.getByRole('button', { name: 'Принять' }).first()
    const bannerVisible = await accept
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch(() => false)

    if (!bannerVisible) {
      annotate('Cookie consent banner not shown in this environment (consent already set); nothing to assert')
      return
    }

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

  test('travel-detail favorite + plan controls have ≥44px target', async ({ page }) => {
    await preacceptCookies(page)

    const opened = await openFallbackTravelDetails(page)
    if (!opened) {
      annotate('Fallback travel details did not render in this environment; nothing to assert')
      return
    }

    // Favorite (heart) — FavoriteButton web min-size raised 40 → 44.
    const favorite = page
      .getByRole('button', { name: /Добавить в «Хочу поехать»|Удалить из «Хочу поехать»/i })
      .first()
    if (await favorite.isVisible().catch(() => false)) {
      const box = await favorite.boundingBox()
      expect(box).not.toBeNull()
      if (box) {
        expect(box.height, 'favorite button height').toBeGreaterThanOrEqual(MIN_TARGET)
        expect(box.width, 'favorite button width').toBeGreaterThanOrEqual(MIN_TARGET)
      }
    } else {
      annotate('Favorite control not present on this travel-detail variant')
    }

    // "Добавить в план" status button — already ≥44 (minHeight 44 + hitSlop).
    const planBtn = page.getByRole('button', { name: /Добавить в план|Был здесь|Планирую/i }).first()
    if (await planBtn.isVisible().catch(() => false)) {
      const box = await planBtn.boundingBox()
      expect(box).not.toBeNull()
      if (box) {
        expect(box.height, '"Добавить в план" height').toBeGreaterThanOrEqual(MIN_TARGET)
      }
    } else {
      annotate('Plan/status control not present on this travel-detail variant')
    }
  })

  test('travel-card overlay favorite has ≥44px web target', async ({ page }) => {
    // Fixed via an absolute transparent 44×44 hit-area over the presentational circle
    // (OptimizedFavoriteButton web branch) — zero layout shift, visible circle unchanged.
    await preacceptCookies(page)
    await gotoWithRetry(page, '/search')
    const overlayFav = page
      .getByRole('button', { name: /Добавить в «Хочу поехать»|Удалить из «Хочу поехать»/i })
      .first()
    const visible = await overlayFav
      .waitFor({ state: 'visible', timeout: TIMEOUT })
      .then(() => true)
      .catch(() => false)
    if (!visible) {
      annotate('No travel cards in this environment; overlay favorite not present')
      return
    }
    const box = await overlayFav.boundingBox()
    expect(box).not.toBeNull()
    if (box) {
      expect(box.height, 'overlay favorite height').toBeGreaterThanOrEqual(MIN_TARGET)
      expect(box.width, 'overlay favorite width').toBeGreaterThanOrEqual(MIN_TARGET)
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
