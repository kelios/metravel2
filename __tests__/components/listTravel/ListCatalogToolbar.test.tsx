import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

jest.mock('@expo/vector-icons/Feather', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return ({ name }: { name: string }) => React.createElement(Text, null, name)
})

jest.mock('@/ui/paper', () => {
  const React = require('react')
  const { View } = require('react-native')
  const DialogMenu = ({ children, anchor, visible }: any) =>
    React.createElement(View, null, anchor, visible ? children : null)
  return { DialogMenu }
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
    text: '#0f172a',
    border: '#cbd5e1',
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

  it('keeps compact mobile web toolbar lean by dropping inline sort chips', async () => {
    const { getByTestId, queryByLabelText, queryByTestId } = await render(
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
    expect(queryByTestId('catalog-sort-trigger')).toBeNull()
  })

  it('shows a single sort menu on desktop and applies the picked option (#2755)', async () => {
    const onSortChange = jest.fn()
    const { getByTestId, queryByTestId } = await render(
      <ListCatalogToolbar
        sortOptions={[
          { id: 'newest', name: 'Новые' },
          { id: 'oldest', name: 'Старые' },
        ]}
        sortValue="newest"
        onSortChange={onSortChange}
        density="comfortable"
        onDensityChange={jest.fn()}
        compactLayout={false}
        inline
      />,
    )

    expect(getByTestId('catalog-sort-trigger')).toHaveTextContent(/Новые/)
    expect(queryByTestId('sort-option-oldest')).toBeNull()

    await fireEvent.press(getByTestId('catalog-sort-trigger'))
    await fireEvent.press(getByTestId('sort-option-oldest'))

    expect(onSortChange).toHaveBeenCalledWith('oldest')
    expect(queryByTestId('sort-option-oldest')).toBeNull()
  })
})
