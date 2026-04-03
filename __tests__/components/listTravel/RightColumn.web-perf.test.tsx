import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform, StyleSheet } from 'react-native'

import { ThemeProvider } from '@/hooks/useTheme'

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}))

jest.mock('@/components/mainPage/StickySearchBar', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return function MockStickySearchBar() {
    return React.createElement(Text, { testID: 'sticky-search-bar-mock' }, 'search')
  }
})

jest.mock('@/components/listTravel/RecommendationsTabs', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return function MockRecommendationsTabs() {
    return React.createElement(Text, { testID: 'recommendations-tabs-mock' }, 'recommendations')
  }
})

jest.mock('@/components/ui/SkeletonLoader', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return {
    TravelListSkeleton: () => React.createElement(Text, { testID: 'travel-list-skeleton-mock' }, 'skeleton'),
    TravelCardSkeleton: () => React.createElement(Text, { testID: 'travel-card-skeleton-mock' }, 'skeleton'),
  }
})

jest.mock('@/components/ui/EmptyState', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return function MockEmptyState(props: any) {
    return React.createElement(Text, { testID: 'empty-state-mock' }, props?.title ?? 'empty')
  }
})

let RightColumn: any

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>
  )

  return {
    ...rendered,
    rerenderWithProviders: (nextUi: React.ReactElement) =>
      rendered.rerender(
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>{nextUi}</ThemeProvider>
        </QueryClientProvider>
      ),
  }
}

const baseTravels: any[] = [
  { id: 1, name: 'A' },
  { id: 2, name: 'B' },
  { id: 3, name: 'C' },
]

const renderItem = (travel: any) => {
  const { Text } = require('react-native')
  return <Text testID={`travel-card-${String(travel.id)}`}>{travel.name}</Text>
}

const createRightColumn = (props: Record<string, unknown> = {}) => (
  <RightColumn
    search=""
    setSearch={jest.fn()}
    isRecommendationsVisible={false}
    handleRecommendationsVisibilityChange={jest.fn()}
    activeFiltersCount={0}
    total={baseTravels.length}
    contentPadding={16}
    showInitialLoading={false}
    isError={false}
    showEmptyState={false}
    getEmptyStateMessage={null}
    travels={baseTravels as any}
    gridColumns={2}
    isMobile={false}
    showNextPageLoading={false}
    refetch={jest.fn()}
    renderItem={renderItem as any}
    {...props}
  />
)

const getFlattenedRowStyle = () => {
  const row = screen.getByTestId('travel-row-0')
  return StyleSheet.flatten(row.props.style) as Record<string, unknown>
}

describe('RightColumn web row paint optimization', () => {
  beforeAll(() => {
    Platform.OS = 'web'
    Platform.select = (obj: Record<string, unknown>) => obj.web || obj.default
    RightColumn = require('@/components/listTravel/RightColumn').default
  })

  beforeEach(() => {
    Platform.OS = 'web'
  })

  it('adds content-visibility hints for regular web list rows', () => {
    renderWithProviders(createRightColumn())

    expect(getFlattenedRowStyle()).toMatchObject({
      contentVisibility: 'auto',
      containIntrinsicSize: 'auto 420px',
    })
  })

  it('drops deferred paint hints when export mode is enabled', () => {
    const { rerenderWithProviders } = renderWithProviders(createRightColumn())

    expect(getFlattenedRowStyle()).toMatchObject({
      contentVisibility: 'auto',
      containIntrinsicSize: 'auto 420px',
    })

    rerenderWithProviders(createRightColumn({ isExport: true }))

    expect(getFlattenedRowStyle().contentVisibility).toBeUndefined()
    expect(getFlattenedRowStyle().containIntrinsicSize).toBeUndefined()
  })
})
