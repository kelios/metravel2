import React, { memo, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  View,
  ViewStyle,
  Text,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleProp,
  Dimensions,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'

import StickySearchBar from '@/components/mainPage/StickySearchBar'
import EmptyState from '@/components/ui/EmptyState'
import { TravelCardSkeleton } from '@/components/ui/SkeletonLoader'
import { useThemedColors } from '@/hooks/useTheme'
import type { Travel } from '@/types/types'
import {
  areRightColumnPropsEqual,
  buildTravelRows,
  getRightColumnColumns,
  getRightColumnHeaderMinHeight,
  getRightColumnWebRowBaseStyle,
  RECOMMENDATIONS_TOTAL_HEIGHT,
  STABLE_PLACEHOLDER_HEIGHT,
  TOP_SCROLL_PADDING,
} from '@/components/listTravel/rightColumnModel'

const isWeb = Platform.OS === 'web';

// Lazy load RecommendationsTabs with proper error boundary
const RecommendationsTabs = lazy(async () => {
  try {
    return await import('./RecommendationsTabs')
  } catch {
    return {
      default: memo((_props: { forceVisible?: boolean; onVisibilityChange?: (visible: boolean) => void }) => (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <Text>Не удалось загрузить рекомендации</Text>
        </View>
      )),
    } as unknown as typeof import('./RecommendationsTabs')
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
  topContent?: React.ReactNode
  isRecommendationsVisible: boolean
  handleRecommendationsVisibilityChange: (visible: boolean) => void
  activeFiltersCount: number
  total: number
  contentPadding: number
  showInitialLoading: boolean
  isSearchPending?: boolean
  isError: boolean
  showEmptyState: boolean
  getEmptyStateMessage: {
    icon: string
    title: string
    description: string
    variant: 'search' | 'error' | 'default' | 'empty' | 'inspire'
    suggestions?: string[]
  } | null
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
  listRef?: React.RefObject<any>
  isExport?: boolean
}

const RightColumn: React.FC<RightColumnProps> = (
  ({
     search,
     setSearch,
     onClearAll,
     topContent,
     isRecommendationsVisible,
     handleRecommendationsVisibilityChange,
     activeFiltersCount,
     total,
     contentPadding,
     showInitialLoading,
     isSearchPending = false,
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
     testID,
     listRef: externalListRef,
     isExport = false,
   }) => {
    const colors = useThemedColors()
    const localListRef = useRef<any>(null)
    const listRef = externalListRef ?? localListRef
    const recommendationsOffsetRef = useRef<number | null>(null)
    const pendingRecommendationsScrollRef = useRef(false)

    const scheduleAfterLayout = useCallback((callback: () => void) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => callback())
        return
      }
      setTimeout(callback, 0)
    }, [])

    const scrollToRecommendations = useCallback(() => {
      const offset = recommendationsOffsetRef.current
      if (offset == null) return false

      const targetOffset = Math.max(offset - TOP_SCROLL_PADDING, 0)
      const scrollNode = listRef.current

      if (typeof scrollNode?.scrollTo === 'function') {
        scrollNode.scrollTo({ y: targetOffset, animated: true })
        return true
      }

      if (typeof scrollNode?.scrollToOffset === 'function') {
        scrollNode.scrollToOffset({ offset: targetOffset, animated: true })
        return true
      }

      if (typeof scrollNode?.getNativeScrollRef === 'function') {
        const nativeScrollRef = scrollNode.getNativeScrollRef()
        if (typeof nativeScrollRef?.scrollTo === 'function') {
          nativeScrollRef.scrollTo({ y: targetOffset, animated: true })
          return true
        }
      }

      return false
    }, [listRef])

    const handleRecommendationsLayout = useCallback((event: LayoutChangeEvent) => {
      recommendationsOffsetRef.current = event.nativeEvent.layout.y

      if (!pendingRecommendationsScrollRef.current) return

      scheduleAfterLayout(() => {
        if (scrollToRecommendations()) {
          pendingRecommendationsScrollRef.current = false
        }
      })
    }, [scheduleAfterLayout, scrollToRecommendations])

    const webWidth = useMemo(
      () => (Platform.OS === 'web' ? Dimensions.get('window').width : 0),
      // Dimensions stay stable between re-renders; update on layout change via isMobile prop
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [isMobile],
    )
    const isWebMobile = Platform.OS === 'web' && (isMobile || webWidth <= 420)
    const showRecommendations = isRecommendationsVisible

    useEffect(() => {
      if (!showRecommendations || !pendingRecommendationsScrollRef.current) return

      scheduleAfterLayout(() => {
        if (scrollToRecommendations()) {
          pendingRecommendationsScrollRef.current = false
        }
      })
    }, [scheduleAfterLayout, scrollToRecommendations, showRecommendations])

    const cardsWrapperStyle = useMemo<StyleProp<ViewStyle>>(() => {
      const resetPadding = {
        flex: 1,
        minHeight: 0,
        paddingHorizontal: 0,
        paddingTop: Platform.OS === 'web' ? cardSpacing + 8 : 12,
        ...(Platform.OS === 'web'
          ? ({
              // Important: make ScrollView the only scroll container on web, otherwise onScroll won't fire
              // and infinite scroll won't fetch next pages.
              overflow: 'hidden',
              overflowY: 'hidden',
              overflowX: 'hidden',
              scrollbarGutter: 'stable',
            } as any)
          : null),
        ...(isWebMobile
          ? ({
              minHeight: 0,
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

    const rows = useMemo(() => buildTravelRows(travels, gridColumns, isMobile), [travels, gridColumns, isMobile])

    const rowSeparatorStyle = useMemo(() => ({ height: Platform.OS === 'web' ? cardSpacing + 4 : cardSpacing }), [cardSpacing])
    const RowSeparator = useCallback(() => {
      return <View style={rowSeparatorStyle} />
    }, [rowSeparatorStyle])

    const webContentContainerStyle = useMemo(() => ({
      paddingHorizontal: 0,
      paddingTop: 8,
      paddingBottom: isMobile ? 32 + 8 : 28,
      ...(isWebMobile ? { minHeight: STABLE_PLACEHOLDER_HEIGHT } : null),
    }), [isMobile, isWebMobile])

    const nativeContentContainerStyle = useMemo(() => ({
      paddingHorizontal: contentPadding,
      paddingTop: 8,
      paddingBottom: 28,
    }), [contentPadding])

    const paddingHorizontalStyle = useMemo(() => ({ paddingHorizontal: contentPadding }), [contentPadding])
    const skeletonPaddingStyle = useMemo(
      () => ({ paddingHorizontal: isWeb ? 0 : contentPadding, paddingTop: 8 }),
      [contentPadding]
    )
    const recommendationsSkeletonStyle = useMemo(
      () => ({
        height: RECOMMENDATIONS_TOTAL_HEIGHT,
        marginBottom: 24,
        overflow: 'hidden' as const,
        paddingHorizontal: isWeb ? 0 : contentPadding,
      }),
      [contentPadding]
    )

    // Web: infinite scroll via onScroll instead of FlashList's onEndReached
    const webScrollHandler = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!onEndReached) return
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
      const distanceFromEnd = contentSize.height - layoutMeasurement.height - contentOffset.y
      const threshold = (onEndReachedThreshold ?? 0.5) * layoutMeasurement.height
      if (distanceFromEnd < threshold) {
        onEndReached()
      }
    }, [onEndReached, onEndReachedThreshold])

    const topContentNodes = useMemo(() => {
      if (!topContent) return null
      const nodes = React.Children.toArray(topContent).filter((child) => {
        return typeof child !== 'string'
      })
      return nodes.length ? nodes : null
    }, [topContent])

    const renderRow = useCallback((item: { item: Travel[]; index: number }) => {
        const { item: rowItems, index: rowIndex } = item;
        const cols = getRightColumnColumns(gridColumns, isMobile);
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
                ? (getRightColumnWebRowBaseStyle({
                    cardSpacing,
                    isExport,
                    isMobile,
                  }) as any)
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
                            alignSelf: 'stretch',
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

            {!isWeb && showNextPageLoading && rowIndex === rows.length - 1 && (
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
        isExport,
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
          testID="recommendations-list-header"
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

    const handleRecommendationsToggle = useCallback(() => {
      const nextVisible = !showRecommendations
      pendingRecommendationsScrollRef.current = nextVisible
      handleRecommendationsVisibilityChange(nextVisible)
    }, [handleRecommendationsVisibilityChange, showRecommendations])

    const skeletonDelayMs = Platform.OS === 'web' ? 200 : 250

    const shouldShowSkeleton =
      showInitialLoading && travels.length === 0 && showDelayedSkeleton

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

    const loadedResultsContent = useMemo(() => {
      if (showInitialLoading || isError || showEmptyState || travels.length === 0) {
        return null
      }

      if (isWeb) {
        return (
          <ScrollView
            ref={listRef as any}
            onScroll={webScrollHandler}
            scrollEventThrottle={32}
            style={{
              flex: 1,
              minHeight: 0,
              WebkitOverflowScrolling: 'touch',
              touchAction: isExport ? 'auto' : 'pan-y',
              overscrollBehaviorY: 'contain',
            } as any}
            contentContainerStyle={webContentContainerStyle}
            testID="right-column-scrollview"
          >
            {ListHeader}
            {rows.map((rowItems, rowIndex) => (
              <React.Fragment key={`row-${rowIndex}`}>
                {rowIndex > 0 && <RowSeparator />}
                {renderRow({ item: rowItems, index: rowIndex })}
              </React.Fragment>
            ))}
            {/* PERF-03: Информативный индикатор при подгрузке страниц */}
            {showNextPageLoading && (
              <View style={[footerLoaderStyle, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                <ActivityIndicator size="small" accessibilityLabel="Загружаем ещё маршруты" />
                <Text style={{ fontSize: 13, color: colors.textMuted }}>Загружаем ещё...</Text>
              </View>
            )}
          </ScrollView>
        )
      }

      return (
        <FlashList
          ref={listRef as any}
          data={rows}
          renderItem={renderRow as any}
          extraData={gridColumns}
          keyExtractor={(_, index) => `row-${(isMobile ? 1 : gridColumns) || 1}-${index}`}
          {...({ estimatedItemSize: 320 } as any)}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={showNextPageLoading ? (
            <View style={footerLoaderStyle}>
              <ActivityIndicator size="small" accessibilityLabel="Загружаем ещё маршруты" />
            </View>
          ) : null}
          onEndReached={onEndReached}
          onEndReachedThreshold={onEndReachedThreshold}
          drawDistance={800}
          contentContainerStyle={nativeContentContainerStyle}
          testID="right-column-flashlist"
          scrollEventThrottle={16}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={8}
          windowSize={5}
        />
      )
    }, [
      ListHeader,
      RowSeparator,
      colors.textMuted,
      footerLoaderStyle,
      gridColumns,
      isError,
      isExport,
      isMobile,
      listRef,
      nativeContentContainerStyle,
      onEndReached,
      onEndReachedThreshold,
      renderRow,
      rows,
      showEmptyState,
      showInitialLoading,
      showNextPageLoading,
      travels.length,
      webContentContainerStyle,
      webScrollHandler,
    ])

    return (
      <View testID={testID} style={containerStyle}>
        {/* Search Header - Sticky */}
        <View
          style={[
            searchHeaderStyle,
            ({ minHeight: getRightColumnHeaderMinHeight(isMobile) } as any),
          ]}
        >
          <StickySearchBar
            search={search}
            onSearchChange={setSearch}
            flush={Platform.OS === 'web'}
            onFiltersPress={onFiltersPress}
            onToggleRecommendations={handleRecommendationsToggle}
            isRecommendationsVisible={showRecommendations}
            hasActiveFilters={activeFiltersCount > 0}
            isSearchPending={isSearchPending}
            resultsCount={total}
            activeFiltersCount={activeFiltersCount}
            onClearAll={onClearAll ?? (() => setSearch(''))}
          />
        </View>

        {topContentNodes ? (
          <View style={paddingHorizontalStyle}>{topContentNodes}</View>
        ) : null}

        {/* Cards + Recommendations */}
        <View testID="cards-scroll-container" style={cardsWrapperStyle}>
          {shouldShowSkeleton && isRecommendationsVisible && (
            <View
              style={recommendationsSkeletonStyle}
            >
              <RecommendationsPlaceholder />
            </View>
          )}

          {/* Initial Loading - Only show skeleton when actually loading initial data */}
          {shouldShowSkeleton && isWebMobile && (
            <View style={skeletonPaddingStyle}>
              {Array.from({ length: 4 }).map((_, idx) => (
                <TravelCardSkeleton key={`travel-skeleton-${idx}`} />
              ))}
            </View>
          )}

          {/* Error */}
          {isError && !showInitialLoading && (
            <View style={paddingHorizontalStyle}>
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
              <View style={paddingHorizontalStyle}>
                <EmptyState
                  icon={getEmptyStateMessage.icon}
                  title={getEmptyStateMessage.title}
                  description={getEmptyStateMessage.description}
                  variant={getEmptyStateMessage.variant}
                  action={activeFiltersCount > 0 || search ? {
                    label: 'Сбросить фильтры',
                    onPress: () => {
                      onClearAll?.();
                      setSearch?.('');
                    },
                  } : undefined}
                  suggestions={getEmptyStateMessage.suggestions}
                />
              </View>
            )}

          {/* Travel Cards Grid - Only show when we have data */}
          {loadedResultsContent}
        </View>
      </View>
    )
  }
)

export default memo(RightColumn, areRightColumnPropsEqual)
