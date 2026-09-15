// #1947 (IOS-06). Ряд быстрых переходов на телефоне — закреплённая полоса над
// контентом статьи: её высота равна отступам чипа плюс `lineHeight` подписи.
// На iOS-ступенях раздела «Увеличенные размеры» множитель шрифта доходит до
// 3.571, и без потолка полоса занимает десятую часть экрана, а чип перестаёт
// помещаться в видимую часть ряда. Тест держит сам факт потолка и его границы:
// он обязан быть выше максимальной НЕ-accessibility ступени iOS (1.353), чтобы
// обычные ступени не потеряли ни пункта роста, и конечным, чтобы полоса не
// росла без предела.
import { StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'

import TravelHeroQuickJumps from '@/components/travel/details/TravelHeroQuickJumps'

const links = [
  { key: 'map', label: 'Карта маршрута', icon: 'map' },
  { key: 'description', label: 'Описание', icon: 'file-text' },
  { key: 'points', label: 'Координаты мест', icon: 'list' },
]

/** Максимальная НЕ-accessibility ступень iOS, `RCTUtils.mm`. */
const IOS_MAX_NON_ACCESSIBILITY_MULTIPLIER = 1.353

const renderRow = (isMobile: boolean) =>
  render(
    <TravelHeroQuickJumps
      links={links as any}
      isMobile={isMobile}
      onQuickJump={jest.fn()}
      activeKey="map"
    />,
  )

describe('TravelHeroQuickJumps — системное увеличение шрифта', () => {
  it.each([true, false])(
    'ограничивает рост подписи чипа на закреплённой полосе (isMobile=%s)',
    (isMobile) => {
      renderRow(isMobile)

      for (const link of links) {
        const cap = screen.getByTestId(`travel-quick-jump-label-${link.key}`).props
          .maxFontSizeMultiplier

        expect(typeof cap).toBe('number')
        expect(Number.isFinite(cap)).toBe(true)
        expect(cap).toBeGreaterThan(IOS_MAX_NON_ACCESSIBILITY_MULTIPLIER)
      }
    },
  )

  it('не обрезает подпись принудительно одной строкой', () => {
    renderRow(true)

    for (const link of links) {
      const label = screen.getByTestId(`travel-quick-jump-label-${link.key}`)

      expect(label.props.numberOfLines).toBeUndefined()
    }
  })

  it('не задаёт чипу фиксированную высоту — потолок гасит масштаб, а не перенос', () => {
    renderRow(true)

    const chip = StyleSheet.flatten(screen.getByTestId('travel-quick-jump-map').props.style)

    expect(chip.height).toBeUndefined()
    expect(chip.maxHeight).toBeUndefined()
    expect(chip.minHeight).toBeGreaterThanOrEqual(44)
  })
})
