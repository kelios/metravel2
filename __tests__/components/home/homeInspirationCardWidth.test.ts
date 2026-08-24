// #1487, прогон гейта #3, finding P2: оценка ширины карточки редакционной
// сетки обязана зеркалить span'ы getEditorialCardStyle. Индексная оценка без
// учёта span давала нижней ШИРОКОЙ карточке (index 3, gridColumn '6 / span 7')
// sizes узкого слота — 493px на отрисовке 643px, мыло на DPR 1. Живой замер
// прода 2026-08-23: hero 643, стек 454 при контенте секции ~1170 на 1280.

import { getEditorialCardWidth } from '@/components/home/HomeInspirationSection'

describe('#1487 оценка ширины карточек редакционной сетки главной', () => {
  it('оценка каждого слота — сверху от живого замера, но не вьюпорт', () => {
    // Оценка СВЕРХУ (#1285): занижение = мыло, вьюпорт целиком = ступень
    // srcSet втрое крупнее отрисовки (finding P2 прогона #3).
    expect(getEditorialCardWidth(0, 4, 1280)).toBeGreaterThanOrEqual(643)
    expect(getEditorialCardWidth(0, 4, 1280)).toBeLessThan(720)
    expect(getEditorialCardWidth(1, 4, 1280)).toBeGreaterThanOrEqual(454)
    expect(getEditorialCardWidth(1, 4, 1280)).toBeLessThan(560)
  })

  it('широкие слоты — hero и нижняя stack-bottom при четырёх карточках', () => {
    const wide = getEditorialCardWidth(0, 4, 1280)
    expect(getEditorialCardWidth(3, 4, 1280)).toBe(wide)
    expect(getEditorialCardWidth(1, 4, 1280)).toBeLessThan(wide)
    expect(getEditorialCardWidth(2, 4, 1280)).toBeLessThan(wide)
  })

  it('при трёх карточках широкий только hero', () => {
    const wide = getEditorialCardWidth(0, 3, 1280)
    for (const index of [1, 2]) {
      expect(getEditorialCardWidth(index, 3, 1280)).toBeLessThan(wide)
    }
  })

  it('узкие вьюпорты не дают отрицательных и нулевых оценок', () => {
    expect(getEditorialCardWidth(0, 4, 320)).toBeGreaterThan(0)
    expect(getEditorialCardWidth(2, 4, 320)).toBeGreaterThan(0)
  })
})
