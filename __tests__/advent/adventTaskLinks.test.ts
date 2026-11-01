import { buildAdventDoorCtaHref, buildAdventReturnPath, buildAdventTaskHref } from '@/utils/advent/adventTaskLinks'

describe('advent task CTA links (#2862)', () => {
  it('adds the advent source and day to a plain route', () => {
    expect(buildAdventTaskHref('/roulette', 5)).toBe('/roulette?from=advent&day=5')
  })

  it('keeps existing query params and hash', () => {
    expect(buildAdventTaskHref('/travel/new?mode=note#top', 22)).toBe('/travel/new?mode=note&from=advent&day=22#top')
  })

  it('leaves external links untouched', () => {
    expect(buildAdventTaskHref('https://example.com/x', 1)).toBe('https://example.com/x')
  })

  it('returns null for doors without a CTA route', () => {
    expect(buildAdventDoorCtaHref({ day: 1, task: { type: 'open', text: 't' } })).toBeNull()
    expect(buildAdventDoorCtaHref({ day: 2, task: { type: 'route', text: 't', ctaRoute: '/search' } })).toBe('/search?from=advent&day=2')
  })

  it('builds the post-login return path to the same door', () => {
    expect(buildAdventReturnPath(3)).toBe('/advent?day=3')
    expect(buildAdventReturnPath()).toBe('/advent')
  })
})
