import React from 'react'
import { render } from '@testing-library/react-native'
import ListCatalogToolbar from '@/components/listTravel/ListCatalogToolbar'

let mockViewportWidth = 390

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native')
  return {
    ...RN,
    Platform: {
      ...RN.Platform,
      OS: 'web',
      select: (obj: any) => obj.web ?? obj.default,
    },
    useWindowDimensions: () => ({ width: mockViewportWidth, height: 844, scale: 1, fontScale: 1 }),
  }
})

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

describe('ListCatalogToolbar', () => {
  beforeEach(() => {
    mockViewportWidth = 390
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
})
