import {
  appendReturnToParam,
  normalizeInternalReturnPath,
} from '@/utils/navigationReturnPath'

describe('navigationReturnPath', () => {
  it('accepts internal return paths and appends them as returnTo', () => {
    expect(normalizeInternalReturnPath('/search')).toBe('/search')
    expect(appendReturnToParam('/travel/658', '/search')).toBe('/travel/658?returnTo=%2Fsearch')
    expect(appendReturnToParam('/travel/658?draft=1', '/map')).toBe('/travel/658?draft=1&returnTo=%2Fmap')
  })

  it('uses the first array value from route params', () => {
    expect(normalizeInternalReturnPath(['/places', '/search'])).toBe('/places')
  })

  it('rejects external and malformed return targets', () => {
    expect(normalizeInternalReturnPath('https://example.com/search')).toBeNull()
    expect(normalizeInternalReturnPath('//example.com/search')).toBeNull()
    expect(normalizeInternalReturnPath('/search\\evil')).toBeNull()
    expect(normalizeInternalReturnPath('/search\u0000')).toBeNull()
    expect(appendReturnToParam('/travel/658', 'https://example.com/search')).toBe('/travel/658')
  })
})
