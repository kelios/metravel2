import React, { memo, Suspense, lazy, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ActivityIndicator,
  Platform,
  View,
  ViewStyle,
  Text,
  LayoutChangeEvent,
  StyleProp,
  FlatList,
} from 'react-native'

import { useRouter } from 'expo-router'

import StickySearchBar from '@/components/mainPage/StickySearchBar'
import { TravelListSkeleton } from '@/components/SkeletonLoader'
import EmptyState from '@/components/EmptyState'
import type { Travel } from '@/src/types/types'
import { PER_PAGE } from './utils/listTravelConstants'

const RECOMMENDATIONS_TOTAL_HEIGHT = 376;

// Lazy load RecommendationsTabs with proper error boundary
const RecommendationsTabs = lazy(async () => {
  try {
    return await import('./RecommendationsTabs')
  } catch (error) {
    return {
      default: memo(() => (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <Text>Не удалось загрузить рекомендации</Text>
        </View>
      )),
    }
  }
})

// Simple placeholder for loading state (must match the reserved header height)
const RecommendationsPlaceholder = () => (
  <View
    style={{
      height: RECOMMENDATIONS_TOTAL_HEIGHT,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <ActivityIndicator size="small" />
  </View>
)

interface RightColumnProps {
  search: string
  setSearch: (value: string) => void
  onClearAll?: () => void
  availableWidth?: number
  topContent?: React.ReactNode
  isRecommendationsVisible: boolean
  handleRecommendationsVisibilityChange: (visible: boolean) => void
  activeFiltersCount: number
  total: number
  contentPadding: number
  showInitialLoading: boolean
  isError: boolean
  showEmptyState: boolean
  getEmptyStateMessage: any
  travels: Travel[]
  gridColumns: number
  isMobile: boolean
  showNextPageLoading: boolean
  refetch: () => void
  onEndReached?: () => void
  onEndReachedThreshold?: number
  onFiltersPress?: () => void
  containerStyle?: ViewStyle | ViewStyle[]
  searchHeaderStyle?: ViewStyle | ViewStyle[]
  cardsContainerStyle?: ViewStyle | ViewStyle[]
  cardsGridStyle?: ViewStyle | ViewStyle[]
  footerLoaderStyle?: ViewStyle | ViewStyle[]
  renderItem: (travel: Travel, index: number) => React.ReactNode
  cardSpacing?: number
}

const RightColumn: React.FC<RightColumnProps> = memo(
  ({
     search,
     setSearch,
     onClearAll,
     availableWidth,
     topContent,
     isRecommendationsVisible,
     handleRecommendationsVisibilityChange,
     activeFiltersCount,
     total,
     contentPadding,
     showInitialLoading,
     isError,
     showEmptyState,
     getEmptyStateMessage,
     travels,
     gridColumns,
     isMobile,
     showNextPageLoading,
     refetch,
     onEndReached,
     onEndReachedThreshold = 0.5,
     onFiltersPress,
     containerStyle,
     searchHeaderStyle,
     cardsContainerStyle,
     cardsGridStyle,
     footerLoaderStyle,
     renderItem,
     cardSpacing = 16,
   }) => {
    const router = useRouter()
    const listRef = useRef<FlatList<Travel[]> | null>(null)
    const recommendationsOffsetRef = useRef(0)
    const shouldScrollRef = useRef(false)
    const prevVisibilityRef = useRef(isRecommendationsVisible)

    // ✅ CLS FIX P1: Remove auto-scroll to recommendations to prevent perceived layout shift
    // Auto-scrolling can look like a "jump" and confuse users about layout stability
    // const scrollToRecommendations = useCallback(() => {
    //   const target = Math.max(recommendationsOffsetRef.current - 16, 0)
    //   listRef.current?.scrollToOffset({ offset: target, animated: true })
    //   shouldScrollRef.current = false
    // }, [])

    const handleRecommendationsLayout = useCallback((event: LayoutChangeEvent) => {
      recommendationsOffsetRef.current = event.nativeEvent.layout.y
      // ✅ CLS FIX P1: Remove auto-scroll logic to prevent layout shift perception
      // if (shouldScrollRef.current) {
      //   shouldScrollRef.current = false
      //   scrollToRecommendations()
      // }
    }, []) // Removed scrollToRecommendations dependency

    useEffect(() => {
      // ✅ CLS FIX P1: Completely remove auto-scroll behavior when recommendations become visible
      // This prevents any perceived "jumping" that could be mistaken for layout shift
      // if (isRecommendationsVisible && !prevVisibilityRef.current) {
      //   if (recommendationsOffsetRef.current > 0) {
      //     scrollToRecommendations()
      //   } else {
      //     shouldScrollRef.current = true
      //   }
      // } else {
      //   shouldScrollRef.current = false
      // }

      prevVisibilityRef.current = isRecommendationsVisible
    }, [isRecommendationsVisible]) // Removed scrollToRecommendations dependency

    const cardsWrapperStyle = useMemo<StyleProp<ViewStyle>>(() => {
      const resetPadding = { paddingHorizontal: 0, paddingTop: 12 }

      if (Array.isArray(cardsContainerStyle)) {
        return [...cardsContainerStyle, resetPadding]
      }

      if (cardsContainerStyle) {
        return [cardsContainerStyle, resetPadding]
      }

      return resetPadding
    }, [cardsContainerStyle])

    const rows = useMemo(() => {
      const cols = Math.max(1, (isMobile ? 1 : gridColumns) || 1)
      const result: Travel[][] = []
      for (let i = 0; i < travels.length; i += cols) {
        result.push(travels.slice(i, i + cols))
      }
      return result
    }, [travels, gridColumns, isMobile])

    const topContentNodes = useMemo(() => {
      if (!topContent) return null
      const nodes = React.Children.toArray(topContent).filter((child) => {
        return !(typeof child === 'string' && child.trim().length === 0)
      })
      return nodes.length ? nodes : null
    }, [topContent])

    const renderRow = useCallback((item: { item: Travel[]; index: number }) => { // Destructure properly for FlatList compatibility
        const { item: rowItems, index: rowIndex } = item;
        const cols = Math.max(1, (isMobile ? 1 : gridColumns) || 1);
        return (
          <View
            testID={`travel-row-${rowIndex}`}
            style={[
              cardsGridStyle,
              ({ flexWrap: 'nowrap' } as any),
            ]}
          >
            {rowItems.map((travel, itemIndex) => (
              <View
                key={String(travel.id)}
                testID={`travel-row-${rowIndex}-item-${itemIndex}`}
                style={[
                  (Platform.OS === 'web'
                    ? (isMobile
                        ? ({
                            flex: 1,
                            width: '100%',
                            maxWidth: '100%',
                            minWidth: 0,
                            flexBasis: '100%',
                          } as any)
                        : ({
                            flexGrow: 1,
                            flexShrink: 1,
                            flexBasis: 320,
                            minWidth: 320,
                            maxWidth: 360,
                          } as any))
                    : ({
                        flex: 1,
                        width: '100%',
                        maxWidth: '100%',
                      } as any)) as ViewStyle,
                  Platform.OS === 'web'
                    ? {
                        paddingBottom: cardSpacing,
                        paddingRight: cardSpacing / 2,
                        paddingLeft: cardSpacing / 2,
                      }
                    : {
                        paddingHorizontal: cardSpacing / 2,
                        paddingBottom: cardSpacing,
                      },
                ]}
              >
                {renderItem(travel, rowIndex * cols + itemIndex)}
              </View>
            ))}

            {showNextPageLoading && rowIndex === rows.length - 1 && (
              <View style={footerLoaderStyle}>
                <ActivityIndicator size="small" />
              </View>
            )}
          </View>
        )
      },
      [
        cardsGridStyle,
        cardSpacing,
        renderItem,
        gridColumns,
        isMobile,
        showNextPageLoading,
        rows.length,
        footerLoaderStyle,
      ]
    )

    const ListHeader = useMemo(() => {
      return (
        <View
          onLayout={isRecommendationsVisible ? handleRecommendationsLayout : undefined}
          style={{
            height: isRecommendationsVisible ? RECOMMENDATIONS_TOTAL_HEIGHT : 0,
            marginBottom: isRecommendationsVisible ? 24 : 0,
            overflow: 'hidden',
          }}
        >
          {isRecommendationsVisible && (
            <Suspense fallback={<RecommendationsPlaceholder />}>
              <RecommendationsTabs />
            </Suspense>
          )}
        </View>
      );
    }, [isRecommendationsVisible, handleRecommendationsLayout]);

    return (
      <View style={containerStyle}>
        {/* Search Header - Sticky */}
        <View
          style={[
            searchHeaderStyle,
            Platform.OS === 'web'
              ? ({ minHeight: isMobile ? 120 : 76 } as any)
              : ({ minHeight: 60 } as any),
          ]}
        >
          <StickySearchBar
            search={search}
            onSearchChange={setSearch}
            availableWidth={availableWidth}
            primaryAction={{
              label: 'Создать',
              onPress: () => router.push('/travel/new' as any),
              accessibilityLabel: 'Создать путешествие',
            }}
            onFiltersPress={onFiltersPress}
            onToggleRecommendations={() =>
              handleRecommendationsVisibilityChange(!isRecommendationsVisible)
            }
            isRecommendationsVisible={isRecommendationsVisible}
            hasActiveFilters={activeFiltersCount > 0}
            resultsCount={total}
            activeFiltersCount={activeFiltersCount}
            onClearAll={onClearAll ?? (() => setSearch(''))}
          />
        </View>

        {topContentNodes ? (
          <View style={{ paddingHorizontal: contentPadding }}>{topContentNodes}</View>
        ) : null}

        {/* Cards + Recommendations */}
        <View testID="cards-scroll-container" style={cardsWrapperStyle}>
          {/* Initial Loading - Only show skeleton when actually loading initial data */}
          {showInitialLoading && travels.length === 0 && (
            <View
              style={[
                cardsGridStyle,
                {
                  paddingHorizontal: contentPadding,
                  paddingTop: 8,
                  paddingBottom: 28,
                } as any,
              ]}
            >
              <TravelListSkeleton count={PER_PAGE} columns={gridColumns} />
            </View>
          )}

          {/* Error */}
          {isError && !showInitialLoading && (
            <EmptyState
              icon="alert-circle"
              title="Ошибка загрузки"
              description="Не удалось загрузить путешествия."
              variant="error"
              action={{
                label: 'Повторить',
                onPress: () => refetch(),
              }}
            />
          )}

          {/* Empty State */}
          {!showInitialLoading &&
            !isError &&
            showEmptyState &&
            getEmptyStateMessage && (
              <EmptyState
                icon={getEmptyStateMessage.icon}
                title={getEmptyStateMessage.title}
                description={getEmptyStateMessage.description}
                variant={getEmptyStateMessage.variant}
              />
            )}

          {/* Travel Cards Grid - Only show when we have data */}
          {!showInitialLoading && !isError && !showEmptyState && travels.length > 0 && (
            <FlatList
              ref={listRef as any}
              data={rows}
              renderItem={renderRow as any}
              extraData={gridColumns}
              keyExtractor={(_, index) => `row-${(isMobile ? 1 : gridColumns) || 1}-${index}`}
              ListHeaderComponent={ListHeader}
              onEndReached={onEndReached}
              onEndReachedThreshold={onEndReachedThreshold}
              removeClippedSubviews={false}
              windowSize={Platform.OS === 'web' ? 5 : 10}
              initialNumToRender={Platform.OS === 'web' ? 8 : 8} // Increased for better LCP
              maxToRenderPerBatch={Platform.OS === 'web' ? 8 : 8} // Increased for smoother scrolling
              updateCellsBatchingPeriod={Platform.OS === 'web' ? 50 : 16}
              contentContainerStyle={{
                paddingHorizontal: contentPadding,
                paddingTop: 8,
                paddingBottom: 28,
              }}
              scrollEventThrottle={16}
            />
          )}
        </View>
      </View>
    )
  },
)

export default RightColumn
