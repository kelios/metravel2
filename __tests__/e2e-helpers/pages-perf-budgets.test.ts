// __tests__/e2e-helpers/pages-perf-budgets.test.ts
// Governance-тесты таблицы перфоманс-бюджетов (#1287).
//
// Смысл: правила таблицы должны проверяться дешёвым unit-прогоном, а не только
// живым браузерным гейтом. Тогда «поднять порог, чтобы прошло» ломает обычные
// тесты, а не тихо проезжает.

import {
  BudgetConfigurationError,
  FORBIDDEN_SHIFT_SOURCES,
  HEALTHY_CLS_MAX,
  PERF_PROFILES,
  clampCeiling,
  evaluatePageBudget,
  evaluateTransferBudget,
  resolveEffectiveBudget,
  findTableProblems,
  resolveBudget,
  type PageBudget,
  type PageMeasurement,
} from '../../e2e/helpers/pagesPerfBudgets'

const GATED_ROUTES = ['HOME', 'SEARCH', 'MAP', 'PLACES', 'QUESTS']

const healthyBudget = (overrides: Partial<PageBudget> = {}): PageBudget => ({
  clsMax: 0.1,
  firstScreenElementsMax: 400,
  lcpMaxMs: 10_000,
  fcpMaxMs: 6000,
  tbtMaxMs: 1500,
  longTasksMax: 20,
  jsTransferKBMax: 2600,
  totalTransferKBMax: 9000,
  requestsMax: 120,
  ...overrides,
})

const measurement = (overrides: Partial<PageMeasurement> = {}): PageMeasurement => ({
  cls: 0.01,
  firstScreenElements: 120,
  lcp: 1000,
  fcp: 500,
  tbt: 100,
  longTaskCount: 2,
  clsSourceFingerprints: [],
  ...overrides,
})

describe('budget table rules', () => {
  it('covers every gated route on both profiles', () => {
    const problems = findTableProblems()
    expect(problems).toEqual([])
    for (const route of GATED_ROUTES) {
      for (const profile of PERF_PROFILES) {
        expect(() => resolveBudget(route, profile)).not.toThrow()
      }
    }
  })

  it('throws on a missing route or profile instead of falling back', () => {
    expect(() => resolveBudget('NOT_A_ROUTE', 'desktop')).toThrow(BudgetConfigurationError)
    expect(() => resolveBudget('HOME', 'tablet' as never)).toThrow(BudgetConfigurationError)
  })

  it('rejects a healthy entry above the Core Web Vitals threshold', () => {
    const problems = findTableProblems({
      HOME: { desktop: healthyBudget({ clsMax: 0.3 }), mobile: healthyBudget() },
    })
    expect(problems.join('\n')).toContain(`exceeds ${HEALTHY_CLS_MAX}`)
  })

  it('requires a debt entry to be pinned to its measured value with a task reference', () => {
    const pinned = findTableProblems({
      HOME: {
        desktop: healthyBudget({
          clsMax: 0.02,
          debt: { measured: 0.02, taskRef: '#1298', recordedAt: '2026-08-08' },
        }),
        mobile: healthyBudget(),
      },
    })
    expect(pinned).toEqual([])

    const withHeadroom = findTableProblems({
      HOME: {
        desktop: healthyBudget({
          clsMax: 0.05,
          debt: { measured: 0.02, taskRef: '#1298', recordedAt: '2026-08-08' },
        }),
        mobile: healthyBudget(),
      },
    })
    expect(withHeadroom.join('\n')).toContain('must pin clsMax to the measured value')

    const withoutRef = findTableProblems({
      HOME: {
        desktop: healthyBudget({
          clsMax: 0.02,
          debt: { measured: 0.02, taskRef: '  ', recordedAt: '2026-08-08' },
        }),
        mobile: healthyBudget(),
      },
    })
    expect(withoutRef.join('\n')).toContain('debt entry without taskRef')
  })
})

describe('environment overrides are a one-way clamp', () => {
  it('applies a tightening override', () => {
    expect(clampCeiling(0.1, 0.05)).toEqual({ value: 0.05, ignored: false })
  })

  it('ignores a loosening override and reports it', () => {
    expect(clampCeiling(0.1, 0.3)).toEqual({ value: 0.1, ignored: true })
  })

  it('keeps the table value when no override is set', () => {
    expect(clampCeiling(0.1, undefined)).toEqual({ value: 0.1, ignored: false })
    expect(clampCeiling(0.1, Number.NaN)).toEqual({ value: 0.1, ignored: false })
  })
})

describe('evaluatePageBudget', () => {
  it('returns no violations for a measurement inside every ceiling', () => {
    expect(evaluatePageBudget(measurement(), healthyBudget())).toEqual([])
  })

  it.each([
    ['cls', { cls: 0.4 }],
    ['firstScreenElements', { firstScreenElements: 5000 }],
    ['lcp', { lcp: 99_000 }],
    ['tbt', { tbt: 99_000 }],
  ])('reports a %s violation', (metric, overrides) => {
    const violations = evaluatePageBudget(measurement(overrides), healthyBudget())
    expect(violations.map((violation) => violation.metric)).toContain(metric)
  })

  it('never reports a metric the page could not measure', () => {
    expect(evaluatePageBudget(measurement({ lcp: null, fcp: null }), healthyBudget())).toEqual([])
  })

  it.each(FORBIDDEN_SHIFT_SOURCES.map((source) => [source.id, source.marker]))(
    'fails when %s appears among the shift sources',
    (id, marker) => {
      const violations = evaluatePageBudget(
        measurement({ clsSourceFingerprints: [`div[${marker}].css-abc (y 6→10, h 44)`] }),
        healthyBudget(),
      )
      expect(violations.map((violation) => violation.detail)).toContain(id)
    },
  )
})

// #1287: односторонние сравнения означают, что пустая страница «укладывается»
// во все потолки. Гейт обязан считать такой прогон недействительным.
describe('invalid measurement is a failure, not a green run', () => {
  it.each([
    ['nothing rendered', 0],
    ['negative count', -1],
    ['unmeasurable count', Number.NaN],
  ])('fails when the first screen reports %s', (_label, firstScreenElements) => {
    const violations = evaluatePageBudget(measurement({ firstScreenElements }), healthyBudget())
    expect(violations.map((violation) => violation.metric)).toContain('invalidMeasurement')
  })

  it('does not flag a page that actually rendered', () => {
    expect(
      evaluatePageBudget(measurement({ firstScreenElements: 1 }), healthyBudget()).map(
        (violation) => violation.metric,
      ),
    ).not.toContain('invalidMeasurement')
  })
})

describe('evaluateTransferBudget', () => {
  const transfer = { jsKB: 500, totalKB: 1500, requestCount: 40 }

  it('passes inside the ceilings', () => {
    expect(evaluateTransferBudget(transfer, healthyBudget())).toEqual([])
  })

  it.each([
    ['jsTransferKB', { jsKB: 99_999 }],
    ['totalTransferKB', { totalKB: 99_999 }],
    ['requests', { requestCount: 9999 }],
  ])('reports a %s violation', (metric, overrides) => {
    const violations = evaluateTransferBudget({ ...transfer, ...overrides }, healthyBudget())
    expect(violations.map((violation) => violation.metric)).toContain(metric)
  })
})

describe('resolveEffectiveBudget applies env overrides one way only', () => {
  it('tightens on a smaller value, per route as well as globally', () => {
    expect(resolveEffectiveBudget('HOME', 'desktop', { PERF_CLS_MAX: '0.05' }).budget.clsMax).toBe(0.05)
    expect(
      resolveEffectiveBudget('HOME', 'desktop', { PERF_CLS_MAX_HOME: '0.02' }).budget.clsMax,
    ).toBe(0.02)
  })

  it('ignores a loosening override and reports it', () => {
    const resolved = resolveEffectiveBudget('HOME', 'desktop', { PERF_CLS_MAX: '0.9' })
    expect(resolved.budget.clsMax).toBe(0.1)
    expect(resolved.ignoredOverrides.join(' ')).toContain('PERF_CLS_MAX=0.9')
  })

  it('keeps the table value when nothing is set', () => {
    const resolved = resolveEffectiveBudget('HOME', 'desktop', {})
    expect(resolved.budget.clsMax).toBe(0.1)
    expect(resolved.ignoredOverrides).toEqual([])
  })
})
