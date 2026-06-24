import { test, expect } from '@playwright/test'

// #539 verification — tapping a place card on mobile must surface the bottom card.
test('mobile map card tap shows place bottom card', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  const focusCalls: string[] = []
  await page.exposeFunction('__recordFocus', (coord: string) => {
    focusCalls.push(coord)
  })

  await page.goto('/map', { waitUntil: 'domcontentloaded' })

  // Wait for the mobile layout to mount.
  await page.getByTestId('map-mobile-layout').waitFor({ timeout: 60_000 })

  // Open the list sheet (bottom "places" button) then wait for a card.
  // The list may already be expanded; try to find a card first.
  const card = page.getByTestId('map-travel-card').first()
  await card.waitFor({ timeout: 60_000 })

  await card.click()

  // The bottom card for the selected place must appear.
  await expect(page.getByTestId('map-place-bottom-card')).toBeVisible({ timeout: 10_000 })
})
