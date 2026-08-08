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
