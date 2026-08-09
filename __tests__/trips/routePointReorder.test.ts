import {
  moveItem,
  remapIndexAfterMove,
  resolveDropIndex,
  type RouteRowSpan,
} from '@/components/trips/planning/routePointReorder'

const ROW_HEIGHT = 80
const ROW_GAP = 8
const ROW_PITCH = ROW_HEIGHT + ROW_GAP

const spans = (count: number): RouteRowSpan[] =>
  Array.from({ length: count }, (_, index) => ({ y: index * ROW_PITCH, height: ROW_HEIGHT }))

const centerOf = (index: number) => index * ROW_PITCH + ROW_HEIGHT / 2

describe('moveItem', () => {
  it('moves an item to an arbitrary position', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 3)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('keeps the list untouched for a no-op or out-of-range move', () => {
    const list = ['a', 'b', 'c']
    expect(moveItem(list, 1, 1)).toBe(list)
    expect(moveItem(list, 0, -1)).toBe(list)
    expect(moveItem(list, 0, 3)).toBe(list)
    expect(moveItem(list, 5, 0)).toBe(list)
  })

  it('does not lose points on a long route', () => {
    const route = Array.from({ length: 25 }, (_, index) => `p${index}`)
    const reordered = moveItem(route, 19, 1)

    expect(reordered).toHaveLength(25)
    expect(reordered[1]).toBe('p19')
    expect(new Set(reordered).size).toBe(25)
  })
})

describe('remapIndexAfterMove', () => {
  it('follows the dragged row', () => {
    expect(remapIndexAfterMove(3, 3, 0)).toBe(0)
  })

  it('shifts a watched row that the move steps over', () => {
    expect(remapIndexAfterMove(2, 0, 4)).toBe(1)
    expect(remapIndexAfterMove(2, 4, 0)).toBe(3)
    expect(remapIndexAfterMove(2, 4, 2)).toBe(3)
  })

  it('leaves untouched rows and empty selection alone', () => {
    expect(remapIndexAfterMove(0, 2, 4)).toBe(0)
    expect(remapIndexAfterMove(5, 1, 3)).toBe(5)
    expect(remapIndexAfterMove(null, 1, 3)).toBeNull()
    expect(remapIndexAfterMove(2, 1, 1)).toBe(2)
  })
})

describe('resolveDropIndex', () => {
  it('keeps the row in place while the drag stays inside its own span', () => {
    expect(resolveDropIndex(spans(5), 2, 0)).toBe(2)
    expect(resolveDropIndex(spans(5), 2, ROW_HEIGHT / 2 - 1)).toBe(2)
  })

  it('drops point #20 onto position #2 of a 25-point route', () => {
    const deltaY = centerOf(1) - centerOf(19)

    expect(resolveDropIndex(spans(25), 19, deltaY)).toBe(1)
  })

  it('clamps to the ends of the list', () => {
    expect(resolveDropIndex(spans(25), 19, -10_000)).toBe(0)
    expect(resolveDropIndex(spans(25), 3, 10_000)).toBe(24)
  })

  it('uses measured heights instead of a fixed pitch', () => {
    // Первая строка вдвое выше остальных: деление дельты на «высоту строки»
    // промахнулось бы мимо цели.
    const uneven: RouteRowSpan[] = [
      { y: 0, height: 160 },
      { y: 168, height: 80 },
      { y: 256, height: 80 },
    ]

    expect(resolveDropIndex(uneven, 2, -1)).toBe(2)
    expect(resolveDropIndex(uneven, 2, -100)).toBe(1)
    expect(resolveDropIndex(uneven, 2, -220)).toBe(0)
  })

  it('is a no-op without a measured source row or with a single row', () => {
    expect(resolveDropIndex([undefined, { y: 88, height: 80 }], 0, 500)).toBe(0)
    expect(resolveDropIndex(spans(1), 0, 500)).toBe(0)
  })
})
