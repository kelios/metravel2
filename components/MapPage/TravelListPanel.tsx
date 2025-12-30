import React, { useCallback, useMemo } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, Platform, RefreshControl } from 'react-native';
import { Text } from 'react-native-paper';
import AddressListItem from './AddressListItem';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

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
  }, [isLoading, hasMore]);

  return (
    <FlatList
      data={travelsData}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (hasMore && onLoadMore) onLoadMore();
      }}
      ListFooterComponent={footer}
      initialNumToRender={isMobile ? 10 : 12}
      maxToRenderPerBatch={isMobile ? 10 : 12}
      windowSize={11}
      removeClippedSubviews={Platform.OS !== 'web'}
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

const styles = StyleSheet.create({
  list: { paddingBottom: 8 },
  loader: { paddingVertical: 16, alignItems: 'center' },
  endText: { textAlign: 'center', color: DESIGN_TOKENS.colors.textMuted, paddingVertical: 16, fontSize: 12 },
});
