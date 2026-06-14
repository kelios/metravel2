import React, { memo, Suspense, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  View,
  ViewStyle,
  Text,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import Feather from '@expo/vector-icons/Feather'

import StickySearchBar from '@/components/mainPage/StickySearchBar'
import EmptyState from '@/components/ui/EmptyState'
import ContributionBanner from '@/components/common/ContributionBanner'
import { useThemedColors } from '@/hooks/useTheme'
import type { Travel } from '@/types/types'
import {
  areRightColumnPropsEqual,
  buildTravelRows,
  getRightColumnHeaderMinHeight,
  RECOMMENDATIONS_TOTAL_HEIGHT,
  TOP_SCROLL_PADDING,
} from '@/components/listTravel/rightColumnModel'
import {
  RecommendationsPlaceholder,
  RecommendationsTabs,
  TravelCardSkeletonComponent,
} from '@/components/listTravel/RightColumn.parts'
import {
  isWeb,
  useRightColumnStyles,
} from '@/components/listTravel/useRightColumnStyles'

interface RightColumnProps {
  search: string
  setSearch: (value: string) => void
  onClearAll?: () => void
  activeConditionChips?: Array<{
    key: string
    label: string
    onRemove: () => void
  }>
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
    action?: { label: string; onPress: () => void }
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
     activeConditionChips = [],
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
    const scheduledRafRef = useRef<number | null>(null)
    const scheduledTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastEndReachedAtRef = useRef(0)
    const lastEndReachedHeightRef = useRef(0)

    const cancelScheduledAfterLayout = useCallback(() => {
      if (scheduledRafRef.current != null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(scheduledRafRef.current)
      }
      scheduledRafRef.current = null
      if (scheduledTimeoutRef.current != null) {
        clearTimeout(scheduledTimeoutRef.current)
      }
      scheduledTimeoutRef.current = null
    }, [])

    const scheduleAfterLayout = useCallback((callback: () => void) => {
      cancelScheduledAfterLayout()
      if (typeof requestAnimationFrame === 'function') {
        scheduledRafRef.current = requestAnimationFrame(() => {
          scheduledRafRef.current = null
          callback()
        })
        return
      }
      scheduledTimeoutRef.current = setTimeout(() => {
        scheduledTimeoutRef.current = null
        callback()
      }, 0)
    }, [cancelScheduledAfterLayout])

    useEffect(() => cancelScheduledAfterLayout, [cancelScheduledAfterLayout])

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
        // Сбрасываем pending только при УСПЕШНОМ скролле: если offset ещё не измерен
        // (layout не пришёл), флаг должен сохраниться, чтобы скролл сработал позже.
        if (scrollToRecommendations()) {
          pendingRecommendationsScrollRef.current = false
        }
      })
    }, [scheduleAfterLayout, scrollToRecommendations])

    // isMobile (single-column, width < tablet breakpoint) already covers the old
    // `windowWidth <= 420` case, so we avoid useWindowDimensions() — it would
    // subscribe this list container to mobile address-bar height changes and
    // re-render the whole FlashList on every scroll frame (scroll jank).
    const isWebMobile = isWeb && isMobile
    const showRecommendations = isRecommendationsVisible

    useEffect(() => {
      if (!showRecommendations || !pendingRecommendationsScrollRef.current) return

      scheduleAfterLayout(() => {
        if (scrollToRecommendations()) {
          pendingRecommendationsScrollRef.current = false
        }
      })
    }, [scheduleAfterLayout, scrollToRecommendations, showRecommendations])

    const {
      cardsWrapperStyle,
      webContentContainerStyle,
      nativeContentContainerStyle,
      paddingHorizontalStyle,
      recommendationsSkeletonStyle,
      activeConditionChipStyles,
      rowLayout,
      skeletonGridStyle,
      skeletonCardWrapperStyle,
    } = useRightColumnStyles({
      colors,
      cardSpacing,
      contentPadding,
      gridColumns,
      isMobile,
      isExport,
      isWebMobile,
      cardsContainerStyle,
      cardsGridStyle,
    })

    const rows = useMemo(() => buildTravelRows(travels, gridColumns, isMobile), [travels, gridColumns, isMobile])

    const rowSeparatorStyle = useMemo(() => ({ height: cardSpacing }), [cardSpacing])
    const RowSeparator = useCallback(() => {
      return <View style={rowSeparatorStyle} />
    }, [rowSeparatorStyle])

    // Web: infinite scroll via onScroll instead of FlashList's onEndReached
    const webScrollHandler = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!onEndReached) return
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
      const distanceFromEnd = contentSize.height - layoutMeasurement.height - contentOffset.y
      const threshold = (onEndReachedThreshold ?? 0.5) * layoutMeasurement.height
      if (distanceFromEnd >= threshold) return

      // Guard against firing onEndReached on every scroll event: skip if a
      // request was made for the same scroll height, or more often than ~800ms.
      const now = Date.now()
      const sameHeight = contentSize.height === lastEndReachedHeightRef.current
      if (sameHeight && now - lastEndReachedAtRef.current < 800) return

      lastEndReachedAtRef.current = now
      lastEndReachedHeightRef.current = contentSize.height
      onEndReached()
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
        const { cols, rowStyle, itemWrapperStyle, placeholderStyle } = rowLayout;
        const missingSlots = Math.max(0, cols - rowItems.length);
        return (
          <View testID={`travel-row-${rowIndex}`} style={rowStyle}>
            {rowItems.map((travel, itemIndex) => (
              <View
                key={String(travel.id)}
                testID={`travel-row-${rowIndex}-item-${itemIndex}`}
                style={itemWrapperStyle}
              >
                {renderItem(travel, rowIndex * cols + itemIndex)}
              </View>
            ))}

            {Platform.OS === 'web' && !isMobile && missingSlots > 0
              ? Array.from({ length: missingSlots }).map((_, placeholderIndex) => (
                  <View
                    key={`placeholder-${rowIndex}-${placeholderIndex}`}
                    testID={`travel-row-${rowIndex}-placeholder-${placeholderIndex}`}
                    style={placeholderStyle}
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
        rowLayout,
        renderItem,
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

    const handleRecommendationsToggle = useCallback(() => {
      const nextVisible = !showRecommendations
      pendingRecommendationsScrollRef.current = nextVisible
      handleRecommendationsVisibilityChange(nextVisible)
    }, [handleRecommendationsVisibilityChange, showRecommendations])

    const shouldShowSkeleton = showInitialLoading && travels.length === 0
    const initialSkeletonCount = useMemo(() => {
      if (isMobile) return 4
      return Math.max(gridColumns * 2, 6)
    }, [gridColumns, isMobile])

    // Always render the search bar, even on mobile

    const listFooter = useMemo(
      () => (
        <>
          {showNextPageLoading ? (
            <View
              style={[
                footerLoaderStyle,
                isWeb ? { flexDirection: 'row', alignItems: 'center', gap: 8 } : null,
              ]}
            >
              <ActivityIndicator size="small" accessibilityLabel="Загружаем ещё маршруты" />
              {isWeb ? (
                <Text style={{ fontSize: 13, color: colors.textMuted }}>Загружаем ещё...</Text>
              ) : null}
            </View>
          ) : null}
          <ContributionBanner variant="search" />
        </>
      ),
      [showNextPageLoading, footerLoaderStyle, colors.textMuted]
    )

    const loadedResultsContent = useMemo(() => {
      if (showInitialLoading || isError || showEmptyState || travels.length === 0) {
        return null
      }

      // Web also uses FlashList to virtualize the grid and avoid unbounded DOM
      // growth across paginated pages. FlashList's internal ScrollView is the
      // single scroll container on web, so infinite scroll is driven through its
      // onScroll prop (webScrollHandler) — the same trigger used before — while
      // native relies on onEndReached.
      return (
        <FlashList
          ref={listRef as any}
          data={rows}
          renderItem={renderRow as any}
          extraData={gridColumns}
          keyExtractor={(_, index) => `row-${(isMobile ? 1 : gridColumns) || 1}-${index}`}
          {...({ estimatedItemSize: 320 } as any)}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={listFooter}
          ItemSeparatorComponent={isWeb ? RowSeparator : undefined}
          onEndReached={isWeb ? undefined : onEndReached}
          onEndReachedThreshold={onEndReachedThreshold}
          onScroll={isWeb ? webScrollHandler : undefined}
          drawDistance={isWeb ? 1600 : 800}
          contentContainerStyle={isWeb ? webContentContainerStyle : nativeContentContainerStyle}
          style={
            isWeb
              ? ({
                  flex: 1,
                  minHeight: 0,
                  WebkitOverflowScrolling: 'touch',
                  touchAction: isExport ? 'auto' : 'pan-y',
                  overscrollBehaviorY: 'contain',
                } as any)
              : undefined
          }
          testID={isWeb ? 'right-column-scrollview' : 'right-column-flashlist'}
          scrollEventThrottle={isWeb ? 32 : 16}
          removeClippedSubviews={!isWeb}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={8}
          windowSize={5}
        />
      )
    }, [
      ListHeader,
      RowSeparator,
      listFooter,
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
            resultsCount={isError ? undefined : total}
            activeFiltersCount={activeFiltersCount}
            onClearAll={onClearAll ?? (() => setSearch(''))}
          />
        </View>

        {topContentNodes ? (
          <View style={paddingHorizontalStyle}>{topContentNodes}</View>
        ) : null}

        {activeConditionChips.length > 0 ? (
          <View style={[paddingHorizontalStyle, activeConditionChipStyles.wrapper]}>
            {activeConditionChips.map((chip) => (
              <Pressable
                key={chip.key}
                accessibilityRole="button"
                accessibilityLabel={`Убрать условие: ${chip.label}`}
                onPress={chip.onRemove}
                style={activeConditionChipStyles.chip as any}
                testID={`active-condition-chip-${chip.key}`}
              >
                <Text numberOfLines={1} style={activeConditionChipStyles.chipText}>
                  {chip.label}
                </Text>
                <Feather name="x" size={14} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
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

          {/* Initial Loading - local shell for all layouts */}
          {shouldShowSkeleton && (
            <View style={skeletonGridStyle}>
              {Array.from({ length: initialSkeletonCount }).map((_, idx) => (
                <View key={`travel-skeleton-${idx}`} style={skeletonCardWrapperStyle as any}>
                  <TravelCardSkeletonComponent />
                </View>
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
                  action={
                    getEmptyStateMessage.action
                      ? getEmptyStateMessage.action
                      : activeFiltersCount > 0 || search
                        ? {
                            label: 'Сбросить условия',
                            onPress: () => {
                              onClearAll?.();
                              setSearch?.('');
                            },
                          }
                        : undefined
                  }
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
