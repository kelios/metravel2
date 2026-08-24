import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform, StyleSheet } from 'react-native'

import { ThemeProvider } from '@/hooks/useTheme'
import { WEB_ROW_HEIGHT_DESKTOP } from '@/components/listTravel/rightColumnModel'

jest.mock('@shopify/flash-list', () => {
  const React = require('react')
  const { View } = require('react-native')

  return {
    FlashList: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({ scrollToOffset: jest.fn() }))
      return (
        <View testID={props.testID} onScroll={props.onScroll}>
          {props.ListHeaderComponent ?? null}
          {Array.isArray(props.data)
            ? props.data.map((item: any, index: number) => (
                <React.Fragment key={`flashlist-item-${index}`}>
                  {props.renderItem?.({ item, index })}
                </React.Fragment>
              ))
            : null}
          {props.ListFooterComponent ?? null}
        </View>
      )
    }),
  }
})

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}))

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
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

const getFlattenedRowStyle = (index = 0) => {
  const row = screen.getByTestId(`travel-row-${index}`)
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

  it('paints the first visible row eagerly and defers later web rows', () => {
    renderWithProviders(createRightColumn())

    expect(getFlattenedRowStyle()).toMatchObject({
      contentVisibility: 'visible',
      containIntrinsicSize: 'none',
    })
    expect(getFlattenedRowStyle(1)).toMatchObject({
      contentVisibility: 'auto',
      containIntrinsicSize: `auto ${WEB_ROW_HEIGHT_DESKTOP}px`,
    })
  })

  it('drops deferred paint hints when export mode is enabled', () => {
    const { rerenderWithProviders } = renderWithProviders(createRightColumn())

    expect(getFlattenedRowStyle().contentVisibility).toBe('visible')
    expect(getFlattenedRowStyle().containIntrinsicSize).toBe('none')

    rerenderWithProviders(createRightColumn({ isExport: true }))

    expect(getFlattenedRowStyle().contentVisibility).toBeUndefined()
    expect(getFlattenedRowStyle().containIntrinsicSize).toBeUndefined()
  })

  it('demotes recycled card media after the first web scroll', async () => {
    const renderItemSpy = jest.fn((travel: any, _index: number, hasUserScrolled?: boolean) => {
      const { Text } = require('react-native')
      return <Text testID={`travel-card-${String(travel.id)}`}>{String(hasUserScrolled)}</Text>
    })

    renderWithProviders(createRightColumn({ renderItem: renderItemSpy }))

    expect(renderItemSpy.mock.calls.some((call) => call[2] === false)).toBe(true)
    const callsBeforeScroll = renderItemSpy.mock.calls.length

    fireEvent.scroll(screen.getByTestId('right-column-scrollview'), {
      nativeEvent: {
        layoutMeasurement: { height: 844 },
        contentOffset: { y: 120 },
        contentSize: { height: 2400 },
      },
    })

    await waitFor(() => {
      const callsAfterScroll = renderItemSpy.mock.calls.slice(callsBeforeScroll)
      expect(callsAfterScroll.length).toBeGreaterThan(0)
      expect(callsAfterScroll.every((call) => call[2] === true)).toBe(true)
    })
  })

  it('updates compact toolbar status props through the memo boundary', () => {
    const onDensityChange = jest.fn()
    const onStatusModeChange = jest.fn()
    const refetch = jest.fn()
    const { rerenderWithProviders } = renderWithProviders(
      createRightColumn({
        isCompactToolbar: true,
        showDensityToggle: true,
        onDensityChange,
        showStatusModeToggle: true,
        onStatusModeChange,
        statusMode: 'all',
        refetch,
      }),
    )

    expect(screen.getByTestId('travel-status-all').props.accessibilityState.selected).toBe(true)

    rerenderWithProviders(
      createRightColumn({
        isCompactToolbar: true,
        showDensityToggle: true,
        onDensityChange,
        showStatusModeToggle: true,
        onStatusModeChange,
        statusMode: 'published',
        refetch,
      }),
    )

    expect(screen.getByTestId('travel-status-published').props.accessibilityState.selected).toBe(true)
  })
})
