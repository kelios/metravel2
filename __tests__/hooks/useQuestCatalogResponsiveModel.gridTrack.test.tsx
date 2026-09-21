// #2005: колонку каталога `/quests` задаёт CSS-сетка
// `repeat(auto-fill, minmax(min(100%, 380px), 1fr))`, а ширину карточки
// считала модель от вьюпорта. На 1024 модель видела контент 660 при реальном
// контейнере 606 и отдавала карточку 318 в колонку 606. Теперь web-сетка
// меряется, а трек считается той же формулой, по которой раскладывает CSS.

import { Platform, type LayoutChangeEvent, type View } from 'react-native'
import { act, renderHook } from '@testing-library/react-native'

import { getQuestGridTrack, useQuestGridCardWidth } from '@/hooks/useQuestCatalogResponsiveModel'
import { QUESTS_GRID_MIN_COLUMN_WIDTH, QUESTS_GRID_WEB_GAP } from '@/constants/questLayout'

// Эталон по спецификации CSS Grid, перебором и независимо от формулы под
// проверкой: auto-fill берёт наибольшее число повторов, при котором минимумы
// треков вместе с зазорами не переполняют контейнер, но не меньше одного.
const cssAutoFillTrack = (container: number) => {
  const min = Math.min(container, QUESTS_GRID_MIN_COLUMN_WIDTH)
  let columns = 1
  while ((columns + 1) * min + columns * QUESTS_GRID_WEB_GAP <= container) columns += 1
  return { columns, cardWidth: (container - QUESTS_GRID_WEB_GAP * (columns - 1)) / columns }
}

const layoutEvent = (width: number) =>
  ({ nativeEvent: { layout: { x: 0, y: 0, width, height: 1200 } } }) as LayoutChangeEvent

describe('трек CSS-сетки каталога', () => {
  it.each([
    [300, 1, 300],
    [358, 1, 358],
    [606, 1, 606],
    [791, 1, 791],
    [792, 2, 380],
    [862, 2, 415],
    [1022, 2, 495],
    [1203, 2, 585.5],
    [1204, 3, 380],
    [1300, 3, 412],
  ])('контейнер %i px: колонок %i, трек %f px', (container, columns, cardWidth) => {
    const track = getQuestGridTrack(container)
    expect(track).toEqual({ columns, cardWidth })
    expect(track.cardWidth * track.columns + QUESTS_GRID_WEB_GAP * (track.columns - 1)).toBe(container)
  })

  it('совпадает с auto-fill по спецификации на всём диапазоне ширин', () => {
    const mismatches: number[] = []
    for (let container = 1; container <= 2600; container += 1) {
      const actual = getQuestGridTrack(container)
      const expected = cssAutoFillTrack(container)
      if (actual.columns !== expected.columns || Math.abs(actual.cardWidth - expected.cardWidth) > 1e-9) {
        mismatches.push(container)
      }
    }
    expect(mismatches).toEqual([])
  })
})

describe('ширина карточки по измеренной web-сетке', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'web')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  const renderGridHook = (enabled = true) => {
    let renders = 0
    const hook = renderHook(
      ({ on }: { on: boolean }) => {
        renders += 1
        return useQuestGridCardWidth(318, on)
      },
      { initialProps: { on: enabled } },
    )
    return { ...hook, renders: () => renders }
  }

  it.each([[606, 606], [862, 415], [1022, 495]])('сетка %i px даёт карточку %i px', (gridWidth, cardWidth) => {
    const { result } = renderGridHook()
    expect(result.current.cardWidth).toBe(318)

    act(() => result.current.onGridLayout(layoutEvent(gridWidth)))
    expect(result.current.cardWidth).toBe(cardWidth)
  })

  it('layout той же ширины не перерисовывает каталог', () => {
    const { result, renders } = renderGridHook()
    act(() => result.current.onGridLayout(layoutEvent(862)))
    const settled = renders()

    // onLayout сетки приходит на каждое раскрытие окна по высоте при той же ширине.
    act(() => result.current.onGridLayout(layoutEvent(862)))
    act(() => result.current.onGridLayout(layoutEvent(862.4)))
    expect({ renders: renders() - settled, cardWidth: result.current.cardWidth }).toEqual({
      renders: 0,
      cardWidth: 415,
    })
  })

  it('скрытая сетка (ширина 0) не сбрасывает замер к ширине модели', () => {
    const { result } = renderGridHook()
    act(() => result.current.onGridLayout(layoutEvent(606)))
    act(() => result.current.onGridLayout(layoutEvent(0)))
    expect(result.current.cardWidth).toBe(606)
  })

  it('меряет сетку при монтировании, не дожидаясь onLayout', () => {
    const node = document.createElement('div')
    node.getBoundingClientRect = () => ({ width: 606.4 }) as DOMRect
    const { result, rerender } = renderGridHook(false)
    result.current.gridRef.current = node as unknown as View

    rerender({ on: true })
    expect(result.current.cardWidth).toBe(606)
  })

  // Масштаб 125 % или зум страницы дают дробный контейнер. onLayout RNW отдаёт
  // округлённый `offsetWidth`: 791.6 → 792, а это уже две колонки по 380, хотя
  // CSS кладёт одну колонку 791.6 — исходный дефект в полосе шириной 1 px.
  it.each([
    [791.6, 792, 791],
    [1203.5, 1204, 585.5],
  ])('дробный контейнер %f px (offsetWidth %i) не получает лишнюю колонку', (rectWidth, offsetWidth, cardWidth) => {
    const node = document.createElement('div')
    node.getBoundingClientRect = () => ({ width: rectWidth }) as DOMRect
    const { result, rerender } = renderGridHook(false)
    result.current.gridRef.current = node as unknown as View

    rerender({ on: true })
    act(() => result.current.onGridLayout(layoutEvent(offsetWidth)))
    const css = cssAutoFillTrack(rectWidth)
    expect(result.current.cardWidth).toBe(cardWidth)
    expect(css.cardWidth - result.current.cardWidth).toBeGreaterThanOrEqual(0)
    expect(css.cardWidth - result.current.cardWidth).toBeLessThan(1)
  })

  it('без смонтированной сетки отдаёт ширину модели', () => {
    const { result, rerender } = renderGridHook()
    act(() => result.current.onGridLayout(layoutEvent(606)))

    rerender({ on: false })
    expect(result.current.cardWidth).toBe(318)
  })
})

describe('native сетку не меряет', () => {
  it('отдаёт ширину модели и не перерисовывается на layout', () => {
    expect(Platform.OS).not.toBe('web')
    let renders = 0
    const { result } = renderHook(() => {
      renders += 1
      return useQuestGridCardWidth(318, true)
    })
    const initial = renders

    act(() => result.current.onGridLayout(layoutEvent(606)))
    expect({ renders: renders - initial, cardWidth: result.current.cardWidth }).toEqual({
      renders: 0,
      cardWidth: 318,
    })
  })
})
