// #2289: витрина «Идеи для ближайших выходных» — число колонок только от
// ширины вьюпорта, число карточек — только полные ряды (одна колонка — до трёх).

import {
  chunkArray,
  getShowcaseCardCount,
  getShowcaseColumns,
} from '@/components/home/homeShowcaseGrid'

describe('#2289 правило колонок и карточек витрины главной', () => {
  it.each([
    [0, 1],
    [320, 1],
    [390, 1],
    [599, 1],
    [600, 2],
    [768, 2],
    [1023, 2],
    [1024, 3],
    [1440, 3],
    [1920, 3],
  ])('%ipx → %i колонок', (width, columns) => {
    expect(getShowcaseColumns(width)).toBe(columns)
  })

  // Ожидание по n = 1..6 для каждой ширины.
  const EXPECTED: Record<number, number[]> = {
    320: [1, 2, 3, 3, 3, 3],
    390: [1, 2, 3, 3, 3, 3],
    600: [1, 2, 2, 4, 4, 4],
    768: [1, 2, 2, 4, 4, 4],
    1024: [1, 2, 3, 3, 3, 6],
    1440: [1, 2, 3, 3, 3, 6],
  }

  for (const [width, counts] of Object.entries(EXPECTED)) {
    it(`${width}px: n = 1..6 → ${counts.join('/')}`, () => {
      const columns = getShowcaseColumns(Number(width))
      expect([1, 2, 3, 4, 5, 6].map((n) => getShowcaseCardCount(n, columns))).toEqual(counts)
    })
  }

  it('при колонках > 1 видимые ряды полные, кроме случая n < cols', () => {
    for (const columns of [2, 3]) {
      for (let n = 1; n <= 6; n += 1) {
        const visible = getShowcaseCardCount(n, columns)
        const rows = chunkArray(Array.from({ length: visible }, (_, i) => i), columns)
        const partial = rows.filter((row) => row.length < columns)
        expect(partial.length === 0 || (rows.length === 1 && n < columns)).toBe(true)
      }
    }
  })

  it('пустые данные дают ноль карточек', () => {
    expect(getShowcaseCardCount(0, 1)).toBe(0)
    expect(getShowcaseCardCount(0, 3)).toBe(0)
  })
})
