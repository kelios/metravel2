import fs from 'node:fs'
import path from 'node:path'

import { makeTempDir, removeDir } from './cli-test-utils'

const {
  TARGET_ZERO_FILES,
  collectWaitForTimeoutCounts,
  countWaitForTimeoutCalls,
  findViolations,
} = require('../../scripts/guard-e2e-wait-for-timeout')

describe('guard-e2e-wait-for-timeout', () => {
  it('counts Playwright hard waits without matching comments', () => {
    expect(countWaitForTimeoutCalls(`
      // await page.waitForTimeout(1000)
      /* await page.waitForTimeout(2000) */
      const api = 'http://localhost:8081'
      await page.waitForSelector('[data-ready="true"]')
      await page.waitForTimeout(50)
      await locator.page().waitForTimeout(100)
    `)).toBe(2)
  })

  it('fails a new e2e file that adds a hard wait', () => {
    const root = makeTempDir('guard-e2e-wait-')
    try {
      fs.mkdirSync(path.join(root, 'e2e'), { recursive: true })
      fs.writeFileSync(
        path.join(root, 'e2e/new-hard-wait.spec.ts'),
        "test('bad', async ({ page }) => { await page.waitForTimeout(1000) })\n",
      )

      const counts = collectWaitForTimeoutCounts(root)

      expect(findViolations(counts)).toEqual([
        'e2e/new-hard-wait.spec.ts: 1 waitForTimeout calls, allowed 0',
      ])
    } finally {
      removeDir(root)
    }
  })

  it('keeps the three task #1832 files at zero hard waits', () => {
    const counts = collectWaitForTimeoutCounts(process.cwd())

    expect(TARGET_ZERO_FILES.map((file: string) => [file, counts[file] ?? 0])).toEqual([
      ['e2e/slider-comprehensive.spec.ts', 0],
      ['e2e/slider-swipe.spec.ts', 0],
      ['e2e/travel-wizard.spec.ts', 0],
    ])
    expect(findViolations(counts)).toEqual([])
  })
})
