import { getPreviousVisitedPath, recordVisitedPath, resetNavigationTrailForTests, resolveSourcePath } from '@/utils/navigationTrail'

describe('navigation trail (#3284)', () => {
  beforeEach(() => {
    resetNavigationTrailForTests()
  })

  it('remembers the screen opened before the current one', () => {
    recordVisitedPath('/quests/nesvizh')
    expect(getPreviousVisitedPath()).toBeNull()
    recordVisitedPath('/quests/17/nesvizh-radziwill')
    recordVisitedPath('/contact')
    expect(getPreviousVisitedPath()).toBe('/quests/17/nesvizh-radziwill')
    expect(resolveSourcePath()).toBe('/quests/17/nesvizh-radziwill')
  })

  it('ignores a repeated path, an empty value and anything that is not an app path', () => {
    recordVisitedPath('/quests')
    recordVisitedPath('/contact')
    recordVisitedPath('/contact')
    recordVisitedPath('')
    recordVisitedPath(undefined)
    recordVisitedPath('//evil.example/x')
    recordVisitedPath('https://evil.example/x')
    expect(getPreviousVisitedPath()).toBe('/quests')
  })

  it('keeps only the pathname so queries and hashes never reach the message', () => {
    recordVisitedPath('/search?q=secret#frag')
    recordVisitedPath('/contact')
    expect(getPreviousVisitedPath()).toBe('/search')
  })

  it('returns no source for the first screen of a session', () => {
    recordVisitedPath('/contact')
    expect(resolveSourcePath()).toBeNull()
  })
})
