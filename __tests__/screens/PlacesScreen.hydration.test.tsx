import { render } from '@testing-library/react-native'
import { Platform, StyleSheet } from 'react-native'

import { createQueryWrapper } from '../helpers/testQueryClient'
import PlacesScreen from '@/screens/tabs/PlacesScreen'
import { fetchPlacesCatalog } from '@/api/places'
import type { PlacesCatalogPage } from '@/utils/placesCatalog'

let mockWidth = 0

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: jest.fn(), setParams: jest.fn() }),
  useIsFocused: () => true,
}))

jest.mock('@/hooks/useResponsive', () => ({
  useResponsiveWidth: () => mockWidth,
}))

jest.mock('@/api/places', () => ({ fetchPlacesCatalog: jest.fn() }))

jest.mock('@/components/seo/LazyInstantSEO', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/common/ContributionBanner', () => ({ __esModule: true, default: () => null }))
jest.mock('@/utils/externalLinks', () => ({ openExternalUrlInNewTab: jest.fn() }))

jest.mock('@/ui/paper', () => {
  const React = require('react')
  const { View, Text, Pressable } = require('react-native')
  const Menu = ({ children, anchor }: any) => (
    <View>
      {anchor}
      {children}
    </View>
  )
  Menu.Item = ({ title, onPress }: any) => (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Text>{title}</Text>
    </Pressable>
  )
  return { Menu }
})

const catalogPage: PlacesCatalogPage = {
  count: 0,
  places: [],
  categoryFacets: [],
  countryFacets: [],
}

const renderScreen = () =>
  render(<PlacesScreen />, { wrapper: createQueryWrapper().Wrapper })

// #1334: статический HTML `/places` не знает ширину окна (SSR-снимок даёт 0) и
// раньше рисовал только desktop-шапку. На мобильном компактная панель поиска
// появлялась после гидратации и опускала ScrollView каталога с y=64 на y=179 —
// CLS 0,537 в 5 прогонах из 5. Контракт: до измерения на web в разметке есть ОБЕ
// шапки, а выбирает между ними критический CSS (см. criticalCSSBuilder.test.ts).
describe('PlacesScreen pre-hydration chrome', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(fetchPlacesCatalog as jest.Mock).mockResolvedValue(catalogPage)
    ;(Platform as unknown as { OS: string }).OS = 'web'
    mockWidth = 0
  })

  it('renders both catalog headers while the width is unknown', () => {
    const { getByTestId } = renderScreen()

    expect(getByTestId('places-compact-bar')).toBeTruthy()
    expect(getByTestId('places-topbar')).toBeTruthy()
    expect(getByTestId('places-sidebar')).toBeTruthy()
    expect(getByTestId('places-main')).toBeTruthy()
    expect(getByTestId('places-cards-grid')).toBeTruthy()
    const layout = getByTestId('places-layout')
    expect(layout.props.dataSet).toMatchObject({ placesPrehydration: 'true' })
    expect(StyleSheet.flatten(layout.props.style)).toMatchObject({
      minHeight: 'calc(100vh - 168px)',
    })
  })

  it('keeps only the compact bar once a phone width is measured', () => {
    mockWidth = 412
    const { getByTestId, queryByTestId } = renderScreen()

    expect(getByTestId('places-compact-bar')).toBeTruthy()
    expect(queryByTestId('places-topbar')).toBeNull()
    expect(queryByTestId('places-sidebar')).toBeNull()
    const layout = getByTestId('places-layout')
    expect(layout.props.dataSet).toBeUndefined()
    expect(StyleSheet.flatten(layout.props.style)).toMatchObject({
      minHeight: 'calc(100vh - 179px)',
    })
  })

  it('keeps only the desktop top bar once a wide width is measured', () => {
    mockWidth = 1280
    const { getByTestId, queryByTestId } = renderScreen()

    expect(getByTestId('places-topbar')).toBeTruthy()
    expect(queryByTestId('places-compact-bar')).toBeNull()
  })

  // На native ширина известна с первого кадра, гидратации нет — второй шапки
  // там быть не должно, иначе экран получит лишний дубль поиска.
  it('never doubles the header on native', () => {
    ;(Platform as unknown as { OS: string }).OS = 'android'
    mockWidth = 0
    const { queryByTestId } = renderScreen()

    expect(queryByTestId('places-compact-bar')).toBeNull()
  })
})
