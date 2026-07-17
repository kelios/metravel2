import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('@expo/vector-icons/Feather', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return ({ name }: { name: string }) => React.createElement(Text, null, name)
})

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    primary: '#f97316',
    primaryAlpha40: 'rgba(249, 115, 22, 0.4)',
    primarySoft: 'rgba(249, 115, 22, 0.12)',
    primaryText: '#9a3412',
    surface: '#ffffff',
    borderLight: '#e2e8f0',
    textMuted: '#64748b',
    textSecondary: '#475569',
  }),
}))

const ReactNative = require('react-native')
const originalPlatformOS = ReactNative.Platform.OS
const mockUseWindowDimensions = ReactNative.useWindowDimensions as jest.Mock
const ListCatalogToolbar = require('@/components/listTravel/ListCatalogToolbar').default

describe('ListCatalogToolbar', () => {
  beforeAll(() => {
    Object.defineProperty(ReactNative.Platform, 'OS', {
      value: 'web',
      configurable: true,
    })
  })

  afterAll(() => {
    Object.defineProperty(ReactNative.Platform, 'OS', {
      value: originalPlatformOS,
      configurable: true,
    })
  })

  beforeEach(() => {
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    })
  })

  it('keeps compact mobile web toolbar lean by dropping inline sort chips', () => {
    const { getByTestId, queryByLabelText, queryByTestId } = render(
      <ListCatalogToolbar
        sortOptions={[
          { id: 'newest', name: 'Новые' },
          { id: 'oldest', name: 'Старые' },
          { id: 'popular_desc', name: 'Популярные' },
        ]}
        sortValue="newest"
        onSortChange={jest.fn()}
        density="comfortable"
        onDensityChange={jest.fn()}
        resultsCount={24}
        showResultsCount
      />,
    )

    expect(getByTestId('toolbar-results-count')).toBeTruthy()
    expect(getByTestId('density-comfortable')).toBeTruthy()
    expect(queryByLabelText('Сортировка списка')).toBeNull()
    expect(queryByTestId('sort-chip-newest')).toBeNull()
  })

  it.each([768, 1024, 1280])(
    'keeps inline sorting in the filters sheet at compact width %ipx',
    (width) => {
      mockUseWindowDimensions.mockReturnValue({
        width,
        height: 844,
        scale: 1,
        fontScale: 1,
      })
      const { queryByLabelText, queryByTestId } = render(
        <ListCatalogToolbar
          sortOptions={[
            { id: 'newest', name: 'Новые' },
            { id: 'oldest', name: 'Старые' },
          ]}
          sortValue="newest"
          onSortChange={jest.fn()}
          density="comfortable"
          onDensityChange={jest.fn()}
        />,
      )

      expect(queryByLabelText('Сортировка списка')).toBeNull()
      expect(queryByTestId('sort-chip-newest')).toBeNull()
    },
  )

  it('shows inline sorting once the docked desktop sidebar is available', () => {
    mockUseWindowDimensions.mockReturnValue({
      width: 1920,
      height: 1080,
      scale: 1,
      fontScale: 1,
    })
    const { getByTestId } = render(
      <ListCatalogToolbar
        sortOptions={[
          { id: 'newest', name: 'Новые' },
          { id: 'oldest', name: 'Старые' },
        ]}
        sortValue="newest"
        onSortChange={jest.fn()}
        density="comfortable"
        onDensityChange={jest.fn()}
      />,
    )

    expect(getByTestId('sort-chip-newest')).toBeTruthy()
  })
})
