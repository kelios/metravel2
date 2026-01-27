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
  Dimensions,
} from 'react-native'

import { useRouter } from 'expo-router'

import StickySearchBar from '@/components/mainPage/StickySearchBar'
import EmptyState from '@/components/EmptyState'
import type { Travel } from '@/src/types/types'

const RECOMMENDATIONS_TOTAL_HEIGHT = 376;
const STABLE_PLACEHOLDER_HEIGHT = 1200; // Reserve vertical space on web mobile to avoid CLS

// Lazy load RecommendationsTabs with proper error boundary
const RecommendationsTabs = lazy(async () => {
  try {
    return await import('./RecommendationsTabs')
  } catch {
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
  testID?: string
  listRef?: React.RefObject<FlatList<Travel[]>>
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
     listRef: externalListRef,
   }) => {
    const router = useRouter()
    const localListRef = useRef<FlatList<Travel[]> | null>(null)
    const listRef = externalListRef ?? localListRef
    const recommendationsOffsetRef = useRef(0)
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

    const webWidth = Platform.OS === 'web' ? Dimensions.get('window').width : 0
    const isWebMobile = Platform.OS === 'web' && (isMobile || webWidth <= 420)
    const showRecommendations = isRecommendationsVisible

    const cardsWrapperStyle = useMemo<StyleProp<ViewStyle>>(() => {
      const resetPadding = {
        paddingHorizontal: 0,
        paddingTop: Platform.OS === 'web' ? cardSpacing + 8 : 12,
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
    }, [cardsContainerStyle, isWebMobile, cardSpacing])

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
        return typeof child !== 'string'
      })
      return nodes.length ? nodes : null
    }, [topContent])

    const renderRow = useCallback((item: { item: Travel[]; index: number }) => { // Destructure properly for FlatList compatibility
        const { item: rowItems, index: rowIndex } = item;
        const cols = Math.max(1, (isMobile ? 1 : gridColumns) || 1);
        const missingSlots = Math.max(0, cols - rowItems.length);
        const calcWidth =
          cols > 1
            ? `calc((100% - ${(cols - 1) * cardSpacing}px) / ${cols})`
            : '100%';
        return (
          <View
            testID={`travel-row-${rowIndex}`}
            style={[
              cardsGridStyle,
              (Platform.OS === 'web'
                ? ({
                    flexWrap: 'wrap',
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    columnGap: cardSpacing,
                    rowGap: cardSpacing,
                    alignItems: 'flex-start',
                  } as any)
                : ({
                    flexWrap: 'nowrap',
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                  } as any)),
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
                            // Equal column widths on web (prevents last-row stretching and uneven widths)
                            flexGrow: 0,
                            flexShrink: 0,
                            flexBasis: calcWidth,
                            width: calcWidth,
                            maxWidth: calcWidth,
                            minWidth: 0,
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
                     
                    key={`placeholder-${rowIndex}-${placeholderIndex}`}
                    testID={`travel-row-${rowIndex}-placeholder-${placeholderIndex}`}
                    style={[
                      ({
                        flexGrow: 0,
                        flexShrink: 0,
                        flexBasis: calcWidth,
                        width: calcWidth,
                        maxWidth: calcWidth,
                        minWidth: 0,
                        opacity: 0,
                        pointerEvents: 'none',
                        paddingHorizontal: cardSpacing / 2,
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
      const desktopHeight =
        Platform.OS === 'web' && !isMobile ? RECOMMENDATIONS_TOTAL_HEIGHT : undefined

      return (
        <View
          onLayout={showRecommendations ? handleRecommendationsLayout : undefined}
          style={
            showRecommendations
              ? {
                  marginBottom: 24,
                  ...(desktopHeight ? { height: desktopHeight, overflow: 'hidden' } : {}),
                }
              : { height: 0, overflow: 'hidden' }
          }
        >
          {showRecommendations && (
            <Suspense fallback={<RecommendationsPlaceholder />}>
              <RecommendationsTabs />
            </Suspense>
          )}
        </View>
      )
    }, [showRecommendations, handleRecommendationsLayout, isMobile]);

    const [showDelayedSkeleton, setShowDelayedSkeleton] = useState(false)

    const skeletonDelayMs = Platform.OS === 'web' ? 200 : 250

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

    // Always render the search bar, even on mobile

    return (
      <View style={containerStyle}>
        {/* Search Header - Sticky */}
        <View
          style={[
            searchHeaderStyle,
            Platform.OS === 'web'
              ? ({ minHeight: isMobile ? 56 : 76 } as any)
              : ({ minHeight: 52 } as any),
          ]}
        >
          <StickySearchBar
            search={search}
            onSearchChange={setSearch}
            availableWidth={availableWidth}
            flush={Platform.OS === 'web'}
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
          {shouldShowSkeleton && isRecommendationsVisible && (
            <View
              style={{
                height: RECOMMENDATIONS_TOTAL_HEIGHT,
                marginBottom: 24,
                overflow: 'hidden',
                paddingHorizontal: contentPadding,
              }}
            >
              <RecommendationsPlaceholder />
            </View>
          )}

          {/* Initial Loading - Only show skeleton when actually loading initial data */}
          {shouldShowSkeleton && isWebMobile && (
            <View
              style={{
                height: STABLE_PLACEHOLDER_HEIGHT,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: contentPadding,
              }}
            >
              <ActivityIndicator size="small" />
            </View>
          )}

          {/* Error */}
          {isError && !showInitialLoading && (
            <View style={{ paddingHorizontal: contentPadding }}>
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
            </View>
          )}

          {/* Empty State */}
          {!showInitialLoading &&
            !isError &&
            showEmptyState &&
            getEmptyStateMessage && (
              <View style={{ paddingHorizontal: contentPadding }}>
                <EmptyState
                  icon={getEmptyStateMessage.icon}
                  title={getEmptyStateMessage.title}
                  description={getEmptyStateMessage.description}
                  variant={getEmptyStateMessage.variant}
                />
              </View>
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
              removeClippedSubviews={true}
              windowSize={5}
              initialNumToRender={6}
              maxToRenderPerBatch={3}
              updateCellsBatchingPeriod={100}
              contentContainerStyle={{
                paddingHorizontal: contentPadding,
                paddingTop: 8,
                paddingBottom: Platform.OS === 'web' && isMobile ? 32 + 8 : 28,
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
