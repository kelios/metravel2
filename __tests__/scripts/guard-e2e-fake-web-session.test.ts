import fs from 'node:fs'
import path from 'node:path'

import { makeTempDir, removeDir } from './cli-test-utils'

const {
  findFakeWebSessionViolation,
  collectViolations,
} = require('../../scripts/guard-e2e-fake-web-session')

describe('guard-e2e-fake-web-session', () => {
  it('flags a spec that seeds secure_userToken and hard-navigates into the /travel/<id> editor', () => {
    const source = `
      await page.addInitScript((token: string) => {
        window.localStorage.setItem('secure_userToken', token);
      }, apiCtx.token);
      await page.goto(\`/travel/\${travelId}\`, { waitUntil: 'domcontentloaded' });
    `
    expect(findFakeWebSessionViolation(source)).toBe(true)
  })

  it('does not flag the same navigation once ensureWebAuthCookie() is used', () => {
    const source = `
      await ensureWebAuthCookie(page, { url: String(baseURL), token: apiCtx.token, userId });
      await page.goto(\`/travel/\${travelId}\`, { waitUntil: 'domcontentloaded' });
    `
    expect(findFakeWebSessionViolation(source)).toBe(false)
  })

  it('does not flag secure_userToken seeding into /travel/new (#1932 does not cover named routes)', () => {
    const source = `
      window.localStorage.setItem('secure_userToken', payload.token);
      await page.goto('/travel/new', { waitUntil: 'domcontentloaded' });
    `
    expect(findFakeWebSessionViolation(source)).toBe(false)
  })

  it('does not flag a spec that only removes secure_userToken (cookie-session cleanup)', () => {
    const source = `
      window.localStorage.removeItem('secure_userToken');
      await page.goto(\`/travel/\${travelId}\`, { waitUntil: 'domcontentloaded' });
    `
    expect(findFakeWebSessionViolation(source)).toBe(false)
  })

  it('does not flag secure_userToken seeding paired with navigation to an unrelated route', () => {
    const source = `
      window.localStorage.setItem('secure_userToken', payload.token);
      await page.goto('/favorites', { waitUntil: 'domcontentloaded' });
    `
    expect(findFakeWebSessionViolation(source)).toBe(false)
  })

  it('flags a template-literal goto with an interpolated prefix before /travel/ (review finding #1954)', () => {
    // Reproduces the exact shape the guard previously missed: the literal
    // does not start with `/travel/` right after the backtick, it starts
    // with a `${baseURL}` interpolation.
    const source = `
      window.localStorage.setItem('secure_userToken', payload.token);
      await page.goto(\`\${baseURL}/travel/\${travelId}\`, { waitUntil: 'domcontentloaded' });
    `
    expect(findFakeWebSessionViolation(source)).toBe(true)
  })

  it('flags a goto through a bare variable resolved to an editor URL one hop back', () => {
    const source = `
      window.localStorage.setItem('secure_userToken', payload.token);
      const editUrl = \`/travel/\${travelId}\`;
      await page.goto(editUrl, { waitUntil: 'domcontentloaded' });
    `
    expect(findFakeWebSessionViolation(source)).toBe(true)
  })

  it('does not flag a bare-variable goto whose assignment targets /travel/new', () => {
    const source = `
      window.localStorage.setItem('secure_userToken', payload.token);
      const newUrl = \`/travel/new?id=\${travelId}\`;
      await page.goto(newUrl, { waitUntil: 'domcontentloaded' });
    `
    expect(findFakeWebSessionViolation(source)).toBe(false)
  })

  it('does not flag a template-literal goto with an interpolated prefix once ensureWebAuthCookie() is used', () => {
    const source = `
      await ensureWebAuthCookie(page, { url: String(baseURL), token: apiCtx.token, userId });
      await page.goto(\`\${baseURL}/travel/\${travelId}\`, { waitUntil: 'domcontentloaded' });
    `
    expect(findFakeWebSessionViolation(source)).toBe(false)
  })

  it('documents the accepted file-wide ensureWebAuthCookie scope gap (KNOWN LIMITATION, not silent coverage)', () => {
    // Two independent test bodies in one file: the first is migrated to a
    // real cookie session, the second still reproduces the exact anti-
    // pattern this guard exists to catch. The guard currently checks for
    // `ensureWebAuthCookie` file-wide rather than per test/function, so this
    // case is NOT caught. This test exists so that gap is an explicit,
    // reviewed fact rather than a silent blind spot — see the "KNOWN
    // LIMITATION" comment in scripts/guard-e2e-fake-web-session.js. If this
    // assertion ever needs to flip to `true`, the guard has grown per-scope
    // detection and this test (and the file comment) should be updated
    // together, not deleted.
    const source = `
      test('already fixed', async ({ page, baseURL }) => {
        await ensureWebAuthCookie(page, { url: String(baseURL), token: apiCtx.token, userId });
        await page.goto(\`/travel/\${fixedTravelId}\`, { waitUntil: 'domcontentloaded' });
      });

      test('still vulnerable', async ({ page }) => {
        window.localStorage.setItem('secure_userToken', payload.token);
        await page.goto(\`/travel/\${otherTravelId}\`, { waitUntil: 'domcontentloaded' });
      });
    `
    expect(findFakeWebSessionViolation(source)).toBe(false)
  })

  it('catches a brand-new spec reproducing the anti-pattern (regression control, not a file list)', () => {
    const root = makeTempDir('guard-e2e-fake-web-session-')
    try {
      fs.mkdirSync(path.join(root, 'e2e'), { recursive: true })
      fs.writeFileSync(
        path.join(root, 'e2e/new-editor-fake-login.spec.ts'),
        [
          "import { test, expect } from '@playwright/test';",
          "test('bad', async ({ page }) => {",
          "  await page.addInitScript((token: string) => {",
          "    window.localStorage.setItem('secure_userToken', token);",
          "  }, 'fake-token');",
          '  await page.goto(`/travel/${123}`, { waitUntil: "domcontentloaded" });',
          '});',
          '',
        ].join('\n'),
      )

      expect(collectViolations(root)).toEqual(['e2e/new-editor-fake-login.spec.ts'])
    } finally {
      removeDir(root)
    }
  })

  it('is clean on the real e2e tree (metravel-edit-delete.spec.ts and travel-content-save-delta.spec.ts migrated)', () => {
    expect(collectViolations(process.cwd())).toEqual([])
  })
})
