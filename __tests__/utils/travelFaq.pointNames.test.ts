import { buildTravelFaqItems } from '@/utils/travelFaq'
import type { Travel } from '@/types/types'

/**
 * #1750: у точек, сохранённых до #1717, в `name` лежит вся цепочка геокодера.
 * FAQ подставляет их в ответ «Что обязательно посмотреть», и без укорачивания
 * ответ превращался в список адресов с административным хвостом.
 */
const travelWithChainPoints = {
  travelAddress: [
    { id: 1, name: '332 · Soblówka · Силезское воеводство · Живецкий повят · Польша' },
    { id: 2, name: 'Alcazaba de Málaga, Calle Guillén Sotelo, Малага, 29015, Испания' },
    { id: 3, name: 'Przełęcz Przegibek' },
  ],
} as unknown as Travel

describe('buildTravelFaqItems — подписи точек (#1750)', () => {
  const pointsAnswer = () => {
    const items = buildTravelFaqItems(travelWithChainPoints)
    const answer = items.map((item) => item.a).find((a) => a.includes('Soblówka'))
    expect(answer).toBeDefined()
    return answer!
  }

  it('в ответе только имена объектов, без административного хвоста', () => {
    const answer = pointsAnswer()
    expect(answer).toContain('Soblówka')
    expect(answer).toContain('Alcazaba de Málaga')
    expect(answer).not.toContain('Живецкий повят')
    expect(answer).not.toContain('Calle Guillén Sotelo')
  })

  it('короткое имя проходит без изменений', () => {
    expect(pointsAnswer()).toContain('Przełęcz Przegibek')
  })
})
