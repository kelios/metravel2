const {
  buildAuthUrl,
  extractCode,
  median,
  parseArgs,
  pickLeaderAndOutsider,
  previousWeekWindow,
  renderMarkdown,
  toWarsawHours,
} = require('../../scripts/instagram-insights')

describe('instagram-insights', () => {
  it('takes the previous Monday–Sunday as the default window', () => {
    expect(previousWeekWindow(new Date('2026-10-05T07:00:00Z'))).toEqual({ since: '2026-09-28', until: '2026-10-04' })
    expect(previousWeekWindow(new Date('2026-10-11T22:00:00Z'))).toEqual({ since: '2026-09-28', until: '2026-10-04' })
  })

  it('names a leader only when it doubles the median', () => {
    expect(median([316, 739, 580])).toBe(580)
    const week = [
      { id: 'a', views: 739 },
      { id: 'b', views: 580 },
      { id: 'c', views: 316 },
    ]
    expect(pickLeaderAndOutsider(week)).toMatchObject({ median: 580, leader: null, outsider: { id: 'c' } })
    expect(pickLeaderAndOutsider([...week, { id: 'd', views: 1400 }]).leader).toMatchObject({ id: 'd' })
  })

  it('rejects malformed dates', () => {
    expect(() => parseArgs(['--since', '05.10.2026'])).toThrow('YYYY-MM-DD')
    expect(parseArgs(['--since', '2026-09-28', '--until', '2026-10-04'])).toMatchObject({ since: '2026-09-28' })
  })

  it('prints missing metrics as «нет данных» and zero story views as 0%', () => {
    const md = renderMarkdown({
      window: { since: '2026-09-28', until: '2026-10-04' },
      profile: { username: 'metravelby', followers_count: 7098 },
      account: { views: 1774, website_clicks: null },
      breakdowns: { follow_type: { FOLLOWER: 71 }, media_product_type: { REELS: 100 } },
      audience: { country: [], city: [] },
      media: [],
      errors: { 'account.website_clicks': 'refused' },
    })
    expect(md).toContain('| Клики на внешнюю ссылку | нет данных |')
    expect(md).toContain('| Доля историй в просмотрах | 0% |')
    expect(md).toContain('| Доля подписчиков в просмотрах | 71% |')
    expect(md).toContain('- account.website_clicks: refused')
  })

  it('builds the consent address and reads the code back from the redirect', () => {
    const url = new URL(buildAuthUrl({ appId: '42', redirectUri: 'https://metravel.by/cb/' }))
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toContain('instagram_manage_insights')
    expect(extractCode('https://metravel.by/cb/?code=AQx-1_y#_=_\n')).toBe('AQx-1_y')
    expect(extractCode(' AQx-1_y ')).toBe('AQx-1_y')
    expect(extractCode('Instagram oauth callback\nGET /api/cb/?code=AQx-1_y\nHTTP 400 Bad Request')).toBe('AQx-1_y')
    expect(() => extractCode('https://metravel.by/cb/?error=access_denied')).toThrow('no ?code=')
  })

  it('re-keys Pacific-day hours of online followers to Warsaw hours', () => {
    // the day ending 2026-10-03T07:00Z starts at 09:00 Warsaw (CEST) on 02.10
    expect(toWarsawHours({ end_time: '2026-10-03T07:00:00+0000', value: { 0: 5, 15: 9 } })).toEqual({ 9: 5, 0: 9 })
    expect(toWarsawHours(undefined)).toBeNull()
  })
})
