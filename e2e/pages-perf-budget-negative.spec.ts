/**
 * Негативная проба гейта бюджетов (#1287).
 *
 * Позитивный прогон доказывает только, что сегодня всё в порядке. Он не
 * доказывает, что гейт вообще способен упасть: наблюдатель мог не подключиться,
 * сборщик — вернуть ноль, а сравнение — не выполниться. Поэтому та же цепочка
 * (observer → готовность → сбор → сравнение) прогоняется по фикстуре, которая
 * заведомо ломает CLS, DOM первого экрана и правило запрещённых узлов.
 *
 * Фикстура отдаётся через `page.route` на same-origin URL, чтобы не трогать
 * `scripts/e2e-webserver.js` (protected path).
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { test, expect } from '@playwright/test'

import {
  collectFirstScreenElements,
  collectMetrics,
  injectPerfObservers,
} from './helpers/perfBudget'
import { evaluatePageBudget, type PageBudget } from './helpers/pagesPerfBudgets'

// Относительный путь, а не зашитый порт: `scripts/e2e-run.js` при занятом 8085
// смещает порт и переписывает baseURL — иначе документ грузился бы с чужого
// origin и «same-origin load» из design.md переставал бы выполняться.
const FIXTURE_PATH = '/__perf-budget-negative-fixture'
const FIXTURE_HTML = readFileSync(
  join(__dirname, 'fixtures', 'perf-budget-regression.html'),
  'utf8',
)

/** Бюджет пробы, а не таблицы: фикстура обязана его пробить по трём осям. */
const PROBE_BUDGET: PageBudget = {
  clsMax: 0.1,
  firstScreenElementsMax: 200,
  lcpMaxMs: 60_000,
  fcpMaxMs: 60_000,
  tbtMaxMs: 60_000,
  longTasksMax: 1000,
  jsTransferKBMax: 100_000,
  totalTransferKBMax: 100_000,
  requestsMax: 10_000,
}

test.describe('@perf pages-perf-budget — negative probe', () => {
  test('first-screen DOM respects CSS visibility while retaining the complete document count', async ({ page }) => {
    await page.route(`**${FIXTURE_PATH}`, (route) => route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><head><style>
        body { margin: 0; }
        #parent { position: absolute; left: 20px; top: 20px; width: 120px; height: 100px; }
        #child, #sibling { width: 40px; height: 30px; background: red; }
      </style></head><body><div id="parent"><div id="child"></div><div id="sibling" aria-hidden="true"></div></div></body></html>`,
    }))
    await page.goto(FIXTURE_PATH, { waitUntil: 'load' })
    const baseline = await collectFirstScreenElements(page)
    expect(baseline.firstScreenElements).toBeGreaterThanOrEqual(3)
    const counts = async (removed: number) => {
      expect(await collectFirstScreenElements(page)).toEqual({
        firstScreenElements: baseline.firstScreenElements - removed,
        documentElements: baseline.documentElements,
      })
    }
    const style = (id: string, cssText: string) => page.locator(`#${id}`).evaluate(
      (element, value) => { (element as HTMLElement).style.cssText = value }, cssText,
    )

    await test.step('an invisible box retains geometry but leaves the first-screen count', async () => {
      await style('child', 'opacity: 0')
      expect(await page.locator('#child').evaluate(element => element.getBoundingClientRect().height)).toBe(30)
      await counts(1)
      await style('child', '')
      await counts(0)
    })
    await test.step('zero ancestor opacity hides descendants despite their own positive opacity', async () => {
      await style('child', 'opacity: 1')
      await style('parent', 'opacity: 0')
      await counts(3)
      await style('parent', 'opacity: 0.01')
      await counts(0)
      await style('parent', '')
      await style('child', '')
    })
    await test.step('visibility supports an explicitly visible descendant', async () => {
      await style('parent', 'visibility: hidden')
      await counts(3)
      await style('child', 'visibility: visible')
      await counts(2)
      await style('parent', '')
      await style('child', '')
      await style('child', 'visibility: collapse')
      await counts(1)
      await style('child', '')
      await counts(0)
    })
    await test.step('ARIA alone does not hide a painted box; geometry filters remain active', async () => {
      await page.locator('#sibling').evaluate(element => element.removeAttribute('aria-hidden'))
      await counts(0)
      await style('child', 'height: 0')
      await counts(1)
      await style('child', 'position: fixed; left: 200vw')
      await counts(1)
      await style('child', 'position: fixed; top: 200vh')
      await counts(1)
      await style('child', '')
      await counts(0)
    })
  })

  test('the gate reports layout-shift, first-screen DOM and forbidden-source violations', async ({
    page,
  }) => {
    await page.route(`**${FIXTURE_PATH}`, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: FIXTURE_HTML }),
    )

    await injectPerfObservers(page)
    await page.goto(FIXTURE_PATH, { waitUntil: 'load', timeout: 60_000 })
    // Порядок как в боевом прогоне: DOM первого экрана считается на готовности,
    // до сдвига, иначе уехавший вниз контент занизил бы счёт.
    const domCounts = await collectFirstScreenElements(page)
    await page.waitForTimeout(1500)
    const metrics = await collectMetrics(page)

    const violations = evaluatePageBudget(
      {
        cls: metrics.cls,
        firstScreenElements: domCounts.firstScreenElements,
        lcp: metrics.lcp,
        fcp: metrics.fcp,
        tbt: metrics.tbt,
        longTaskCount: metrics.longTaskCount,
        clsSourceFingerprints: metrics.clsSources.flatMap((entry) => entry.sources),
      },
      PROBE_BUDGET,
    )

    const metricsHit = violations.map((violation) => violation.metric)
    const report = { cls: metrics.cls, domCounts, violations }

    expect(metrics.cls, `fixture produced no layout shift: ${JSON.stringify(report)}`).toBeGreaterThan(
      PROBE_BUDGET.clsMax,
    )
    expect(metricsHit, `expected a cls violation: ${JSON.stringify(report)}`).toContain('cls')
    expect(
      metricsHit,
      `expected a first-screen DOM violation: ${JSON.stringify(report)}`,
    ).toContain('firstScreenElements')
    expect(
      violations.map((violation) => violation.detail),
      // Проверяем картинку логотипа: она есть на обоих профилях, а переключатель
      // языка до закрытия #1298 стоит на общем долге и молчал бы всегда.
      `expected the forbidden header node among the shift sources: ${JSON.stringify(report)}`,
    ).toContain('header-logo-image')
  })
})
