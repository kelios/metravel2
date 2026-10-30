import { expect, type Page } from '@playwright/test'

/** The eager dock works before its optional sheet controller has loaded. */
export async function waitForMoreSheetController(page: Page): Promise<void> {
  await expect(page.getByTestId('footer-more-controller')).toBeAttached({ timeout: 30_000 })
}

/** Account is a permanent responsive slot; its controls load after hydration. */
export async function waitForRuntimeHeader(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveClass(/\bapp-hydrated\b/, { timeout: 30_000 })
  // Stack navigation retains the previous screen under aria-hidden while its
  // header still satisfies Playwright's geometric :visible.
  const header = page.locator(
    '[data-testid="main-header"]:visible:not([aria-hidden="true"]):not([aria-hidden="true"] *)',
  )
  await expect(header).toHaveCount(1, { timeout: 30_000 })
  await expect(header.locator('[data-header-context-fallback]')).toHaveCount(0, { timeout: 30_000 })
  // Nested phone screens intentionally remove the whole brand/account row.
  if (await header.getByTestId('main-header-row').count() === 0) return
  await expect(
    header.locator(
      '[data-testid="account-menu-anchor"]:visible, [data-testid="mobile-menu-open"]:visible',
    ),
  ).toHaveCount(1, { timeout: 30_000 })
}
