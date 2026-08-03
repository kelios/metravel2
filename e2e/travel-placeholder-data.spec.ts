import { expect, test } from '@playwright/test'

import {
  FALLBACK_TRAVEL_SLUG,
  gotoWithRetry,
  mockFallbackTravelDetails,
  preacceptCookies,
} from './helpers/navigation'

const SHARP_IMAGE_URL = 'https://metravel.by/__e2e__/sharp-1127.png'
const LQIP_IMAGE_URL = 'https://metravel.by/__e2e__/lqip-1127.png'
const VISIBLE_BLURHASH = 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH'
const SHARP_IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNkYPj/n4GBgYGJAQoAHgQCAcKOB1YAAAAASUVORK5CYII=',
  'base64',
)

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile-web', width: 390, height: 844 },
] as const

for (const viewport of viewports) {
  test(`#1127 ${viewport.name}: local hero placeholder is data-only and suppresses LQIP fetch`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await preacceptCookies(page)

    let releaseSharpImage = () => {}
    const sharpImageGate = new Promise<void>((resolve) => {
      releaseSharpImage = resolve
    })
    let sharpRequests = 0
    let lqipRequests = 0

    page.on('request', (request) => {
      const url = request.url()
      if (url.includes('/__e2e__/sharp-1127.png')) sharpRequests += 1
      if (url.includes('/__e2e__/lqip-1127.png')) lqipRequests += 1
    })

    await page.route('**/__e2e__/sharp-1127.png**', async (route) => {
      await sharpImageGate
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: SHARP_IMAGE,
      })
    })
    await page.route('**/__e2e__/lqip-1127.png**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: SHARP_IMAGE,
      })
    })

    await mockFallbackTravelDetails(page, {
      travel_image_thumb_url: SHARP_IMAGE_URL,
      travel_image_thumb_small_url: SHARP_IMAGE_URL,
      gallery: [
        {
          id: 1,
          url: SHARP_IMAGE_URL,
          width: 1200,
          height: 800,
          updated_at: '2026-07-29T00:00:00.000Z',
        },
      ],
      media: {
        cover: {
          id: 1,
          blurhash: VISIBLE_BLURHASH,
          dominant_color: '#345678',
          lqip_url: LQIP_IMAGE_URL,
        },
        gallery: [
          {
            id: 1,
            blurhash: VISIBLE_BLURHASH,
            dominant_color: '#345678',
            lqip_url: LQIP_IMAGE_URL,
          },
        ],
      },
    } as any)

    try {
      await gotoWithRetry(page, `/travels/${FALLBACK_TRAVEL_SLUG}`, {
        waitUntil: 'domcontentloaded',
      })

      const details = page.locator('[data-testid="travel-details-page"]')
      const localPlaceholder = page.locator('[data-hero-data-placeholder="true"]').first()
      const placeholderLayer = page.getByTestId('travel-hero-data-placeholder')
      await expect(details).toBeVisible()
      await expect(localPlaceholder).toBeVisible()
      // Owner decision 2026-08-02 (#1208, docs/RULES.md): на web один снимок —
      // один растр. Подложка letterbox — это `dominant_color` из манифеста, а не
      // декодированный blurhash и не сетевой LQIP; blur-слой остался только на
      // native. Поэтому локальность подложки проверяем по заливке цветом и по
      // отсутствию второго растра, а не по загрузившемуся <img>.
      await expect(placeholderLayer).toHaveCSS('background-color', 'rgba(52, 86, 120, 0.75)')
      await expect(localPlaceholder.locator('img')).toHaveCount(0)
      await expect(page.getByTestId('travel-details-skeleton-overlay')).toHaveCSS(
        'opacity',
        '0',
      )
      const sharpImage = page.locator('img[data-lcp]')
      await expect(sharpImage).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      await expect
        .poll(() =>
          placeholderLayer.evaluate((layer) => {
            const host = layer.parentElement
            if (!host) return false
            const hostBounds = host.getBoundingClientRect()
            const layerBounds = layer.getBoundingClientRect()
            return (
              hostBounds.width > 0 &&
              hostBounds.height > 0 &&
              Math.abs(hostBounds.width - layerBounds.width) < 1 &&
              Math.abs(hostBounds.height - layerBounds.height) < 1
            )
          }),
        )
        .toBe(true)
      expect(lqipRequests).toBe(0)

      await page.screenshot({
        path: testInfo.outputPath(`task-1127-${viewport.name}-before-sharp.png`),
      })

      releaseSharpImage()

      await expect(sharpImage).toBeVisible()
      await expect
        .poll(
          () =>
            sharpImage.evaluate(
              (image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
            ),
          { timeout: 15_000 },
        )
        .toBe(true)

      expect(sharpRequests).toBeGreaterThan(0)
      expect(lqipRequests).toBe(0)
    } finally {
      releaseSharpImage()
    }
  })
}
