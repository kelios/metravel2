import React, { useCallback, useMemo } from 'react';
import { Image, View, StyleSheet, RefreshControl, Platform } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Text } from '@/ui/paper';
import AddressListItem from './AddressListItem';
import { SwipeableListItem } from './SwipeableListItem';
import Button from '@/components/ui/Button';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

type Props = {
  travelsData: any[];
  buildRouteTo: (item: any) => void;

  onHideTravel?: (id: string | number) => void;

  isMobile?: boolean;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;

  onClosePanel?: () => void;
  onResetFilters?: () => void;
  onExpandRadius?: () => void;

  /** координаты пользователя для расчета расстояния */
  userLocation?: { latitude: number; longitude: number } | null;
  /** режим транспорта */
  transportMode?: 'car' | 'bike' | 'foot';
  /** обработчик добавления в избранное */
  onToggleFavorite?: (id: string | number) => void;
  /** список избранных мест (ids) */
  favorites?: Set<string | number>;
};

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
                                          favorites = new Set(),
                                          onResetFilters,
                                          onExpandRadius,
                                          }) => {
  const themeColors = useThemedColors();
  const styles = useMemo(() => getStyles(themeColors), [themeColors]);

  const renderItem = useCallback(({ item }: any) => {
    const itemId = item.id ?? item._id ?? item.slug ?? item.uid;
    const isFavorite = favorites.has(itemId);

    const content = (
      <AddressListItem
        travel={item}
        isMobile={isMobile}
        onPress={() => buildRouteTo(item)}
        onHidePress={onHideTravel ? () => onHideTravel(itemId) : undefined}
        userLocation={userLocation}
        transportMode={transportMode}
      />
    );

    // На мобильных (не веб) оборачиваем в Swipeable
    if (Platform.OS !== 'web' && isMobile) {
      return (
        <SwipeableListItem
          onFavorite={onToggleFavorite ? () => onToggleFavorite(itemId) : undefined}
          onBuildRoute={() => buildRouteTo(item)}
          showFavorite={!!onToggleFavorite}
          showRoute={true}
          isFavorite={isFavorite}
        >
          {content}
        </SwipeableListItem>
      );
    }

    return content;
  }, [isMobile, buildRouteTo, onHideTravel, userLocation, transportMode, onToggleFavorite, favorites]);

  const keyExtractor = useCallback(
    (item: any, index: number) => String(item.id ?? item._id ?? item.slug ?? index),
    []
  );

  const skeletonCards = useMemo(() => (
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
  ), [styles]);

  const footer = useMemo(() => {
    if (isLoading) {
      return skeletonCards;
    }
    if (!hasMore) {
      return <Text style={styles.endText}>Это всё поблизости</Text>;
    }
    return null;
  }, [hasMore, isLoading, skeletonCards, styles.endText]);

  if (!travelsData || travelsData.length === 0) {
    if (isLoading) {
      return skeletonCards;
    }
    return (
      <View style={styles.emptyContainer}>
        <Image
          source={require('@/assets/no-data.webp')}
          style={styles.emptyImage}
          resizeMode="contain"
          accessibilityLabel="Нет данных"
        />
        <Text style={styles.emptyText}>Рядом ничего не нашлось</Text>
        <Text style={styles.emptyHint}>Попробуйте изменить фильтры или увеличить радиус поиска</Text>
        <View style={styles.emptyActions}>
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
        </View>
      </View>
    );
  }

  return (
    <FlashList
      data={travelsData}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      {...({ estimatedItemSize: isMobile ? 100 : 120 } as any)}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (hasMore && onLoadMore) onLoadMore();
      }}
      ListFooterComponent={footer}
      drawDistance={isMobile ? 500 : 800}
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
    />
  );
};

export default React.memo(TravelListPanel);

const getStyles = (colors: ThemedColors) => StyleSheet.create({
  list: { paddingBottom: 8 },
  loader: { paddingVertical: 16, alignItems: 'center' },
  endText: { textAlign: 'center', color: colors.textMuted, paddingVertical: 16, fontSize: 12 },
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
    flexDirection: 'row',
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
});
