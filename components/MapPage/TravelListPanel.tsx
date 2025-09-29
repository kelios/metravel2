import React, { useCallback, useMemo } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import AddressListItem from './AddressListItem';

type Props = {
  travelsData: any[];
  buildRouteTo: (item: any) => void;

  onHideTravel?: (id: string | number) => void;
  hiddenIds?: (string | number)[];
  onResetHidden?: () => void;

  isMobile?: boolean;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;

  onClosePanel?: () => void;
};

const TravelListPanel: React.FC<Props> = ({
                                            travelsData,
                                            buildRouteTo,

                                            onHideTravel,
                                            hiddenIds,
                                            onResetHidden,

                                            isMobile = false,
                                            isLoading = false,
                                            hasMore = false,
                                            onLoadMore,
                                          }) => {
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
          <ActivityIndicator size="small" />
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
    />
  );
};

export default React.memo(TravelListPanel);

const styles = StyleSheet.create({
  list: { paddingBottom: 16 },
  loader: { paddingVertical: 16, alignItems: 'center' },
  endText: { textAlign: 'center', color: '#777', paddingVertical: 16, fontSize: 12 },
});
