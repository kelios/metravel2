/**
 * Регрессия #1279: `floating`-полоса чипов не имеет права растягиваться.
 *
 * Она рендерится внутри абсолютного оверлея карты (`MapMobileTopOverlay`,
 * `zIndex: 1500`), то есть НАД шторкой фильтров. Горизонтальный `ScrollView`
 * внутри неё на native не получал ограничения по высоте и растягивался на всю
 * свободную высоту оверлея — замер на устройстве (Pixel 10 Pro) дал
 * `[503,322][1054,2410]`, до самого низа экрана. Android детей не обрезает,
 * поэтому пустой прозрачный прямоугольник ложился поверх шторки и съедал тапы
 * по ✕, полю поиска и сегмент-табам: RN отдаёт тач верхнему вью, разрешённому
 * `pointerEvents`, и ниже событие не идёт.
 *
 * Пользователь оказывался заперт в шторке. Поэтому проверяем не «кнопка ✕
 * вызывает обработчик» (он и был исправен — тот же вызов из системного «назад»
 * работал), а сам инвариант: у полосы КОНЕЧНАЯ высота.
 */
import { render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { ActiveFiltersBar } from '@/components/MapPage/ActiveFiltersBar'

const filters = [
  { key: 'category', label: 'Церковь' },
  { key: 'tag', label: 'Родник' },
]

const renderBar = (variant: 'panel' | 'floating') =>
  render(
    <ActiveFiltersBar
      testID="active-filters"
      variant={variant}
      filters={filters}
      onRemoveFilter={jest.fn()}
      onClearAll={jest.fn()}
    />,
  )

describe('ActiveFiltersBar — границы floating-полосы (#1279)', () => {
  it('floating-контейнер объявляет конечную высоту', () => {
    const { getByTestId } = renderBar('floating')
    const style = StyleSheet.flatten(getByTestId('active-filters').props.style)

    const bound = style.maxHeight ?? style.height
    expect(typeof bound).toBe('number')
    expect(bound).toBeGreaterThan(0)
    // Полоса чипов — один ряд. Всё, что заметно выше тач-таргета, означает,
    // что она снова способна накрыть шторку под собой.
    expect(bound).toBeLessThanOrEqual(48)
  })

  it('не растягивается по вертикали флексом', () => {
    const { getByTestId } = renderBar('floating')
    const style = StyleSheet.flatten(getByTestId('active-filters').props.style)

    expect(style.flex).toBeUndefined()
    expect(style.flexGrow ?? 0).toBe(0)
  })

  it('panel-вариант ограничения не требует — он в потоке, а не над шторкой', () => {
    const { getByTestId } = renderBar('panel')
    const style = StyleSheet.flatten(getByTestId('active-filters').props.style)

    expect(style.flex).toBeUndefined()
  })

  it('без активных фильтров не рендерит ничего', () => {
    const { queryByTestId } = render(
      <ActiveFiltersBar
        testID="active-filters"
        variant="floating"
        filters={[]}
        onRemoveFilter={jest.fn()}
        onClearAll={jest.fn()}
      />,
    )

    expect(queryByTestId('active-filters')).toBeNull()
  })
})
