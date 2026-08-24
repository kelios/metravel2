import { getTravelDetailsListColumnWidth } from '@/components/travel/utils/travelDetailsListLayout'

describe('getTravelDetailsListColumnWidth (#1544)', () => {
  it('sizes the 3-column desktop grid to the column, not the 720 viewport fallback', () => {
    // База срезана на desktop-брейкпоинте (1280), где появляется flex-меню.
    expect(getTravelDetailsListColumnWidth(1280, 3)).toBe(403)
    expect(getTravelDetailsListColumnWidth(1600, 3)).toBe(403)
    expect(getTravelDetailsListColumnWidth(1920, 3)).toBe(403)
    // Ниже брейкпоинта меню ещё нет — колонка уже реального вьюпорта.
    expect(getTravelDetailsListColumnWidth(1024, 3)).toBe(318)
  })

  it('sizes the 2-column tablet grid from the full-width content', () => {
    expect(getTravelDetailsListColumnWidth(768, 2)).toBe(349)
    expect(getTravelDetailsListColumnWidth(1023, 2)).toBe(476)
  })

  it('caps a single full-width column at the 720 step', () => {
    expect(getTravelDetailsListColumnWidth(700, 1)).toBe(700)
    expect(getTravelDetailsListColumnWidth(900, 1)).toBe(720)
  })

  it('stays an over-estimate of the real rendered columns (no cover blur)', () => {
    // Замер прода 2026-08-24 (DPR 1): реальная колонка на этих вьюпортах.
    const realColumns: Array<[number, number, number]> = [
      // [viewport, numColumns, measuredColumnPx]
      [1024, 3, 307],
      [1280, 3, 285],
      [1440, 3, 317],
      [1600, 3, 352],
      [1920, 3, 348],
    ]
    for (const [vw, cols, real] of realColumns) {
      expect(getTravelDetailsListColumnWidth(vw, cols)).toBeGreaterThanOrEqual(real)
    }
  })

  it('keeps every multi-column estimate within the ≤640w cover budget', () => {
    // Ступень srcSet для квадратного слота выбирается по этой ширине; всё, что
    // ≤640, на DPR 1 берёт w≤640 — цель Done gate #1544.
    for (const vw of [1024, 1280, 1440, 1600, 1920]) {
      expect(getTravelDetailsListColumnWidth(vw, 3)).toBeLessThanOrEqual(640)
    }
    for (const vw of [768, 900, 1023]) {
      expect(getTravelDetailsListColumnWidth(vw, 2)).toBeLessThanOrEqual(640)
    }
  })

  it('falls back safely on degenerate input', () => {
    // SSR/первый клиентский кадр: width=0 → база 1024, а не деление на ноль.
    expect(getTravelDetailsListColumnWidth(0, 3)).toBe(318)
    expect(getTravelDetailsListColumnWidth(1280, 0)).toBe(
      getTravelDetailsListColumnWidth(1280, 1),
    )
  })
})
