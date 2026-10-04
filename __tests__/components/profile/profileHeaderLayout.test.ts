import {
  PROFILE_HEADER_NARROW_ACTIONS_BAND,
  resolveProfileHeaderLayout,
} from '@/components/profile/profileHeaderLayout'

describe('resolveProfileHeaderLayout (#2141)', () => {
  it('uses the regular geometry from 360 up and in the zero-width frame', () => {
    for (const width of [0, 360, 390, 1280]) {
      expect(resolveProfileHeaderLayout(width)).toMatchObject({ narrow: false, coverHeight: 132, avatarSize: 84 })
    }
  })

  it('compacts the header below 360', () => {
    expect(resolveProfileHeaderLayout(320)).toMatchObject({ narrow: true, coverHeight: 88, avatarSize: 56 })
  })

  it('keeps the narrow avatar below the actions band on the cover', () => {
    const layout = resolveProfileHeaderLayout(320)
    // полоса: отступ сверху + подложка 2 + чип 44 + подложка 2
    const bandBottom = PROFILE_HEADER_NARROW_ACTIONS_BAND.top + 2 + 44 + 2
    expect(layout.coverHeight - layout.avatarOverlap).toBeGreaterThan(bandBottom)
  })

  it('leaves five touch-sized chips in the band on a 320 screen', () => {
    // обложка на 320: экран минус поля списка профиля (12 + 12)
    const coverWidth = 320 - 24
    const band = coverWidth - PROFILE_HEADER_NARROW_ACTIONS_BAND.left - PROFILE_HEADER_NARROW_ACTIONS_BAND.right
    const chipWidth = (band - 2 * 2 - 4 * 2) / 5
    expect(chipWidth).toBeGreaterThanOrEqual(44)
  })
})
