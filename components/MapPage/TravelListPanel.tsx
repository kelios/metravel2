import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Text } from 'react-native-paper';
import AddressListItem from './AddressListItem';
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
                                          }) => {
  const themeColors = useThemedColors();
  const styles = useMemo(() => getStyles(themeColors), [themeColors]);
  const renderItem = useCallback(({ item }: any) => {
    return (
      <AddressListItem
        travel={item}
        isMobile={isMobile}
        onPress={() => buildRouteTo(item)}
        onHidePress={onHideTravel ? () => onHideTravel(item.id ?? item._id ?? item.slug ?? item.uid) : undefined}
      />
    );
  }, [isMobile, buildRouteTo, onHideTravel]);

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
      return <Text style={styles.endText}>Это всё поблизости ✨</Text>;
    }
    return null;
  }, [hasMore, isLoading, styles.endText, styles.loader, themeColors.primary]);

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
