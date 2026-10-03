/**
 * #2118: проводка слоёв рантайм-хрома детали. На native бар действий и прогресс
 * монтируются вне ScrollView (`viewportOverlay`), в контенте — только `scroll`.
 * Перепутанный слой вернул бы бар в низ статьи (y ≈ 57 800 на iPhone 17 Pro)
 * или отрисовал бы его дважды.
 */
import { getTravelDetailsRuntimeLayers } from '@/components/travel/details/travelDetailsPostLcpRuntimeModel'

describe('getTravelDetailsRuntimeLayers', () => {
  it.each(['ios', 'android'])('keeps only the scroll layer in content and the viewport chrome in the overlay on %s', (os) => {
    expect(getTravelDetailsRuntimeLayers(os)).toEqual({ content: 'scroll', viewportOverlay: true })
  })

  it('keeps the whole runtime in content on web (portal + fixed hold the window)', () => {
    expect(getTravelDetailsRuntimeLayers('web')).toEqual({ content: 'all', viewportOverlay: false })
  })
})
