import {
  PERF_BUDGET_TEST_MATCH,
  PERF_DESKTOP_VIEWPORTS,
  PERF_PROFILE_BY_PROJECT,
} from '../../e2e/helpers/perfProjects'

const packageJson = require('../../package.json') as {
  scripts: Record<string, string>
}

describe('Playwright performance projects (#1564)', () => {
  it('keeps both sides of the 1280 desktop breakpoint in the perf gate', () => {
    expect(PERF_DESKTOP_VIEWPORTS).toEqual({
      chromium: { width: 1280, height: 720 },
      'chromium-narrow': { width: 1152, height: 720 },
    })
  })

  it('keeps the performance-only match list explicit', () => {
    expect(PERF_BUDGET_TEST_MATCH).toEqual([
      '**/pages-perf-budget.spec.ts',
      '**/pages-perf-budget-negative.spec.ts',
    ])
  })

  it('maps every browser project to its independent budget profile', () => {
    expect(PERF_PROFILE_BY_PROJECT).toEqual({
      chromium: 'desktop',
      'chromium-narrow': 'desktop-narrow',
      'chromium-mobile': 'mobile',
    })
  })

  it('runs the pages budget command under wide, narrow and mobile projects exactly once', () => {
    const command = packageJson.scripts['e2e:perf-budget:pages']
    const selectedProjects = [...command.matchAll(/--project=([^\s]+)/g)].map((match) => match[1])

    expect(selectedProjects).toEqual(['chromium', 'chromium-narrow', 'chromium-mobile'])
  })
})
