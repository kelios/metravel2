import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { Text } from '@/ui/paper'
import AddressListItem from './AddressListItem'
import { SwipeableListItem } from './SwipeableListItem'
import Button from '@/components/ui/Button'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

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
  userLocation?: { latitude: number; longitude: number } | null
  transportMode?: 'car' | 'bike' | 'foot'
  onToggleFavorite?: (id: string | number) => void
  favorites?: Set<string | number>
}

const EMPTY_FAVORITES = new Set<string | number>()
const WEB_LIST_OVERSCAN_ITEMS = 5
const WEB_ESTIMATED_ITEM_HEIGHT_PX = 340

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
  onClosePanel,
  onOpenFilters,
  onExpandList: _onExpandList,
  onResetFilters,
  onExpandRadius,
  compactPreview = false,
}) => {
  const themeColors = useThemedColors()
  const styles = useMemo(() => getStyles(themeColors), [themeColors])

  const webScrollRafRef = useRef<number | null>(null)
  const [webScrollY, setWebScrollY] = useState(0)
  const [webViewportH, setWebViewportH] = useState(0)

  const renderItem = useCallback(
    ({ item }: any) => {
      const itemId = item.id ?? item._id ?? item.slug ?? item.uid
      const isFavorite = favorites.has(itemId)

      const content = (
        <AddressListItem
          travel={item}
          isMobile={isMobile}
          onPress={() => buildRouteTo(item)}
          onHidePress={onHideTravel ? () => onHideTravel(itemId) : undefined}
          userLocation={userLocation}
          transportMode={transportMode}
        />
      )

      if (Platform.OS !== 'web' && isMobile) {
        return (
          <SwipeableListItem
            onFavorite={
              onToggleFavorite ? () => onToggleFavorite(itemId) : undefined
            }
            onBuildRoute={() => buildRouteTo(item)}
            showFavorite={!!onToggleFavorite}
            showRoute={true}
            isFavorite={isFavorite}
          >
            {content}
          </SwipeableListItem>
        )
      }

      return content
    },
    [
      isMobile,
      buildRouteTo,
      onHideTravel,
      userLocation,
      transportMode,
      onToggleFavorite,
      favorites,
    ],
  )

  const keyExtractor = useCallback(
    (item: any, index: number) =>
      String(item.id ?? item._id ?? item.slug ?? index),
    [],
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

      if (typeof raf === 'function') {
        if (webScrollRafRef.current != null && typeof caf === 'function') {
          caf(webScrollRafRef.current)
        }

        webScrollRafRef.current = raf(() => {
          setWebScrollY(contentOffset.y)
          setWebViewportH(layoutMeasurement.height)
        })
      } else {
        setWebScrollY(contentOffset.y)
        setWebViewportH(layoutMeasurement.height)
      }

      if (!hasMore || !onLoadMore) return
      const distanceFromEnd =
        contentSize.height - layoutMeasurement.height - contentOffset.y
      if (distanceFromEnd < layoutMeasurement.height * 0.5) {
        onLoadMore()
      }
    },
    [hasMore, onLoadMore],
  )

  const visibleTravelsData = useMemo(
    () => (compactPreview ? travelsData.slice(0, 3) : travelsData),
    [compactPreview, travelsData],
  )

  const footer = useMemo(() => {
    if (compactPreview) return null
    if (isLoading) return skeletonCards
    if (!hasMore) {
      return <Text style={styles.endText}>Это все места поблизости</Text>
    }
    return null
  }, [compactPreview, hasMore, isLoading, skeletonCards, styles.endText])

  const listHeader = useMemo(() => {
    if (!isMobile || !travelsData.length) {
      return null
    }
    const placesCountLabel =
      travelsData.length > 999 ? '999+' : String(travelsData.length)
    const hintText = compactPreview
      ? 'Быстрый просмотр рядом. Откройте весь список, если хотите сравнить больше вариантов.'
      : `${placesCountLabel} мест рядом. Откройте место, чтобы сфокусироваться на карте и быстро перейти к маршруту без повторяющихся подсказок в каждой карточке.`

    return (
      <View
        pointerEvents={Platform.OS === 'web' ? 'box-none' : 'auto'}
        style={styles.listHeaderCard}
        testID="travel-list-mobile-summary"
      >
        <Text pointerEvents="none" style={styles.listHeaderTitle}>
          Места рядом
        </Text>
        <Text pointerEvents="none" style={styles.listHeaderHint}>
          {hintText}
        </Text>
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
  }, [
    compactPreview,
    isMobile,
    onOpenFilters,
    styles,
    travelsData.length,
  ])

  if (!travelsData || travelsData.length === 0) {
    if (isLoading) {
      return skeletonCards
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
          Попробуйте увеличить радиус или сбросить фильтры
        </Text>
        <View style={styles.emptyActions}>
          {onOpenFilters && (
            <Button
              label="Фильтры"
              onPress={onOpenFilters}
              variant="outline"
              size="sm"
              testID="empty-open-filters"
            />
          )}
          {onResetFilters && (
            <Button
              label="Сбросить фильтры"
              onPress={onResetFilters}
              variant="outline"
              size="sm"
              testID="empty-reset-filters"
            />
          )}
          {onExpandRadius && (
            <Button
              label="Увеличить радиус"
              onPress={onExpandRadius}
              variant="ghost"
              size="sm"
              testID="empty-expand-radius"
            />
          )}
          {onClosePanel && (
            <Button
              label="Карта"
              onPress={onClosePanel}
              variant="ghost"
              size="sm"
              testID="empty-back-to-map"
            />
          )}
        </View>
      </View>
    )
  }

  if (Platform.OS === 'web') {
    if (isMobile) {
      return (
        <ScrollView
          style={styles.webScrollView}
          contentContainerStyle={styles.list}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor={themeColors.primary}
                colors={[themeColors.primary]}
              />
            ) : undefined
          }
        >
          {listHeader}
          {visibleTravelsData.map((item: any, index: number) => (
            <React.Fragment
              key={String(item.id ?? item._id ?? item.slug ?? index)}
            >
              {renderItem({ item })}
            </React.Fragment>
          ))}
          {footer}
        </ScrollView>
      )
    }

    const viewportH = webViewportH || 600
    const startIndex = Math.max(
      0,
      Math.floor(webScrollY / WEB_ESTIMATED_ITEM_HEIGHT_PX) -
        WEB_LIST_OVERSCAN_ITEMS,
    )
    const endIndex = Math.min(
      travelsData.length,
      Math.ceil((webScrollY + viewportH) / WEB_ESTIMATED_ITEM_HEIGHT_PX) +
        WEB_LIST_OVERSCAN_ITEMS,
    )

    const topSpacerHeight = startIndex * WEB_ESTIMATED_ITEM_HEIGHT_PX
    const bottomSpacerHeight = Math.max(
      0,
      (travelsData.length - endIndex) * WEB_ESTIMATED_ITEM_HEIGHT_PX,
    )

    return (
      <ScrollView
        style={styles.webScrollView}
        contentContainerStyle={styles.list}
        onLayout={(e) => {
          setWebViewportH(e.nativeEvent.layout.height)
        }}
        onScroll={webScrollHandler}
        scrollEventThrottle={32}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={themeColors.primary}
              colors={[themeColors.primary]}
            />
          ) : undefined
        }
      >
        {topSpacerHeight > 0 && <View style={{ height: topSpacerHeight }} />}
        {listHeader}
        {visibleTravelsData
          .slice(startIndex, endIndex)
          .map((item: any, index: number) => (
            <React.Fragment
              key={String(
                item.id ?? item._id ?? item.slug ?? startIndex + index,
              )}
            >
              {renderItem({ item })}
            </React.Fragment>
          ))}
        {bottomSpacerHeight > 0 && (
          <View style={{ height: bottomSpacerHeight }} />
        )}
        {footer}
      </ScrollView>
    )
  }

  return (
    <FlashList
      data={visibleTravelsData}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      {...({ estimatedItemSize: isMobile ? 100 : 120 } as any)}
      onEndReachedThreshold={compactPreview ? undefined : 0.5}
      onEndReached={
        compactPreview
          ? undefined
          : onLoadMore && hasMore
            ? onLoadMore
            : undefined
      }
      ListHeaderComponent={listHeader}
      ListFooterComponent={footer}
      drawDistance={isMobile ? 500 : 800}
      refreshControl={
        !compactPreview && onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={themeColors.primary}
            colors={[themeColors.primary]}
          />
        ) : undefined
      }
    />
  )
}

export default React.memo(TravelListPanel)

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    list: { paddingBottom: 8, alignItems: 'center' },
    listHeaderCard: {
      width: '100%',
      padding: 14,
      marginBottom: 10,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      gap: 8,
    },
    listHeaderTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    listHeaderHint: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textMuted,
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
      ...(Platform.OS === 'web'
        ? ({
            scrollbarWidth: 'thin',
            scrollbarColor: `${colors.border} transparent`,
          } as any)
        : null),
    },
    loader: { paddingVertical: 16, alignItems: 'center' },
    endText: {
      textAlign: 'center',
      color: colors.textMuted,
      paddingVertical: 16,
      fontSize: 12,
    },
    emptyContainer: {
      padding: 32,
      alignItems: 'center',
      gap: 8,
    },
    emptyImage: {
      width: 120,
      height: 120,
      marginBottom: 8,
      opacity: 0.85,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    emptyHint: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptyActions: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: 12,
      marginTop: 4,
    },
    skeletonContainer: {
      padding: 12,
      gap: 12,
    },
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
    skeletonLines: {
      flex: 1,
      gap: 8,
    },
  })
