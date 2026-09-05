// Номер в заголовке точки против номера, который игрок видит в кружке (#1804).
// Расходятся они ровно тогда, когда в маршрут вставлена остановка «по желанию»:
// кружок считает все точки подряд, авторская нумерация её пропускает.
const { findNumberingMismatches } = require('@/scripts/scan-quest-step-numbering')

const step = (over: Record<string, unknown> = {}) => ({
  step_id: 'point',
  title: 'Точка',
  order: 1,
  is_intro: false,
  ...over,
})

const bundle = { quest_id: 'kids-quest' }

describe('findNumberingMismatches', () => {
  it('молчит, когда номера идут подряд', () => {
    const steps = [
      step({ step_id: 'intro', is_intro: true, order: 0, title: 'Интро' }),
      step({ step_id: '1-a', order: 1, title: '1. Первая' }),
      step({ step_id: '2-b', order: 2, title: '2. Вторая' }),
    ]
    expect(findNumberingMismatches(bundle, steps)).toEqual([])
  })

  it('ловит сдвиг от вставленной остановки «по желанию»', () => {
    const steps = [
      step({ step_id: 'intro', is_intro: true, order: 0, title: 'Интро' }),
      step({ step_id: '1-a', order: 1, title: '1. Первая' }),
      step({ step_id: 'icecream', order: 2, title: '✨ Мороженое (по желанию)' }),
      step({ step_id: '2-b', order: 3, title: '2. Вторая' }),
    ]
    expect(findNumberingMismatches(bundle, steps)).toEqual([
      expect.objectContaining({ stepId: '2-b', titleNumber: 2, position: 3 }),
    ])
  })

  it('не требует номера от точек без него — привал его не имеет по замыслу', () => {
    const steps = [
      step({ step_id: 'cafe', order: 1, title: '☕ Кофе (по желанию)' }),
      step({ step_id: '1-a', order: 2, title: '2. Первая' }),
    ]
    expect(findNumberingMismatches(bundle, steps)).toEqual([])
  })

  it('считает позицию по order, а не по порядку в массиве', () => {
    const steps = [
      step({ step_id: '2-b', order: 2, title: '2. Вторая' }),
      step({ step_id: '1-a', order: 1, title: '1. Первая' }),
    ]
    expect(findNumberingMismatches(bundle, steps)).toEqual([])
  })

  it('интро в нумерации не участвует', () => {
    const steps = [
      step({ step_id: 'intro', is_intro: true, order: 0, title: '1. Интро' }),
      step({ step_id: '1-a', order: 1, title: '1. Первая' }),
    ]
    expect(findNumberingMismatches(bundle, steps)).toEqual([])
  })

  it('понимает и «1)» как номер', () => {
    const steps = [
      step({ step_id: '1-a', order: 1, title: '1) Первая' }),
      step({ step_id: '2-b', order: 2, title: '3) Третья' }),
    ]
    expect(findNumberingMismatches(bundle, steps)).toEqual([
      expect.objectContaining({ stepId: '2-b', titleNumber: 3, position: 2 }),
    ])
  })
})
