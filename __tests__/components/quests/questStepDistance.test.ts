import {
  buildQuestFarStepModel,
  describeQuestLeg,
  questMedianLegMeters,
} from '@/components/quests/questStepDistance'

// Реальные координаты квеста 44 `oshmyany-crossroads` (прод): перегоны
// 79 / 150 / 119 / 322 / 1031 / 117 м. Игрок бросил прохождение ровно на
// километре к шестой точке.
const OSHMYANY = [
  { id: '1-sinagoga', lat: 54.425, lng: 25.933545 },
  { id: '2-muzey', lat: 54.424352, lng: 25.934042 },
  { id: '3-kostel-mihaila', lat: 54.423434, lng: 25.935747 },
  { id: '4-cerkov-voskreseniya', lat: 54.424495, lng: 25.936004 },
  { id: '5-elektrostanciya', lat: 54.423585, lng: 25.940737 },
  { id: '6-franciskancy', lat: 54.425941, lng: 25.956153 },
  { id: '7-kalvariya', lat: 54.425469, lng: 25.957763 },
]

const answersUpTo = (index: number): Record<string, string> =>
  Object.fromEntries(OSHMYANY.slice(0, index + 1).map((point) => [point.id, 'ok']))

describe('questStepDistance', () => {
  it('берёт медианный перегон маршрута как характер квеста', () => {
    expect(Math.round(questMedianLegMeters(OSHMYANY))).toBe(135)
  })

  it('не считает далёким обычный городской перегон', () => {
    const median = questMedianLegMeters(OSHMYANY)
    const leg = describeQuestLeg(322, median, 'foot')
    expect(leg.far).toBe(false)
    expect(leg.notable).toBe(false)
  })

  it('метит километр к шестой точке и предлагает закончить квест здесь', () => {
    const median = questMedianLegMeters(OSHMYANY)
    const model = buildQuestFarStepModel({
      points: OSHMYANY,
      answers: answersUpTo(4),
      currentIndex: 5,
      medianMeters: median,
      mode: 'foot',
    })

    expect(model.currentIsFar).toBe(true)
    expect(Math.round(model.approach?.meters ?? 0)).toBe(1031)
    expect(model.approach?.walkMinutes).toBe(12)
    // Седьмая точка лежит за тем же километром — впереди только далёкое.
    expect(model.canFinishHere).toBe(true)
  })

  it('оставляет седьмую точку далёкой после пропуска шестой', () => {
    const model = buildQuestFarStepModel({
      points: OSHMYANY,
      answers: answersUpTo(4),
      currentIndex: 6,
      medianMeters: questMedianLegMeters(OSHMYANY),
      mode: 'foot',
    })

    expect(model.currentIsFar).toBe(true)
    expect(model.canFinishHere).toBe(true)
  })

  it('предупреждает о длинном перегоне на карточке пройденной точки', () => {
    const model = buildQuestFarStepModel({
      points: OSHMYANY,
      answers: answersUpTo(4),
      currentIndex: 4,
      medianMeters: questMedianLegMeters(OSHMYANY),
      mode: 'foot',
    })

    expect(model.nextLeg?.notable).toBe(true)
    expect(Math.round(model.nextLeg?.meters ?? 0)).toBe(1031)
  })

  it('не метит длинный перегон там, где он — норма маршрута', () => {
    // Маршрут с медианой 900 м: абсолютный порог сработал бы на каждом шаге и
    // сделал бы необязательным весь квест.
    const uniform = [
      { id: 'a', lat: 54.0, lng: 25.0 },
      { id: 'b', lat: 54.0081, lng: 25.0 },
      { id: 'c', lat: 54.0162, lng: 25.0 },
      { id: 'd', lat: 54.0243, lng: 25.0 },
    ]
    const model = buildQuestFarStepModel({
      points: uniform,
      answers: { a: 'ok', b: 'ok' },
      currentIndex: 2,
      medianMeters: questMedianLegMeters(uniform),
      mode: 'foot',
    })

    expect(model.approach?.notable).toBe(true)
    expect(model.currentIsFar).toBe(false)
    expect(model.canFinishHere).toBe(false)
  })

  it('молчит, пока игрок не отметился ни на одной точке', () => {
    const model = buildQuestFarStepModel({
      points: OSHMYANY,
      answers: {},
      currentIndex: 5,
      medianMeters: questMedianLegMeters(OSHMYANY),
      mode: 'foot',
    })

    expect(model.approach).toBeNull()
    expect(model.currentIsFar).toBe(false)
    expect(model.canFinishHere).toBe(false)
  })
})
