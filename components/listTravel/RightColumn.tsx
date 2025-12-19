import React, { memo, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
const STABLE_PLACEHOLDER_HEIGHT = 1200; // Reserve vertical space on web mobile to avoid CLS

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

    const isWebMobile = Platform.OS === 'web' && isMobile
    const showRecommendations = Platform.OS === 'web' && !isMobile && isRecommendationsVisible

    const cardsWrapperStyle = useMemo<StyleProp<ViewStyle>>(() => {
      const resetPadding = {
        paddingHorizontal: 0,
        paddingTop: Platform.OS === 'web' && isMobile ? 4 : 12,
        ...(isWebMobile
          ? ({
              minHeight: STABLE_PLACEHOLDER_HEIGHT,
            } as any)
          : null),
      }

      if (Array.isArray(cardsContainerStyle)) {
        return [...cardsContainerStyle, resetPadding]
      }

      if (cardsContainerStyle) {
        return [cardsContainerStyle, resetPadding]
      }

      return resetPadding
    }, [cardsContainerStyle, isWebMobile])

    const rows = useMemo(() => {
      const cols = Math.max(1, (isMobile ? 1 : gridColumns) || 1)
      const result: Travel[][] = []
      for (let i = 0; i < travels.length; i += cols) {
        result.push(travels.slice(i, i + cols))
      }
      return result
    }, [travels, gridColumns, isMobile])

    const RowSeparator = useCallback(() => {
      return <View style={{ height: cardSpacing }} />
    }, [cardSpacing])

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
        const missingSlots = Math.max(0, cols - rowItems.length);
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
                            // Keep cards within min/max width and don't stretch a single card to full row width.
                            flexGrow: 0,
                            flexShrink: 0,
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
                    ? null
                    : {
                        paddingHorizontal: cardSpacing / 2,
                        paddingBottom: cardSpacing,
                      },
                ]}
              >
                {renderItem(travel, rowIndex * cols + itemIndex)}
              </View>
            ))}

            {Platform.OS === 'web' && !isMobile && missingSlots > 0
              ? Array.from({ length: missingSlots }).map((_, placeholderIndex) => (
                  <View
                    // eslint-disable-next-line react/no-array-index-key
                    key={`placeholder-${rowIndex}-${placeholderIndex}`}
                    testID={`travel-row-${rowIndex}-placeholder-${placeholderIndex}`}
                    pointerEvents="none"
                    style={[
                      ({
                        flexGrow: 0,
                        flexShrink: 0,
                        flexBasis: 320,
                        minWidth: 320,
                        maxWidth: 360,
                        opacity: 0,
                      } as any) as ViewStyle,
                      Platform.OS === 'web'
                        ? null
                        : {
                            paddingHorizontal: cardSpacing / 2,
                            paddingBottom: cardSpacing,
                          },
                    ]}
                  />
                ))
              : null}

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
          onLayout={showRecommendations ? handleRecommendationsLayout : undefined}
          style={{
            height: showRecommendations ? RECOMMENDATIONS_TOTAL_HEIGHT : 0,
            marginBottom: showRecommendations ? 24 : 0,
            overflow: 'hidden',
          }}
        >
          {showRecommendations && (
            <Suspense fallback={<RecommendationsPlaceholder />}>
              <RecommendationsTabs />
            </Suspense>
          )}
        </View>
      );
    }, [showRecommendations, handleRecommendationsLayout]);

    const [showDelayedSkeleton, setShowDelayedSkeleton] = useState(false)

    const skeletonDelayMs = Platform.OS === 'web' ? 200 : 250

    const skeletonCount = useMemo(() => {
      if (Platform.OS !== 'web') return PER_PAGE
      return isMobile ? 6 : 12
    }, [isMobile])

    const shouldShowSkeleton =
      showDelayedSkeleton && showInitialLoading && travels.length === 0

    useEffect(() => {
      if (!showInitialLoading || travels.length !== 0) {
        setShowDelayedSkeleton(false)
        return
      }

      const t = setTimeout(() => setShowDelayedSkeleton(true), skeletonDelayMs)
      return () => {
        clearTimeout(t)
        setShowDelayedSkeleton(false)
      }
    }, [showInitialLoading, travels.length, skeletonDelayMs])

    return (
      <View style={containerStyle}>
        {/* Search Header - Sticky */}
        <View
          style={[
            searchHeaderStyle,
            Platform.OS === 'web'
              ? ({ minHeight: isMobile ? 76 : 76 } as any)
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
              handleRecommendationsVisibilityChange(!showRecommendations)
            }
            isRecommendationsVisible={showRecommendations}
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
          {shouldShowSkeleton && isRecommendationsVisible ? (
            <View
              style={{
                height: RECOMMENDATIONS_TOTAL_HEIGHT,
                marginBottom: 24,
                overflow: 'hidden',
              }}
            >
              <RecommendationsPlaceholder />
            </View>
          ) : null}

          {/* Initial Loading - Only show skeleton when actually loading initial data */}
          {shouldShowSkeleton && (
            isWebMobile ? (
              <View
                style={{
                  height: STABLE_PLACEHOLDER_HEIGHT,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <ActivityIndicator size="small" />
              </View>
            ) : (
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
                <TravelListSkeleton
                  count={skeletonCount}
                  columns={gridColumns}
                  rowStyle={cardsGridStyle}
                  variant={Platform.OS === 'web' ? 'detailed' : isMobile ? 'reserve' : 'detailed'}
                />
              </View>
            )
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
              isWebMobile ? (
                // Web mobile: render a plain spacer to avoid any layout shifts from icons/text rendering
                <View
                  style={{
                    height: STABLE_PLACEHOLDER_HEIGHT,
                  }}
                />
              ) : (
                <EmptyState
                  icon={getEmptyStateMessage.icon}
                  title={getEmptyStateMessage.title}
                  description={getEmptyStateMessage.description}
                  variant={getEmptyStateMessage.variant}
                />
              )
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
              ItemSeparatorComponent={Platform.OS === 'web' ? RowSeparator : undefined}
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
              scrollEventThrottle={Platform.OS === 'web' ? 32 : 16}
            />
          )}
        </View>
      </View>
    )
  },
)

export default RightColumn
