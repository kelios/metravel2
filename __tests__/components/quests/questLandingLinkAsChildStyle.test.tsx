/**
 * Стиль прямого ребёнка `<Link asChild>`.
 *
 * `expo-router` отдаёт ребёнка в Radix `Slot`, а тот сливает стили спредом
 * (`node_modules/@radix-ui/react-slot/dist/index.js:118`:
 * `overrideProps.style = { ...slotPropValue, ...childPropValue }`). Функция
 * `({ pressed }) => [...]` и массив после спреда превращаются в `{}` — ссылка
 * теряет рамку, отступы и `flexDirection: 'row'`. На проде 21.09.2026 так и
 * выглядел список городов страны: имя, счётчик и стрелка шли в столбик без
 * карточки (`getComputedStyle(a).flexDirection === 'column'`, `borderWidth 0px`).
 *
 * Мок `Link` обязан повторять это слияние, иначе тест регрессию не увидит.
 */
import React from 'react'
import { StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'

import QuestCityLandingSections from '@/components/quests/QuestCityLandingSections'
import QuestCountryLandingSections from '@/components/quests/QuestCountryLandingSections'

jest.mock('expo-router', () => {
  const ReactMock = require('react')
  return {
    Link: ({ children, style }: { children?: unknown; style?: unknown }) => {
      const child = ReactMock.Children.only(children)
      return ReactMock.cloneElement(child, {
        style: { ...(style as object), ...(child.props.style as object) },
      })
    },
  }
})

jest.mock('@expo/vector-icons/Feather', () => () => null)

const COUNTRY = {
  countryCode: 'by',
  countryAlias: 'belarus',
  countryName: 'Беларусь',
  quests: [{ id: 'q1' }, { id: 'q2' }],
  cities: [
    { cityAlias: 'baranovichi', cityName: 'Барановичи', questCount: 2, cityIds: ['1'], quests: [{ id: 'q1' }] },
    { cityAlias: 'brest', cityName: 'Брест', questCount: 5, cityIds: ['2'], quests: [{ id: 'q2' }] },
  ],
} as never

const CITY = {
  segment: 'minsk',
  alias: 'minsk',
  cityId: '1',
  cityIds: ['1'],
  legacyAliases: [],
  cityName: 'Минск',
  countryName: 'Беларусь',
  countryCode: 'by',
  lat: 53.9,
  lng: 27.56,
  quests: [{ id: 'q1', title: 'Квест', points: 2, cityId: '1' }],
} as never

const NEARBY = [
  {
    segment: 'brest',
    cityName: 'Брест',
    distanceKm: 340,
    quests: [{ id: 'q2' }],
  },
] as never

describe('вёрстка ссылок лендингов квестов', () => {
  it('карточка города страны сохраняет рамку и колонку после слияния стилей Slot', () => {
    render(<QuestCountryLandingSections country={COUNTRY} />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)

    const style = StyleSheet.flatten(links[0].props.style)
    expect(style.borderWidth).toBe(1)
    expect(style.minHeight).toBe(52)
    expect(style.flexBasis).toBe(240)
    // На 320-точечном экране контейнеру остаётся ровно 240 px, при делении экрана и зуме — меньше:
    // без сжатия карточка вылезает за рамку секции.
    expect(style.flexShrink).toBe(1)
    // Неполный последний ряд: без потолка одинокая карточка растянулась бы на всю секцию.
    expect(style.maxWidth).toBe(400)
    expect(style.paddingHorizontal).toBe(12)
    expect(screen.getByText('Барановичи')).toBeTruthy()
  })

  it('карточка соседнего города сохраняет рамку после слияния стилей Slot', () => {
    render(<QuestCityLandingSections city={CITY} nearbyCities={NEARBY} walk={null} />)

    const links = screen.getAllByRole('link')
    expect(links.length).toBeGreaterThan(0)

    const style = StyleSheet.flatten(links[0].props.style)
    expect(style.borderWidth).toBe(1)
    expect(style.minHeight).toBe(52)
    expect(style.flexBasis).toBe(240)
    expect(style.flexShrink).toBe(1)
    expect(style.maxWidth).toBe(400)
  })
})
