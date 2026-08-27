import type { PerfProfile } from './pagesPerfBudgets'

export const PERF_BUDGET_TEST_MATCH = [
  '**/pages-perf-budget.spec.ts',
  '**/pages-perf-budget-negative.spec.ts',
] as const

export const PERF_DESKTOP_VIEWPORTS = {
  chromium: { width: 1280, height: 720 },
  'chromium-narrow': { width: 1152, height: 720 },
} as const

export const PERF_PROFILE_BY_PROJECT = {
  chromium: 'desktop',
  'chromium-narrow': 'desktop-narrow',
  'chromium-mobile': 'mobile',
} as const satisfies Record<string, PerfProfile>
