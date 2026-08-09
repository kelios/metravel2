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
        compactLayout
      />,
    )

    expect(getByTestId('toolbar-results-count')).toBeTruthy()
    expect(getByTestId('density-comfortable')).toBeTruthy()
    expect(queryByLabelText('Сортировка списка')).toBeNull()
    expect(queryByTestId('sort-chip-newest')).toBeNull()
  })

  it('shows inline sorting once the docked desktop sidebar is available', () => {
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
        compactLayout={false}
      />,
    )

    expect(getByTestId('sort-chip-newest')).toBeTruthy()
  })
})
