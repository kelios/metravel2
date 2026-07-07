import { getCountryFlagAnchor, getCountryGeometry } from '@/components/screens/profile/worldMap/worldGeometry'

describe('world map flag anchors', () => {
  it('anchors France on the mainland polygon instead of the combined overseas bbox', () => {
    const anchor = getCountryFlagAnchor('FR')

    expect(anchor).toEqual(
      expect.objectContaining({
        cx: expect.any(Number),
        cy: expect.any(Number),
      }),
    )
    expect(anchor!.cx).toBeGreaterThan(489)
    expect(anchor!.cx).toBeLessThan(520)
    expect(anchor!.cy).toBeGreaterThan(65)
    expect(anchor!.cy).toBeLessThan(93)
  })

  it('keeps single-polygon country anchors stable', () => {
    expect(getCountryFlagAnchor('ES')).toEqual(getCountryGeometry('ES'))
  })
})
