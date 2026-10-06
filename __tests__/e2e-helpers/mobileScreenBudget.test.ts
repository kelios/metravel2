import { assertWithinBudget, MOBILE_SCREEN_BUDGET, countSearchboxes, type ScreenMetrics } from '../../e2e/helpers/mobileScreenBudget'
import type { Page } from '@playwright/test'

jest.mock('@playwright/test', () => ({ expect: jest.fn() }))
jest.mock('../../e2e/helpers/navigation', () => ({ gotoWithRetry: jest.fn(), preacceptCookies: jest.fn() }))

const tripsMetrics = (overrides: Partial<ScreenMetrics> = {}): ScreenMetrics => ({
  screen: 'trips-my', path: '/trips/my', viewport: '390x844', theme: 'dark',
  firstContentTopRatio: 0.2, pinnedChromeRatio: null, titleOccurrences: 1,
  searchboxCount: 1, ctaOccluded: false, darkBottomMatchesTheme: true,
  unlabeledInteractive: 0, emptyCtaDockGap: null, brandRowVisible: false,
  ...overrides,
})

describe('mobile screen budget semantics (#2297/#2298)', () => {
  it('requires a passing pixel zone, with exactly one documented raster-map exception', () => {
    expect(Object.values(MOBILE_SCREEN_BUDGET).every((budget) => budget.darkBottomMatchesThemeExpected)).toBe(true)
    expect(Object.entries(MOBILE_SCREEN_BUDGET).filter(([, budget]) => budget.darkBottomThemeException).map(([screen]) => screen)).toEqual(['userpoints'])
    expect(MOBILE_SCREEN_BUDGET.userpoints.darkBottomThemeException).toMatch(/Raster map tiles.*container/)
    expect(assertWithinBudget(tripsMetrics({ screen: 'userpoints', path: '/userpoints', firstContentTopRatio: 0.1, searchboxCount: 0, darkBottomMatchesTheme: false }), MOBILE_SCREEN_BUDGET.userpoints)).toEqual([])
  })
  it('requires exactly one existing search and zero on screens without search', () => {
    const withSearch = Object.entries(MOBILE_SCREEN_BUDGET).filter(([, budget]) => budget.searchboxCountExpected === 1).map(([key]) => key)
    expect(withSearch).toEqual(['home', 'search', 'quests', 'trips', 'trips-my', 'subscriptions'])
    expect(Object.values(MOBILE_SCREEN_BUDGET).every((budget) => [0, 1].includes(budget.searchboxCountExpected))).toBe(true)
  })
  it.each([0, 2])('fails when the existing search reports %s roles', (searchboxCount) => {
    expect(assertWithinBudget(tripsMetrics({ searchboxCount }), MOBILE_SCREEN_BUDGET['trips-my'])).toEqual([
      `trips-my @ 390x844/dark: searchboxCount ожидалось 1, стало ${searchboxCount}`,
    ])
  })
  it('fails when the screenshot reports a light underlay', () => {
    expect(assertWithinBudget(tripsMetrics({ darkBottomMatchesTheme: false }), MOBILE_SCREEN_BUDGET['trips-my']).join()).toContain('darkBottomMatchesTheme было true, стало false')
  })
  it('counts only visible accessibility searchboxes', async () => {
    const count = jest.fn().mockResolvedValue(1)
    const filter = jest.fn().mockReturnValue({ count })
    const getByRole = jest.fn().mockReturnValue({ filter })
    expect(await countSearchboxes({ getByRole } as unknown as Page)).toBe(1)
    expect(getByRole).toHaveBeenCalledWith('searchbox')
    expect(filter).toHaveBeenCalledWith({ visible: true })
  })
})
