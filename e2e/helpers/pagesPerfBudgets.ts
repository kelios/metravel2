import type { NetworkStats } from './perfBudget'

/**
 * Таблица перфоманс-бюджетов страниц: одна запись на пару (маршрут, профиль).
 *
 * До #1287 гейт держал один общий `CLS_MAX = 0.3` и мерил только desktop.
 * 0,3 — это не бюджет, а «не катастрофа»: #1282 приехал с CLS 0,2431 и гейт
 * промолчал. Здоровый маршрут обязан укладываться в порог Core Web Vitals
 * (0,1), а маршрут с признанным долгом фиксируется на измеренном значении
 * БЕЗ запаса и с ссылкой на дефект-карточку — тогда любой рост ломает прогон.
 *
 * Здесь только данные и чистые функции: их проверяет обычный Jest
 * (`__tests__/e2e-helpers/pages-perf-budgets.test.ts`), не поднимая браузер.
 */

export type PerfProfile = 'desktop' | 'desktop-narrow' | 'mobile'

export const PERF_PROFILES = [
  'desktop',
  'desktop-narrow',
  'mobile',
] as const satisfies readonly PerfProfile[]

/** Признанный долг: бюджет прибит к измеренному значению и адресован карточке. */
export type PerfBudgetDebt = {
  /** Измеренное значение на момент фиксации — запаса сверху не даётся. */
  measured: number
  /** Карточка на борде, которая обязана этот долг закрыть. */
  taskRef: string
  /** Дата замера, чтобы протухший долг был виден. */
  recordedAt: string
}

export type PageBudget = {
  clsMax: number
  /** Потолок числа элементов, попавших в первый экран до скролла. */
  firstScreenElementsMax: number
  lcpMaxMs: number
  fcpMaxMs: number
  tbtMaxMs: number
  longTasksMax: number
  jsTransferKBMax: number
  totalTransferKBMax: number
  requestsMax: number
  /** Присутствует только когда маршрут не может уложиться в 0,1. */
  debt?: PerfBudgetDebt
  /**
   * Признанный долг по запрещённым узлам сдвига: маршрут пока двигает шапку и
   * это адресовано отдельной карточкой. Разрешение точечное — новый маршрут
   * или новый узел всё равно ломает прогон.
   */
  allowedForbiddenSources?: { ids: string[]; taskRef: string; recordedAt: string }
  /**
   * Причина, по которой на этом маршруте/профиле не проверяется присутствие
   * запрещённых узлов. Нужна там, где экран рисует собственный chrome вместо
   * общей шапки: требовать её узлы значило бы ронять гейт на здоровой странице.
   */
  skipHeaderPositiveControl?: string
}

export type PageMeasurement = {
  cls: number
  firstScreenElements: number
  lcp: number | null
  fcp: number | null
  tbt: number
  longTaskCount: number
  /** Отпечатки узлов из кадров сдвига, как их собрал `perfBudget.ts`. */
  clsSourceFingerprints: string[]
}

export type BudgetViolation = {
  metric: string
  actual: number | string
  budget: number | string
  detail?: string
}

/**
 * Узлы, которых не должно быть среди источников сдвига ни на одном маршруте.
 * Шапка есть на каждой странице, поэтому её сдвиг — это регресс общего chrome,
 * а не конкретного экрана (#1298).
 */
export const FORBIDDEN_SHIFT_SOURCES: ReadonlyArray<{
  id: string
  marker: string
  selector: string
  /**
   * Профили, где селектор обязан находиться. Позитивный контроль проверяется
   * только там: словесная часть логотипа существует лишь в широкой desktop-раскладке,
   * и требовать её на мобильном — значит ронять гейт на здоровой странице.
   */
  presentOn: readonly PerfProfile[]
}> = [
  {
    id: 'header-logo',
    marker: 'data-header-logo-wordmark',
    selector: '[data-header-logo-wordmark]',
    // Словесная часть логотипа рисуется только в desktop-раскладке
    // (`CustomHeader.tsx`: showWordmark={!rowIsMobile}).
    presentOn: ['desktop'],
  },
  {
    // Картинка логотипа есть во всех трёх раскладках, и критический CSS меняет ей
    // размер 32 → 26 px на границе 1280 px. Оба узла мобильной шапки теперь
    // проверяются без глобального исключения #1298: картинка логотипа и переключатель
    // языка обязаны оставаться вне кадров сдвига.
    id: 'header-logo-image',
    marker: 'data-header-logo-image',
    selector: '[data-header-logo-image]',
    presentOn: ['desktop', 'desktop-narrow', 'mobile'],
  },
  {
    id: 'header-language-switcher',
    marker: 'testid=header-language-switcher',
    selector: '[data-testid="header-language-switcher"]',
    presentOn: ['desktop', 'desktop-narrow', 'mobile'],
  },
]

/** Порог Google для «хорошего» CLS. Здоровая запись не может быть выше. */
export const HEALTHY_CLS_MAX = 0.1

type BudgetTable = Record<string, Partial<Record<PerfProfile, PageBudget>>>

const IS_CI = Boolean(process.env.CI)

/** Пороги времени перенесены из прежнего гейта без послаблений. */
const TIMING = {
  fcpMaxMs: IS_CI ? 3000 : 6000,
  tbtMaxMs: IS_CI ? 600 : 1500,
  longTasksMax: IS_CI ? 8 : 20,
}
const LCP_FAST = IS_CI ? 4000 : 10_000
const LCP_MEDIUM = IS_CI ? 5000 : 11_000
const LCP_SLOW = IS_CI ? 6000 : 12_000

const QUESTS_CATALOG_BUDGETS = {
  desktop: {
    clsMax: HEALTHY_CLS_MAX,
    firstScreenElementsMax: 250, // measured 202
    lcpMaxMs: LCP_MEDIUM,
    jsTransferKBMax: 1500, // measured 1214
    totalTransferKBMax: 1600, // measured 1300
    requestsMax: 105, // measured 87
    ...TIMING,
  },
  'desktop-narrow': {
    // Initial 1152x720 ceiling mirrors desktop until a route-specific baseline
    // proves that the narrower catalog needs a different ratchet.
    clsMax: HEALTHY_CLS_MAX,
    firstScreenElementsMax: 250,
    lcpMaxMs: LCP_MEDIUM,
    jsTransferKBMax: 1500,
    totalTransferKBMax: 1600,
    requestsMax: 105,
    ...TIMING,
  },
  mobile: {
    clsMax: HEALTHY_CLS_MAX,
    firstScreenElementsMax: 160, // measured 127
    lcpMaxMs: LCP_MEDIUM,
    jsTransferKBMax: 1500, // measured 1214
    totalTransferKBMax: 1600, // measured 1300
    requestsMax: 105, // measured 87
    ...TIMING,
  },
} satisfies Record<PerfProfile, PageBudget>

/**
 * Исходные числа сняты на локальной прод-сборке 2026-08-08
 * (`PERF_BUDGET_BASELINE=1`, Desktop Chrome 1280×720 и Pixel 7 DPR 2,625).
 * `desktop-narrow` начинает с desktop ceilings; подтверждённые отличия имеют
 * отдельный inline baseline.
 *
 * Правило потолков: транспорт и DOM первого экрана = измеренное значение
 * примерно +20 % и округление вверх; CLS = порог Core Web Vitals 0,1, потому
 * что каждый маршрут в него уже уложился. Долговых записей по CLS нет.
 *
 * Замеренный CLS: Home 0,0002/0,0000 · Search 0,0002/0,0000 · Map 0,0916/0,0000
 * · Places 0,0062/0,0000 · Quests 0,0004/0,0029 (desktop/mobile).
 */
export const PAGE_BUDGETS: BudgetTable = {
  HOME: {
    desktop: {
      clsMax: HEALTHY_CLS_MAX,
      firstScreenElementsMax: 260, // measured 213
      lcpMaxMs: LCP_FAST,
      jsTransferKBMax: 1500, // measured 1228
      totalTransferKBMax: 1800, // measured 1494
      requestsMax: 115, // measured 96
      ...TIMING,
    },
    'desktop-narrow': {
      clsMax: HEALTHY_CLS_MAX,
      firstScreenElementsMax: 260,
      lcpMaxMs: LCP_FAST,
      jsTransferKBMax: 1500,
      totalTransferKBMax: 1800,
      requestsMax: 115,
      ...TIMING,
    },
    mobile: {
      clsMax: HEALTHY_CLS_MAX,
      firstScreenElementsMax: 175, // measured 141
      lcpMaxMs: LCP_FAST,
      jsTransferKBMax: 1500, // measured 1228
      totalTransferKBMax: 1900, // measured 1566
      requestsMax: 115, // measured 97
      ...TIMING,
    },
  },
  SEARCH: {
    desktop: {
      clsMax: 0.01,
      firstScreenElementsMax: 440, // measured 359 with the non-empty regression fixture
      lcpMaxMs: LCP_FAST,
      jsTransferKBMax: 1500, // measured 1237
      totalTransferKBMax: 1600, // measured 1330
      requestsMax: 110, // measured 92
      ...TIMING,
    },
    'desktop-narrow': {
      // #1564 discovery reopened canonical header-hydration task #1298: cold
      // production builds measured 0.010928357…–0.011072531… at 1152x720.
      // Keep desktop/mobile at 0.01 while #1298 removes the breakpoint drift.
      clsMax: 0.0111,
      firstScreenElementsMax: 440,
      lcpMaxMs: LCP_FAST,
      jsTransferKBMax: 1500,
      totalTransferKBMax: 1600,
      requestsMax: 110,
      ...TIMING,
    },
    mobile: {
      clsMax: 0.01,
      firstScreenElementsMax: 250, // measured 200 with the non-empty regression fixture
      lcpMaxMs: LCP_FAST,
      jsTransferKBMax: 1500, // measured 1237
      totalTransferKBMax: 1600, // measured 1330
      requestsMax: 110, // measured 92
      ...TIMING,
    },
  },
  MAP: {
    desktop: {
      clsMax: HEALTHY_CLS_MAX,
      firstScreenElementsMax: 310, // measured 251
      lcpMaxMs: LCP_SLOW,
      jsTransferKBMax: 1800, // measured 1493
      totalTransferKBMax: 2700, // measured 2262, тайлы прокси не считаются
      requestsMax: 135, // measured 119
      ...TIMING,
    },
    'desktop-narrow': {
      clsMax: HEALTHY_CLS_MAX,
      firstScreenElementsMax: 310,
      lcpMaxMs: LCP_SLOW,
      jsTransferKBMax: 1800,
      totalTransferKBMax: 2700,
      requestsMax: 135,
      ...TIMING,
    },
    mobile: {
      clsMax: HEALTHY_CLS_MAX,
      // Мобильная карта рисует собственный chrome: узлов общей шапки на экране
      // нет, поэтому проверять их присутствие здесь нечего.
      skipHeaderPositiveControl: 'mobile map renders its own chrome without the global header',
      firstScreenElementsMax: 190, // measured 153
      lcpMaxMs: LCP_SLOW,
      jsTransferKBMax: 1800, // measured 1508
      totalTransferKBMax: 2600, // measured 2157
      requestsMax: 135, // measured 120
      ...TIMING,
    },
  },
  PLACES: {
    desktop: {
      clsMax: HEALTHY_CLS_MAX,
      firstScreenElementsMax: 300, // measured 249
      lcpMaxMs: LCP_MEDIUM,
      jsTransferKBMax: 1650, // measured 1364
      totalTransferKBMax: 1750, // measured 1453
      requestsMax: 125, // measured 104
      ...TIMING,
    },
    'desktop-narrow': {
      clsMax: HEALTHY_CLS_MAX,
      firstScreenElementsMax: 300,
      lcpMaxMs: LCP_MEDIUM,
      jsTransferKBMax: 1650,
      totalTransferKBMax: 1750,
      requestsMax: 125,
      ...TIMING,
    },
    mobile: {
      // #1334 убрал 115px-сдвиг каталога, #1298/#1340 сняли сдвиг шапки и
      // стирание статического shell. Прод-замер 2026-08-10 (build
      // v1786308063481, 412x823, CPU 4x, холодный контекст): 0.002501 в 5/5.
      // Долг снят, порог вернулся к здоровому.
      clsMax: HEALTHY_CLS_MAX,
      firstScreenElementsMax: 160, // measured 129
      lcpMaxMs: LCP_MEDIUM,
      jsTransferKBMax: 1650, // measured 1364
      totalTransferKBMax: 1750, // measured 1453
      requestsMax: 125, // measured 96
      ...TIMING,
    },
  },
  QUESTS: QUESTS_CATALOG_BUDGETS,
  // #1564: quest detail is intentionally independent from the catalog key so
  // route-scoped env clamps and reports cannot silently affect the other page.
  // Start with the already-enforced public-quests ceilings; CLS remains at the
  // healthy CWV threshold on all responsive layouts.
  QUEST_DETAIL: {
    desktop: {
      ...QUESTS_CATALOG_BUDGETS.desktop,
      firstScreenElementsMax: 325, // measured 270; +20% rounded up
    },
    'desktop-narrow': {
      ...QUESTS_CATALOG_BUDGETS['desktop-narrow'],
      firstScreenElementsMax: 240, // measured 199; +20% rounded up
    },
    mobile: {
      ...QUESTS_CATALOG_BUDGETS.mobile,
      firstScreenElementsMax: 220, // measured 183; +20% rounded up
    },
  },
}

export class BudgetConfigurationError extends Error {}

const CEILING_ENV: Array<{ key: keyof PageBudget; env: string }> = [
  { key: 'clsMax', env: 'PERF_CLS_MAX' },
  { key: 'firstScreenElementsMax', env: 'PERF_MAX_FIRST_SCREEN_ELEMENTS' },
  { key: 'lcpMaxMs', env: 'PERF_LCP_MAX_MS' },
  { key: 'fcpMaxMs', env: 'PERF_FCP_MAX_MS' },
  { key: 'tbtMaxMs', env: 'PERF_TBT_MAX_MS' },
  { key: 'longTasksMax', env: 'PERF_MAX_LONG_TASKS' },
  { key: 'jsTransferKBMax', env: 'PERF_MAX_JS_KB' },
  { key: 'totalTransferKBMax', env: 'PERF_MAX_TOTAL_KB' },
  { key: 'requestsMax', env: 'PERF_MAX_REQUESTS' },
]

/**
 * Бюджет прогона: таблица плюс переменные окружения, которые могут только
 * ужесточить потолок. Общая переменная действует на все маршруты, суффикс
 * `_${routeKey}` — на один. Проигнорированные послабления возвращаются
 * отдельно, чтобы прогон о них сообщил, а не проглотил.
 */
export function resolveEffectiveBudget(
  routeKey: string,
  profile: PerfProfile,
  env: NodeJS.ProcessEnv = process.env,
): { budget: PageBudget; ignoredOverrides: string[] } {
  const base = resolveBudget(routeKey, profile)
  const budget: PageBudget = { ...base }
  const ignoredOverrides: string[] = []

  for (const { key, env: name } of CEILING_ENV) {
    for (const candidate of [name, `${name}_${routeKey}`]) {
      const raw = env[candidate]
      if (!raw) continue
      const value = Number(raw)
      if (!Number.isFinite(value)) continue
      const clamped = clampCeiling(budget[key] as number, value)
      if (clamped.ignored) ignoredOverrides.push(`${candidate}=${raw} (loosening ignored)`)
      ;(budget[key] as number) = clamped.value
    }
  }

  return { budget, ignoredOverrides }
}

export function resolveBudget(routeKey: string, profile: PerfProfile): PageBudget {
  const budget = PAGE_BUDGETS[routeKey]?.[profile]
  if (!budget) {
    throw new BudgetConfigurationError(
      `perf budget is not configured for route "${routeKey}" on profile "${profile}". ` +
        'Measure the route on that profile and add the entry — a missing pair must never fall back to a permissive default.',
    )
  }
  return budget
}

/**
 * Переменная окружения может только ужесточить потолок. Иначе «нестабильный
 * прогон» лечится поднятием порога, и гейт перестаёт что-либо ловить.
 */
export function clampCeiling(tableValue: number, envValue: number | undefined): {
  value: number
  ignored: boolean
} {
  if (envValue === undefined || !Number.isFinite(envValue)) return { value: tableValue, ignored: false }
  if (envValue > tableValue) return { value: tableValue, ignored: true }
  return { value: envValue, ignored: false }
}

const compare = (
  violations: BudgetViolation[],
  metric: string,
  actual: number | null,
  budget: number,
): void => {
  if (actual === null) return
  if (actual > budget) violations.push({ metric, actual, budget })
}

export function evaluatePageBudget(
  measurement: PageMeasurement,
  budget: PageBudget,
): BudgetViolation[] {
  const violations: BudgetViolation[] = []

  // Страница, которая ничего не отрисовала, обязана падать, а не «укладываться
  // в бюджет»: все остальные сравнения односторонние, поэтому пустой документ
  // прошёл бы с нулями. Это ровно тот fail-open, который запрещает docs/RULES.md.
  if (!Number.isFinite(measurement.firstScreenElements) || measurement.firstScreenElements <= 0) {
    violations.push({
      metric: 'invalidMeasurement',
      actual: measurement.firstScreenElements,
      budget: '> 0 elements on the first screen',
      detail: 'the page rendered nothing measurable — treat the run as invalid, not as green',
    })
  }

  compare(violations, 'cls', measurement.cls, budget.clsMax)
  compare(violations, 'firstScreenElements', measurement.firstScreenElements, budget.firstScreenElementsMax)
  compare(violations, 'lcp', measurement.lcp, budget.lcpMaxMs)
  compare(violations, 'fcp', measurement.fcp, budget.fcpMaxMs)
  compare(violations, 'tbt', measurement.tbt, budget.tbtMaxMs)
  compare(violations, 'longTasks', measurement.longTaskCount, budget.longTasksMax)

  const allowed = new Set(budget.allowedForbiddenSources?.ids ?? [])
  for (const forbidden of FORBIDDEN_SHIFT_SOURCES) {
    if (allowed.has(forbidden.id)) continue
    const hit = measurement.clsSourceFingerprints.find((fingerprint) =>
      fingerprint.includes(forbidden.marker),
    )
    if (hit) {
      violations.push({
        metric: 'forbiddenShiftSource',
        actual: hit,
        budget: `${forbidden.id} must not appear in any shift frame`,
        detail: forbidden.id,
      })
    }
  }

  return violations
}

/** Транспорт меряет отдельный тест, поэтому и сравнение отдельное. */
export function evaluateTransferBudget(
  measurement: Pick<NetworkStats, 'jsKB' | 'totalKB' | 'requestCount'>,
  budget: PageBudget,
): BudgetViolation[] {
  const violations: BudgetViolation[] = []
  compare(violations, 'jsTransferKB', measurement.jsKB, budget.jsTransferKBMax)
  compare(violations, 'totalTransferKB', measurement.totalKB, budget.totalTransferKBMax)
  compare(violations, 'requests', measurement.requestCount, budget.requestsMax)
  return violations
}

/** Проверка самой таблицы — её гоняет unit-тест, а не браузерный прогон. */
export function findTableProblems(table: BudgetTable = PAGE_BUDGETS): string[] {
  const problems: string[] = []

  for (const [routeKey, byProfile] of Object.entries(table)) {
    for (const profile of PERF_PROFILES) {
      const budget = byProfile[profile]
      if (!budget) {
        problems.push(`${routeKey}/${profile}: missing budget entry`)
        continue
      }
      if (budget.debt) {
        if (budget.clsMax !== budget.debt.measured) {
          problems.push(
            `${routeKey}/${profile}: debt entry must pin clsMax to the measured value (${budget.debt.measured}), got ${budget.clsMax}`,
          )
        }
        if (!budget.debt.taskRef.trim()) {
          problems.push(`${routeKey}/${profile}: debt entry without taskRef`)
        }
      } else if (budget.clsMax > HEALTHY_CLS_MAX) {
        problems.push(
          `${routeKey}/${profile}: clsMax ${budget.clsMax} exceeds ${HEALTHY_CLS_MAX} without a recorded debt`,
        )
      }

      const allowance = budget.allowedForbiddenSources
      if (allowance) {
        if (!allowance.taskRef.trim()) {
          problems.push(`${routeKey}/${profile}: forbidden-source allowance without taskRef`)
        }
        const known = new Set(FORBIDDEN_SHIFT_SOURCES.map((source) => source.id))
        for (const id of allowance.ids) {
          if (!known.has(id)) {
            problems.push(`${routeKey}/${profile}: allowance names unknown forbidden source "${id}"`)
          }
        }
      }
    }
  }

  return problems
}
