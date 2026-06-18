import React, { useMemo } from 'react'
import {
  Pressable,
  RefreshControl,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { BottomSheetFlatList } from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Feather from '@expo/vector-icons/Feather'

import { Text } from '@/ui/paper'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { useThemedColors } from '@/hooks/useTheme'

import { EmptyState } from './TravelListPanel/EmptyState'
import { getStyles } from './TravelListPanel/styles'
import { useTravelItemRenderer } from './TravelListPanel/useTravelItemRenderer'
import { useWebVirtualization } from './TravelListPanel/useWebVirtualization'
import {
  buildTravelListSummaryHint,
  EMPTY_FAVORITES,
  getPlacesLabel,
  getTravelItemKey,
  IS_WEB,
  LIST_BOTTOM_PADDING,
  PLACE_COUNT_BADGE_CAP,
} from './TravelListPanel/helpers'
import { getWebCardWidth } from './AddressListItem/utils'

export { buildTravelListSummaryHint }

type Props = {
  travelsData: any[]
  buildRouteTo: (item: any) => void
  onHideTravel?: (id: string | number) => void
  isMobile?: boolean
  isLoading?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  onRefresh?: () => void
  isRefreshing?: boolean
  onClosePanel?: () => void
  onOpenFilters?: () => void
  onExpandList?: () => void
  onResetFilters?: () => void
  onExpandRadius?: () => void
  compactPreview?: boolean
  currentRadiusKm?: string | number | null
  userLocation?: { latitude: number; longitude: number } | null
  transportMode?: 'car' | 'bike' | 'foot'
  onToggleFavorite?: (id: string | number) => void
  favorites?: Set<string | number>
  useBottomSheetScrollable?: boolean
}

const TravelListPanel: React.FC<Props> = ({
  travelsData,
  buildRouteTo,
  onHideTravel,
  isMobile = false,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  onRefresh,
  isRefreshing = false,
  userLocation,
  transportMode = 'car',
  onToggleFavorite,
  favorites = EMPTY_FAVORITES,
  useBottomSheetScrollable = false,
  onClosePanel,
  onOpenFilters,
  onResetFilters,
  onExpandRadius,
  compactPreview = false,
  currentRadiusKm,
}) => {
  const themeColors = useThemedColors()
  const styles = useMemo(() => getStyles(themeColors), [themeColors])
  const { width: screenWidth } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  // Нижний паддинг списка мест: на native список — отдельный скроллер внутри
  // статичного контейнера шторки, поэтому paddingBottom самой шторки до него не
  // доходит. Без запаса последняя/первая карточка упирается в нижний край и
  // выглядит срезанной. Запас = базовый + системная навигация (gesture-bar).
  const listContentStyle = useMemo(
    () =>
      IS_WEB
        ? styles.list
        : [styles.list, { paddingBottom: LIST_BOTTOM_PADDING + insets.bottom }],
    [styles.list, insets.bottom],
  )

  const renderItem = useTravelItemRenderer({
    styles,
    isMobile,
    compactPreview,
    buildRouteTo,
    onHideTravel,
    userLocation,
    transportMode,
    screenWidth,
    onToggleFavorite,
    favorites,
  })

  const skeletonCards = useMemo(
    () => (
      <View style={styles.skeletonContainer}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.skeletonCard}>
            <SkeletonLoader width={48} height={48} borderRadius={12} />
            <View style={styles.skeletonLines}>
              <SkeletonLoader width="70%" height={14} borderRadius={4} />
              <SkeletonLoader width="45%" height={12} borderRadius={4} />
            </View>
          </View>
        ))}
      </View>
    ),
    [styles],
  )

  const visibleTravelsData = useMemo(
    () => (compactPreview ? travelsData.slice(0, 3) : travelsData),
    [compactPreview, travelsData],
  )

  const itemKeys = useMemo(
    () => visibleTravelsData.map((item: any, index: number) => getTravelItemKey(item, index)),
    [visibleTravelsData],
  )

  const { webWindow, webScrollHandler, recordItemHeight, setViewportHeight, setScrollRef } =
    useWebVirtualization({ itemKeys, hasMore, onLoadMore })

  const footer = useMemo(() => {
    if (compactPreview) return null
    if (isLoading) return skeletonCards
    if (!hasMore) return <Text style={styles.endText}>Это все места поблизости</Text>
    return null
  }, [compactPreview, hasMore, isLoading, skeletonCards, styles.endText])

  // Карточки списка имеют детерминированную ширину: на web — getWebCardWidth
  // (capped, центрируется), на native растягиваются на всю ширину минус
  // marginHorizontal:8. Шапку «Места рядом» приводим к ТОЙ ЖЕ ширине, иначе
  // полноширинная шапка выглядела как первая карточка иной ширины, чем
  // последующие (узкие, центрированные) карточки.
  const headerWidthStyle = useMemo(
    () =>
      IS_WEB
        ? { width: getWebCardWidth(screenWidth), alignSelf: 'center' as const }
        : { marginHorizontal: 8 },
    [screenWidth],
  )

  const listHeader = useMemo(() => {
    if (!isMobile || !travelsData.length) return null
    if (compactPreview) return null

    const placesCountLabel =
      travelsData.length > PLACE_COUNT_BADGE_CAP
        ? `${PLACE_COUNT_BADGE_CAP}+`
        : String(travelsData.length)
    const placesWord = getPlacesLabel(travelsData.length)
    const hasRadiusContext =
      currentRadiusKm != null && String(currentRadiusKm).trim() !== ''

    return (
      <View
        pointerEvents={IS_WEB ? 'box-none' : 'auto'}
        style={[styles.listHeaderCard, headerWidthStyle]}
        testID="travel-list-mobile-summary"
      >
        <View pointerEvents="none" style={styles.listHeaderTitleRow}>
          <Text style={styles.listHeaderTitle}>Места рядом</Text>
          <View style={styles.listHeaderCountChip}>
            <Text style={styles.listHeaderCountChipText}>
              {placesCountLabel} {placesWord}
              {hasRadiusContext ? ` · ${currentRadiusKm} км` : ''}
            </Text>
          </View>
        </View>

        <Text pointerEvents="none" style={styles.listHeaderHint}>
          Нажмите на карточку, чтобы сфокусировать карту.
        </Text>

        {onOpenFilters && (
          <View style={styles.listHeaderActions}>
            <Pressable
              testID="travel-list-open-filters"
              onPress={onOpenFilters}
              accessibilityRole="button"
              accessibilityLabel="Открыть фильтры"
              hitSlop={6}
              style={({ pressed }) => [
                styles.filtersButton,
                pressed && styles.filtersButtonPressed,
              ]}
            >
              <Feather name="sliders" size={15} color={themeColors.primary} />
              <Text style={styles.filtersButtonText}>Фильтры</Text>
            </Pressable>
          </View>
        )}
      </View>
    )
  }, [compactPreview, currentRadiusKm, headerWidthStyle, isMobile, onOpenFilters, styles, themeColors, travelsData.length])

  const refreshControl = useMemo(
    () =>
      onRefresh ? (
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={themeColors.primary}
          colors={[themeColors.primary]}
        />
      ) : undefined,
    [onRefresh, isRefreshing, themeColors.primary],
  )

  if (!travelsData || travelsData.length === 0) {
    if (isLoading) return skeletonCards
    return (
      <EmptyState
        styles={styles}
        onExpandRadius={onExpandRadius}
        onResetFilters={onResetFilters}
        onOpenFilters={onOpenFilters}
        onClosePanel={onClosePanel}
      />
    )
  }

  if (IS_WEB) {
    const { startIndex, endIndex, topSpacerHeight, bottomSpacerHeight } = webWindow
    return (
      <ScrollView
        ref={setScrollRef}
        style={styles.webScrollView}
        contentContainerStyle={styles.list}
        onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
        onScroll={webScrollHandler}
        scrollEventThrottle={32}
        refreshControl={refreshControl}
      >
        {listHeader}
        {topSpacerHeight > 0 && <View style={{ height: topSpacerHeight }} />}
        {visibleTravelsData.slice(startIndex, endIndex).map((item: any, i: number) => {
          // Абсолютный индекс по visibleTravelsData — чтобы ключ совпадал с
          // itemKeys[absoluteIndex] (см. webWindow/recordItemHeight).
          const key = getTravelItemKey(item, startIndex + i)
          return (
            <View
              key={key}
              onLayout={(e) => recordItemHeight(key, e.nativeEvent.layout.height)}
            >
              {renderItem({ item })}
            </View>
          )
        })}
        {bottomSpacerHeight > 0 && <View style={{ height: bottomSpacerHeight }} />}
        {footer}
      </ScrollView>
    )
  }

  const NativeListComponent = useBottomSheetScrollable ? BottomSheetFlatList : FlashList

  return (
    <NativeListComponent
      data={visibleTravelsData}
      keyExtractor={getTravelItemKey}
      renderItem={renderItem}
      style={styles.nativeList}
      contentContainerStyle={listContentStyle}
      {...(useBottomSheetScrollable ? null : ({ estimatedItemSize: isMobile ? 100 : 120 } as any))}
      onEndReachedThreshold={compactPreview ? undefined : 0.5}
      onEndReached={compactPreview ? undefined : onLoadMore && hasMore ? onLoadMore : undefined}
      ListHeaderComponent={listHeader}
      ListFooterComponent={footer}
      drawDistance={isMobile ? 500 : 800}
      refreshControl={!compactPreview ? refreshControl : undefined}
    />
  )
}

export default React.memo(TravelListPanel)
