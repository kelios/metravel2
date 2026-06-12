import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { BottomSheetFlatList } from '@gorhom/bottom-sheet'

import { Text } from '@/ui/paper'
import AddressListItem from './AddressListItem'
import { SwipeableListItem } from './SwipeableListItem'
import Button from '@/components/ui/Button'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useFavorites } from '@/context/FavoritesContext'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { showToast } from '@/utils/toast'

const IS_WEB = Platform.OS === 'web'
const WEB_LIST_OVERSCAN_ITEMS = 5
const WEB_ESTIMATED_ITEM_HEIGHT_PX = 340
const WEB_DEFAULT_VIEWPORT_HEIGHT = 600
const LOAD_MORE_THRESHOLD_RATIO = 0.5
const PLACE_COUNT_BADGE_CAP = 999

const EMPTY_FAVORITES = new Set<string | number>()

function getPlacesLabel(count: number) {
  const absCount = Math.abs(count) % 100
  const lastDigit = absCount % 10
  if (absCount > 10 && absCount < 20) return 'мест'
  if (lastDigit === 1) return 'место'
  if (lastDigit >= 2 && lastDigit <= 4) return 'места'
  return 'мест'
}

export function buildTravelListSummaryHint({
  travelsCount,
  compactPreview,
  currentRadiusKm,
  userLocation,
}: {
  travelsCount: number
  compactPreview: boolean
  currentRadiusKm?: string | number | null
  userLocation?: { latitude: number; longitude: number } | null
}) {
  if (compactPreview) {
    return 'Ближайшие места одним взглядом. Полный список откроет больше вариантов.'
  }

  const placesCountLabel =
    travelsCount > PLACE_COUNT_BADGE_CAP ? `${PLACE_COUNT_BADGE_CAP}+` : String(travelsCount)
  const placesWord = getPlacesLabel(travelsCount)
  const hasRadiusContext = currentRadiusKm != null && String(currentRadiusKm).trim() !== ''

  if (hasRadiusContext) {
    return `${placesCountLabel} ${placesWord} в радиусе ${currentRadiusKm} км${userLocation ? ' рядом с вами' : ''}. Нажмите на карточку, чтобы сфокусировать карту.`
  }

  if (userLocation) {
    return `${placesCountLabel} ${placesWord} рядом с вами. Нажмите на карточку, чтобы сфокусировать карту.`
  }

  return `${placesCountLabel} ${placesWord} рядом. Нажмите на карточку, чтобы сфокусировать карту.`
}

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

const getTravelItemTitle = (item: any): string =>
  String(item?.address || item?.name || item?.title || 'Место')

const getTravelItemSubtitle = (item: any): string => {
  const category = item?.categoryName || item?.category || item?.typeName
  if (category) return String(category)
  if (item?.coord) return String(item.coord)
  return 'Место рядом'
}

const getTravelItemId = (item: any): string | number | undefined =>
  item?.id ?? item?._id ?? item?.slug ?? item?.uid

const getTravelItemKey = (item: any): string =>
  String(
    getTravelItemId(item) ??
      item?.url ??
      item?.urlTravel ??
      item?.articleUrl ??
      item?.coord ??
      item?.address ??
      item?.name ??
      item?.title ??
      JSON.stringify(item ?? {}),
  )

// Variable-height windowing: card heights vary (~200–360px depending on
// breakpoint/content), so a single fixed estimate produces drifting spacers
// and scroll jumps. We use measured heights (falling back to the estimate for
// rows not yet laid out) and a running offset scan.
function computeVirtualWindowVariable(
  scrollY: number,
  viewportH: number,
  itemCount: number,
  getItemHeight: (index: number) => number,
  overscan: number,
) {
  let startIndex = 0
  let endIndex = itemCount
  let topSpacerHeight = 0
  let bottomSpacerHeight = 0

  let offset = 0
  let i = 0
  for (; i < itemCount; i++) {
    const h = getItemHeight(i)
    if (offset + h > scrollY) break
    offset += h
  }
  startIndex = Math.max(0, i - overscan)

  let topOffset = 0
  for (let k = 0; k < startIndex; k++) topOffset += getItemHeight(k)
  topSpacerHeight = topOffset

  let visibleBottom = topOffset
  let j = startIndex
  for (; j < itemCount; j++) {
    if (visibleBottom > scrollY + viewportH) break
    visibleBottom += getItemHeight(j)
  }
  endIndex = Math.min(itemCount, j + overscan)

  let bottomOffset = 0
  for (let k = endIndex; k < itemCount; k++) bottomOffset += getItemHeight(k)
  bottomSpacerHeight = Math.max(0, bottomOffset)

  return { startIndex, endIndex, topSpacerHeight, bottomSpacerHeight }
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

  const { addFavorite, removeFavorite, isFavorite: isFavoriteInContext } = useFavorites()
  const { isAuthenticated, requireAuth } = useRequireAuth({ intent: 'favorite' })

  const webScrollRafRef = useRef<number | null>(null)
  const [webScrollY, setWebScrollY] = useState(0)
  const [webViewportH, setWebViewportH] = useState(0)
  const itemHeightsRef = useRef<Map<string, number>>(new Map())
  const [heightsVersion, setHeightsVersion] = useState(0)

  const recordItemHeight = useCallback((key: string, h: number) => {
    if (!h) return
    const prev = itemHeightsRef.current.get(key)
    if (prev != null && Math.abs(prev - h) < 1) return
    itemHeightsRef.current.set(key, h)
    setHeightsVersion((v) => v + 1)
  }, [])

  const renderItem = useCallback(
    ({ item }: any) => {
      const itemId = getTravelItemId(item)
      const canUseItemId = itemId !== undefined && itemId !== null
      const isFavorite = canUseItemId ? favorites.has(itemId) : false

      const onHidePress =
        onHideTravel && canUseItemId ? () => onHideTravel(itemId) : undefined

      if (!IS_WEB && isMobile && compactPreview) {
        return (
          <Pressable
            onPress={() => buildRouteTo(item)}
            style={({ pressed }) => [
              styles.compactPreviewCard,
              pressed && styles.compactPreviewCardPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Открыть место: ${getTravelItemTitle(item)}`}
          >
            <View style={styles.compactPreviewIcon}>
              <Text style={styles.compactPreviewIconText}>⌖</Text>
            </View>
            <View style={styles.compactPreviewText}>
              <Text style={styles.compactPreviewTitle} numberOfLines={1}>
                {getTravelItemTitle(item)}
              </Text>
              <Text style={styles.compactPreviewSubtitle} numberOfLines={1}>
                {getTravelItemSubtitle(item)}
              </Text>
            </View>
          </Pressable>
        )
      }

      // Native mobile: favorite is handled by the swipe gesture, so the card
      // itself must NOT render a favorite button (avoids a duplicate action).
      if (!IS_WEB && isMobile) {
        return (
          <SwipeableListItem
            onFavorite={
              onToggleFavorite && canUseItemId ? () => onToggleFavorite(itemId) : undefined
            }
            onBuildRoute={() => buildRouteTo(item)}
            showFavorite={!!onToggleFavorite}
            showRoute
            isFavorite={isFavorite}
          >
            <AddressListItem
              travel={item}
              isMobile={isMobile}
              onPress={() => buildRouteTo(item)}
              onHidePress={onHidePress}
              userLocation={userLocation}
              transportMode={transportMode}
              screenWidth={screenWidth}
            />
          </SwipeableListItem>
        )
      }

      // Web (incl. web-mobile) and native desktop: no swipe, so expose an
      // explicit favorite toggle button on the card, backed by the favorites
      // context (the prop-based path is only used by the native swipe wrapper).
      const ctxIsFavorite =
        canUseItemId && isFavoriteInContext(itemId, 'travel')
      const handleToggleFavorite = canUseItemId
        ? () => {
            if (!isAuthenticated) {
              requireAuth()
              return
            }
            const action = ctxIsFavorite
              ? removeFavorite(itemId as string | number, 'travel')
              : addFavorite({
                  id: itemId as string | number,
                  type: 'travel',
                  title: item?.address || item?.name || item?.title || 'Место',
                  url:
                    item?.urlTravel || item?.articleUrl || `/travels/${itemId}`,
                  imageUrl: item?.travelImageThumbUrl || item?.imageUrl,
                })
            void Promise.resolve(action).catch(() => {
              void showToast({
                type: 'error',
                text1: 'Не удалось обновить избранное',
                position: 'bottom',
              })
            })
          }
        : undefined

      return (
        <AddressListItem
          travel={item}
          isMobile={isMobile}
          onPress={() => buildRouteTo(item)}
          onHidePress={onHidePress}
          userLocation={userLocation}
          transportMode={transportMode}
          isFavorite={ctxIsFavorite}
          onToggleFavorite={handleToggleFavorite}
          screenWidth={screenWidth}
        />
      )
    },
    [
      isMobile,
      compactPreview,
      buildRouteTo,
      onHideTravel,
      userLocation,
      transportMode,
      screenWidth,
      styles,
      onToggleFavorite,
      favorites,
      addFavorite,
      removeFavorite,
      isFavoriteInContext,
      isAuthenticated,
      requireAuth,
    ],
  )

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

  const webScrollHandler = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
      const raf = (globalThis as any)?.requestAnimationFrame as
        | undefined
        | ((cb: () => void) => number)
      const caf = (globalThis as any)?.cancelAnimationFrame as
        | undefined
        | ((id: number) => void)

      const apply = () => {
        setWebScrollY(contentOffset.y)
        setWebViewportH(layoutMeasurement.height)
      }

      if (typeof raf === 'function') {
        if (webScrollRafRef.current != null && typeof caf === 'function') {
          caf(webScrollRafRef.current)
        }
        webScrollRafRef.current = raf(apply)
      } else {
        apply()
      }

      if (!hasMore || !onLoadMore) return
      const distanceFromEnd =
        contentSize.height - layoutMeasurement.height - contentOffset.y
      if (distanceFromEnd < layoutMeasurement.height * LOAD_MORE_THRESHOLD_RATIO) {
        onLoadMore()
      }
    },
    [hasMore, onLoadMore],
  )

  const visibleTravelsData = useMemo(
    () => (compactPreview ? travelsData.slice(0, 3) : travelsData),
    [compactPreview, travelsData],
  )

  const itemKeys = useMemo(
    () => visibleTravelsData.map((item: any) => getTravelItemKey(item)),
    [visibleTravelsData],
  )

  const webWindow = useMemo(
    () =>
      computeVirtualWindowVariable(
        webScrollY,
        webViewportH || WEB_DEFAULT_VIEWPORT_HEIGHT,
        itemKeys.length,
        (i) =>
          itemHeightsRef.current.get(itemKeys[i]) ?? WEB_ESTIMATED_ITEM_HEIGHT_PX,
        WEB_LIST_OVERSCAN_ITEMS,
      ),
    // heightsVersion intentionally included: bumped when a row reports a new
    // measured height so the window recomputes against real offsets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [webScrollY, webViewportH, itemKeys, heightsVersion],
  )

  const footer = useMemo(() => {
    if (compactPreview) return null
    if (isLoading) return skeletonCards
    if (!hasMore) return <Text style={styles.endText}>Это все места поблизости</Text>
    return null
  }, [compactPreview, hasMore, isLoading, skeletonCards, styles.endText])

  const listHeader = useMemo(() => {
    if (!isMobile || !travelsData.length) return null
    if (compactPreview) return null

    const hintText = buildTravelListSummaryHint({
      travelsCount: travelsData.length,
      compactPreview,
      currentRadiusKm,
      userLocation,
    })
    const swipeHint =
      !compactPreview && !IS_WEB
        ? 'Свайп вправо — в избранное, влево — построить маршрут.'
        : null

    return (
      <View
        pointerEvents={IS_WEB ? 'box-none' : 'auto'}
        style={styles.listHeaderCard}
        testID="travel-list-mobile-summary"
      >
        <Text pointerEvents="none" style={styles.listHeaderTitle}>
          Места рядом
        </Text>
        <Text pointerEvents="none" style={styles.listHeaderHint}>
          {hintText}
        </Text>
        {swipeHint && (
          <Text pointerEvents="none" style={styles.listHeaderSwipeHint}>
            {swipeHint}
          </Text>
        )}
        {onOpenFilters && (
          <View style={styles.listHeaderActions}>
            <Button
              label="Фильтры"
              onPress={onOpenFilters}
              variant="outline"
              size="sm"
              testID="travel-list-open-filters"
            />
          </View>
        )}
      </View>
    )
  }, [compactPreview, currentRadiusKm, isMobile, onOpenFilters, styles, travelsData.length, userLocation])

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
        style={styles.webScrollView}
        contentContainerStyle={styles.list}
        onLayout={(e) => setWebViewportH(e.nativeEvent.layout.height)}
        onScroll={webScrollHandler}
        scrollEventThrottle={32}
        refreshControl={refreshControl}
      >
        {listHeader}
        {topSpacerHeight > 0 && <View style={{ height: topSpacerHeight }} />}
        {visibleTravelsData.slice(startIndex, endIndex).map((item: any) => {
          const key = getTravelItemKey(item)
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

  // Android: координация scrollable↔sheet в gorhom v5 + reanimated 4 (new arch)
  // не отдаёт жест списку — контент-pan шторки съедает все вертикальные свайпы
  // (handle-drag работает, список мёртв). Шторка для таба «Места» отключает
  // content panning (MapBottomSheet), а список рендерится обычным FlatList.
  const NativeListComponent = useBottomSheetScrollable
    ? Platform.OS === 'android'
      ? FlatList
      : BottomSheetFlatList
    : FlashList

  return (
    <NativeListComponent
      data={visibleTravelsData}
      keyExtractor={getTravelItemKey}
      renderItem={renderItem}
      style={styles.nativeList}
      contentContainerStyle={styles.list}
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

function EmptyState({
  styles,
  onExpandRadius,
  onResetFilters,
  onOpenFilters,
  onClosePanel,
}: {
  styles: ReturnType<typeof getStyles>
  onExpandRadius?: () => void
  onResetFilters?: () => void
  onOpenFilters?: () => void
  onClosePanel?: () => void
}) {
  const actions: Array<{
    label: string
    onPress: () => void
    variant: 'primary' | 'outline' | 'ghost'
    testID: string
  }> = []
  if (onExpandRadius) {
    actions.push({
      label: 'Увеличить радиус поиска',
      onPress: onExpandRadius,
      variant: 'primary',
      testID: 'empty-expand-radius',
    })
  }
  if (onResetFilters) {
    actions.push({
      label: 'Сбросить фильтры',
      onPress: onResetFilters,
      variant: 'outline',
      testID: 'empty-reset-filters',
    })
  }
  if (onOpenFilters) {
    actions.push({
      label: 'Изменить фильтры',
      onPress: onOpenFilters,
      variant: 'ghost',
      testID: 'empty-open-filters',
    })
  }
  if (onClosePanel) {
    actions.push({
      label: 'Вернуться на карту',
      onPress: onClosePanel,
      variant: 'ghost',
      testID: 'empty-back-to-map',
    })
  }

  return (
    <View style={styles.emptyContainer}>
      <Image
        source={require('@/assets/no-data.webp')}
        style={styles.emptyImage}
        resizeMode="contain"
        accessibilityLabel="Нет данных"
      />
      <Text style={styles.emptyText}>Ничего не нашлось</Text>
      <Text style={styles.emptyHint}>
        {actions.length > 0
          ? 'В этой области нет мест по текущим фильтрам. Выберите действие ниже:'
          : 'В этой области нет мест по текущим фильтрам. Измените радиус или фильтры поиска.'}
      </Text>
      <View style={styles.emptyActions}>
        {actions.map((action) => (
          <Button
            key={action.testID}
            label={action.label}
            onPress={action.onPress}
            variant={action.variant}
            size="sm"
            testID={action.testID}
          />
        ))}
      </View>
    </View>
  )
}

export default React.memo(TravelListPanel)

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    list: { paddingBottom: 8, alignItems: 'center' },
    listHeaderCard: {
      width: '100%',
      padding: 12,
      marginBottom: 10,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      gap: 6,
    },
    listHeaderTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
    listHeaderHint: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
    listHeaderSwipeHint: {
      fontSize: 12,
      lineHeight: 16,
      color: colors.textMuted,
      fontStyle: 'italic',
    },
    listHeaderActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      marginTop: 2,
    },
    webScrollView: {
      flex: 1,
      minHeight: 0,
      width: '100%',
      ...(IS_WEB
        ? ({ scrollbarWidth: 'thin', scrollbarColor: `${colors.border} transparent` } as any)
        : null),
    },
    nativeList: {
      flex: 1,
      minHeight: 0,
      width: '100%',
    },
    compactPreviewCard: {
      width: '100%',
      minHeight: 76,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    compactPreviewCardPressed: {
      opacity: 0.85,
    },
    compactPreviewIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
    },
    compactPreviewIconText: {
      color: colors.primary,
      fontSize: 20,
      fontWeight: '800',
    },
    compactPreviewText: {
      flex: 1,
      minWidth: 0,
    },
    compactPreviewTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      lineHeight: 20,
    },
    compactPreviewSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 2,
    },
    loader: { paddingVertical: 16, alignItems: 'center' },
    endText: {
      textAlign: 'center',
      color: colors.textMuted,
      paddingVertical: 16,
      fontSize: 12,
    },
    emptyContainer: { padding: 32, alignItems: 'center', gap: 8 },
    emptyImage: { width: 120, height: 120, marginBottom: 8, opacity: 0.85 },
    emptyText: { fontSize: 16, fontWeight: '600', color: colors.text },
    emptyHint: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptyActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
      marginTop: 4,
    },
    skeletonContainer: { padding: 12, gap: 12 },
    skeletonCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    skeletonLines: { flex: 1, gap: 8 },
  })
