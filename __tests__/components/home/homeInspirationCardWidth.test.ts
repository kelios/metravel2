// #2289 (на смену #1487 getEditorialCardWidth): оценка ширины карточки ровной
// сетки витрины главной для sizes/srcSet обложки. Обязана быть оценкой СВЕРХУ
// (#1285: занижение = мыло на DPR 1), но не вьюпортом целиком (ступень srcSet
// втрое крупнее отрисовки). Фактическая ширина карточки — из полей секции:
// ResponsiveContainer (16/32/40) + рамка витрины (16/32) + border 1, сетка не
// шире 1136, gap 16.

import { getShowcaseCardWidth, getShowcaseColumns } from '@/components/home/homeShowcaseGrid'
import { COVER_WIDTH_LADDER } from '@/components/listTravel/travelListItemHelpers'

// Ширина карточки по фактическим полям секции при узкой полосе скроллбара 0.
function actualCardWidth(viewportWidth: number) {
  const containerPad = viewportWidth < 768 ? 16 : viewportWidth < 1024 ? 32 : 40
  const framePad = viewportWidth < 768 ? 16 : 32
  const containerMax = viewportWidth >= 1920 ? 1536 : 1280
  const content = Math.min(viewportWidth, containerMax) - 2 * (containerPad + framePad + 1)
  const columns = getShowcaseColumns(viewportWidth)
  const grid = Math.min(content, 1136)
  return (grid - (columns - 1) * 16) / columns
}

describe('#2289 оценка ширины карточки ровной сетки витрины главной', () => {
  it.each([
    [768, 303],
    [1024, 277],
    [1280, 362],
    [1440, 367],
    [1920, 368],
  ])('на %ipx оценка не ниже живого замера ≈%ipx', (viewport, measured) => {
    const columns = getShowcaseColumns(viewport)
    expect(getShowcaseCardWidth(columns, viewport)).toBeGreaterThanOrEqual(measured)
  })

  it.each([600, 700, 767, 768, 810, 834, 900, 1023, 1024, 1100, 1200, 1280, 1440, 1920, 2560])(
    'на %ipx оценка сверху от фактической ширины не больше чем на округление',
    (viewport) => {
      const columns = getShowcaseColumns(viewport)
      const estimate = getShowcaseCardWidth(columns, viewport)
      const actual = actualCardWidth(viewport)
      expect(estimate).toBeGreaterThanOrEqual(actual)
      expect(estimate - actual).toBeLessThan(1)
    },
  )

  // Завышение, перескакивающее ступень srcSet, тянет обложку крупнее нужной:
  // iPad 810–834 DPR 2 — 960w вместо 720w, 1059–1138 DPR 1 — 480w вместо 320w.
  it('оценка выбирает ту же ступень srcSet, что и фактическая ширина (DPR 1/2/3)', () => {
    const step = (width: number) => COVER_WIDTH_LADDER.find((w) => w >= width) ?? Infinity
    for (let viewport = 600; viewport <= 2560; viewport += 1) {
      const estimate = getShowcaseCardWidth(getShowcaseColumns(viewport), viewport)
      const actual = actualCardWidth(viewport)
      for (const dpr of [1, 2, 3]) {
        // Ступень по ceil(actual): оценка округляет вверх до целого пикселя.
        expect([viewport, dpr, step(estimate * dpr)]).toEqual([viewport, dpr, step(Math.ceil(actual) * dpr)])
      }
    }
  })

  it('потолок сетки 1136: на широком мониторе карточка не растёт', () => {
    expect(getShowcaseCardWidth(3, 1920)).toBe(368)
    expect(getShowcaseCardWidth(3, 2560)).toBe(368)
  })

  it('узкие вьюпорты не дают отрицательных и нулевых оценок', () => {
    expect(getShowcaseCardWidth(3, 0)).toBeGreaterThan(0)
    expect(getShowcaseCardWidth(2, 320)).toBeGreaterThan(0)
  })
})
