import React from 'react'
import { ScrollView } from 'react-native'
import { act, render } from '@testing-library/react-native'

import HomeHeroMoodRail from '@/components/home/HomeHeroMoodRail'
import type { MoodCard } from '@/components/home/homeHeroContent'

// Фон темы намеренно отличается от фона героя: так тест ловит откат затухания
// на дефолт `EdgeFadeScrollRow` вместо фактического фона под рядом.
jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({ surface: '#ffffff', background: '#ffffff' }),
}))

// Общий мок из `__mocks__` срезает `colors`, а здесь проверяются именно они.
jest.mock('expo-linear-gradient', () => {
  const ReactModule = require('react')
  const { View } = require('react-native')
  return {
    __esModule: true,
    LinearGradient: (props: Record<string, any>) =>
      ReactModule.createElement(View, {
        testID: props.testID,
        style: props.style,
        colors: props.colors,
      }),
  }
})

/** `warmBg` в `homeHeroStyles` — это `colors.background` героя. */
const HERO_BACKGROUND = '#fdfcfb'

const MOOD_CARDS: readonly MoodCard[] = [
  { title: 'У воды', icon: 'droplet', filters: { categoryTravelAddress: [84] }, route: '/search' },
  { title: 'Замки', icon: 'flag', filters: { categoryTravelAddress: [33] }, route: '/search' },
  { title: 'Руины', icon: 'layers', filters: { categoryTravelAddress: [114] }, route: '/search' },
]

const styles = {
  moodChipsContainer: { width: '100%' },
  moodChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  moodChipsScrollContent: { flexDirection: 'row', gap: 12 },
  moodChip: { flexDirection: 'row' },
  moodChipWrapItem: { flexGrow: 1 },
  moodChipHover: {},
  moodChipTitle: { fontSize: 16 },
}

const renderRail = (props: Record<string, unknown> = {}) =>
  render(
    <HomeHeroMoodRail
      colors={{ textMuted: '#6b6b6b', primary: '#ff9f5a', background: HERO_BACKGROUND }}
      styles={styles}
      isMobile={false}
      isWeb={false}
      moodCards={MOOD_CARDS}
      onQuickFilterPress={jest.fn()}
      {...props}
    />,
  )

const scrollEvent = (offsetX: number, layoutWidth: number, contentWidth: number) => ({
  nativeEvent: {
    contentOffset: { x: offsetX },
    layoutMeasurement: { width: layoutWidth },
    contentSize: { width: contentWidth },
  },
})

describe('HomeHeroMoodRail', () => {
  it('не затухает, пока ряд помещается целиком', () => {
    // Снятая маска (#1682) гасила края всегда — в том числе первый пункт
    // на десктопе, где прокручивать некуда вовсе.
    const { UNSAFE_getByType, queryByTestId } = renderRail()
    const scroll = UNSAFE_getByType(ScrollView)

    act(() => {
      scroll.props.onLayout({ nativeEvent: { layout: { width: 1180 } } })
      scroll.props.onContentSizeChange(720, 48)
    })

    expect(queryByTestId('edge-fade-left')).toBeNull()
    expect(queryByTestId('edge-fade-right')).toBeNull()
  })

  it('показывает затухание только с той стороны, где есть продолжение', () => {
    const { UNSAFE_getByType, queryByTestId } = renderRail()
    const scroll = UNSAFE_getByType(ScrollView)

    act(() => {
      scroll.props.onLayout({ nativeEvent: { layout: { width: 390 } } })
      scroll.props.onContentSizeChange(700, 48)
    })

    expect(queryByTestId('edge-fade-left')).toBeNull()
    expect(queryByTestId('edge-fade-right')).toBeTruthy()

    act(() => {
      scroll.props.onScroll(scrollEvent(310, 390, 700))
    })

    expect(queryByTestId('edge-fade-left')).toBeTruthy()
    expect(queryByTestId('edge-fade-right')).toBeNull()
  })

  it('затухает в фон героя, а не в цвет поверхности из темы', () => {
    const { UNSAFE_getByType, getByTestId } = renderRail()
    const scroll = UNSAFE_getByType(ScrollView)

    act(() => {
      scroll.props.onScroll(scrollEvent(120, 390, 700))
    })

    expect(getByTestId('edge-fade-left').props.colors).toEqual([
      HERO_BACKGROUND,
      'rgba(253, 252, 251, 0)',
    ])
    expect(getByTestId('edge-fade-right').props.colors).toEqual([
      'rgba(253, 252, 251, 0)',
      HERO_BACKGROUND,
    ])
  })

  it('сохраняет состав и порядок карточек ряда', () => {
    const { getAllByRole } = renderRail()

    expect(getAllByRole('button').map((node) => node.props.accessibilityLabel)).toEqual([
      expect.stringContaining('У воды'),
      expect.stringContaining('Замки'),
      expect.stringContaining('Руины'),
    ])
  })

  it('на телефоне остаётся раскладка переносом, без ряда прокрутки', () => {
    const { UNSAFE_queryByType, getAllByRole } = renderRail({ isMobile: true })

    expect(UNSAFE_queryByType(ScrollView)).toBeNull()
    expect(getAllByRole('button')).toHaveLength(MOOD_CARDS.length)
  })
})
