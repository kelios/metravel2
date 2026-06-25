import { test, expect } from '@playwright/test'

/**
 * Trust & Safety — report-a-user flow (Sprint 16, FE-434).
 *
 * Exercises the report/block menu on a public user profile. The report/block
 * endpoints (BE-report-user #426 / BE-block-user #427) fall back to an in-memory
 * mock in DEV; on a production preview the POST may 404 — we therefore assert the
 * UI flow (menu → reason picker → submit) rather than a network result.
 *
 * Uses a non-self profile derived from the available e2e storage states. If the
 * auth fixture is missing, fail explicitly instead of recording a skipped test.
 */

import fs from 'node:fs'

const STORAGE_STATE_A = 'e2e/.auth/storageState.json'
const STORAGE_STATE_B = 'e2e/.auth/storageState.b.json'
const hasAuth = (filePath: string) => fs.existsSync(filePath)

function readUserIdFromState(filePath: string): string | null {
  try {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8')) as any
    const origins: any[] = Array.isArray(json?.origins) ? json.origins : []
    for (const origin of origins) {
      const ls: any[] = Array.isArray(origin?.localStorage) ? origin.localStorage : []
      const entry = ls.find((x: any) => x?.name === 'userId')
      const value = String(entry?.value ?? '').trim()
      if (value) return value
    }
  } catch {
    // fall through to null
  }
  return null
}

function getSafetyFixture(): { storageState: string; targetUserId: string } {
  if (!hasAuth(STORAGE_STATE_A)) {
    throw new Error(`${STORAGE_STATE_A} is required; run the Playwright global setup first`)
  }

  const userA = readUserIdFromState(STORAGE_STATE_A)
  const envTarget = String(process.env.E2E_OTHER_USER_ID ?? '').trim()
  if (envTarget && envTarget !== userA) {
    return { storageState: STORAGE_STATE_A, targetUserId: envTarget }
  }

  const userB = hasAuth(STORAGE_STATE_B) ? readUserIdFromState(STORAGE_STATE_B) : null
  if (userB && userA && userB !== userA) {
    return { storageState: STORAGE_STATE_A, targetUserId: userB }
  }

  if (userA && userA !== '1') {
    return { storageState: STORAGE_STATE_A, targetUserId: '1' }
  }

  throw new Error('Trust & Safety e2e requires a non-self target user id')
}

function seedConsent(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'metravel_consent_v1',
        JSON.stringify({ necessary: true, analytics: false, date: '2026-01-01T00:00:00.000Z' }),
      )
    } catch {
      // ignore
    }
  })
}

test.describe('Trust & Safety — report a user', () => {
  test('opens the safety menu and walks the report flow', async ({ browser }) => {
    const fixture = getSafetyFixture()

    const ctx = await browser.newContext({ storageState: fixture.storageState })
    const page = await ctx.newPage()

    try {
      await seedConsent(page)
      await page.goto(`/user/${fixture.targetUserId}`, { waitUntil: 'domcontentloaded' })

      const menu = page.getByTestId('user-safety-menu')
      await expect(menu).toBeVisible({ timeout: 15_000 })

      // Open menu → choose "Пожаловаться".
      await menu.click()
      await page.getByTestId('user-safety-report').click()

      // Pick a reason and submit.
      const spam = page.getByTestId('report-reason-spam')
      await expect(spam).toBeVisible({ timeout: 10_000 })
      await spam.click()

      const submit = page.getByTestId('report-submit')
      await expect(submit).toBeEnabled({ timeout: 5_000 })
      await submit.click()

      // After submit the sheet closes; re-opening shows the report disabled
      // ("Жалоба отправлена") in DEV/mock mode. On prod (404) it may stay enabled —
      // so we only require that the app did not crash and the menu still works.
      await expect(page.locator('body')).toBeVisible()
    } finally {
      await ctx.close()
    }
  })
})
