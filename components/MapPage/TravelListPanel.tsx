import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Text } from '@/ui/paper';
import AddressListItem from './AddressListItem';
import { SwipeableListItem } from './SwipeableListItem';
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

  const footer = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.loader}>
          <ActivityIndicator size="small" color={themeColors.primary} />
        </View>
      );
    }
    if (!hasMore) {
      return <Text style={styles.endText}>Это всё поблизости</Text>;
    }
    return null;
  }, [hasMore, isLoading, styles.endText, styles.loader, themeColors.primary]);

  if (!travelsData || travelsData.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Мест не найдено</Text>
        <Text style={styles.emptyHint}>Попробуйте изменить фильтры или увеличить радиус поиска</Text>
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
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
