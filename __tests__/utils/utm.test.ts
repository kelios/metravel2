import { buildShareLink, buildShareUtm, type ShareChannel } from '@/utils/achievementShare'
import { buildQuestResultShareLink, buildQuestResultShareUtm } from '@/utils/questResultShare'
import { UTM_MEDIUMS } from '@/utils/utm'

describe('generated share acquisition media', () => {
  it.each<ShareChannel>(['telegram', 'facebook', 'whatsapp', 'native', 'copy', 'download'])(
    'generates a known GA4 medium for both %s share representations', (channel) => {
      const url = new URL(buildShareLink('https://metravel.by/achievements/1', { channel, slug: 'first' }))
      const body = buildShareUtm(channel, 'first')
      expect(Object.values(UTM_MEDIUMS)).toContain(body.medium)
      expect(url.searchParams.get('utm_medium')).toBe(body.medium)
      expect(body.medium).toBe(['telegram', 'facebook', 'whatsapp'].includes(channel) ? 'social' : 'referral')
      expect(body.campaign).toBe('badge_first')
    },
  )

  it('generates a classifiable quest-result link and API payload with the same campaign', () => {
    const url = new URL(buildQuestResultShareLink('https://metravel.by/quests/result/1', { slug: 'first' }))
    const body = buildQuestResultShareUtm('first')
    expect(Object.values(UTM_MEDIUMS)).toContain(body.medium)
    expect(url.searchParams.get('utm_medium')).toBe(body.medium)
    expect(url.searchParams.get('utm_campaign')).toBe(body.campaign)
  })
})
