import React from 'react'
import { render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

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

  it('uses two-row compact layout on mobile web so sort chips do not crowd density controls', () => {
    const { getByTestId, getByLabelText } = render(
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

    const sortScrollStyle = StyleSheet.flatten(getByLabelText('Сортировка списка').props.style)

    expect(getByTestId('toolbar-results-count')).toBeTruthy()
    expect(getByTestId('density-comfortable')).toBeTruthy()
    expect(sortScrollStyle.width).toBe('100%')
    expect(sortScrollStyle.minWidth).toBe('100%')
  })
})
