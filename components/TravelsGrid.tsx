import React, { memo, useCallback, useMemo } from 'react';
import { FlatList, View, StyleSheet, ViewStyle } from 'react-native';
import { useResponsiveColumns } from '@/hooks/useResponsive';
import { getSpacing } from '@/constants/layout';
import { useOptimizedList } from '@/src/hooks/useOptimizedList';

interface TravelsGridProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
  numColumns?: number | 'responsive';
  itemMinWidth?: number;
  contentContainerStyle?: ViewStyle;
  columnWrapperStyle?: ViewStyle;
  ListEmptyComponent?: React.ComponentType<any> | React.ReactElement | null;
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  loading?: boolean;
  LoadingComponent?: React.ComponentType<any> | React.ReactElement | null;
}

const DEFAULT_COLUMNS = {
  smallPhone: 1,
  phone: 1,
  largePhone: 1,
  tablet: 2,
  largeTablet: 2,
  desktop: 3,
  default: 1,
};

const DEFAULT_ITEM_MIN_WIDTH = 280;

function TravelsGridComponent<T>({
  data,
  renderItem,
  keyExtractor,
  numColumns = 'responsive',
  itemMinWidth = DEFAULT_ITEM_MIN_WIDTH,
  contentContainerStyle,
  columnWrapperStyle,
  ListEmptyComponent = null,
  ListHeaderComponent = null,
  ListFooterComponent = null,
  onEndReached,
  onEndReachedThreshold = 0.5,
  refreshing = false,
  onRefresh,
  loading = false,
  LoadingComponent = null,
}: TravelsGridProps<T>) {
  // Responsive columns based on screen size
  const responsiveColumns = useResponsiveColumns({
    ...DEFAULT_COLUMNS,
    ...(numColumns !== 'responsive' ? { default: numColumns } : {}),
  });

  const columns = numColumns === 'responsive' ? responsiveColumns : numColumns;

  const itemContainerStyle = useMemo(() => {
    const percent = `${100 / columns}%`;
    return [
      styles.itemContainer,
      {
        minWidth: itemMinWidth,
        flexBasis: percent as any,
        maxWidth: percent as any,
        width: percent as any,
      },
    ];
  }, [columns, itemMinWidth]);

  // Group items into rows for the grid
  const rows = useMemo(() => {
    const result = [];
    
    for (let i = 0; i < data.length; i += columns) {
      result.push(data.slice(i, i + columns));
    }
    
    return result;
  }, [data, columns]);

  // Render each row of the grid
  const renderRow = useCallback(({ item: rowItems, index: rowIndex }: { item: T[], index: number }) => {
    return (
      <View style={[styles.row, columnWrapperStyle]}>
        {rowItems.map((item, itemIndex) => (
          <View 
            key={`item-${keyExtractor(item)}`}
            style={itemContainerStyle}
          >
            {renderItem(item, rowIndex * columns + itemIndex)}
          </View>
        ))}
        
        {/* Fill remaining space in the last row if needed */}
        {rowItems.length < columns &&
          Array(columns - rowItems.length)
            .fill(null)
            .map((_, i) => (
              <View
                key={`spacer-${rowIndex}-${i}`}
                style={itemContainerStyle}
              />
            ))}
      </View>
    );
  }, [renderItem, keyExtractor, columns, columnWrapperStyle, itemContainerStyle]);

  // Memoize the list key to prevent unnecessary re-renders
  const listKey = useMemo(() => `travels-grid-${rows.length}-${columns}`, [rows.length, columns]);

  const listOptimizations = useOptimizedList(rows.length, {
    initialNumToRender: 4,
    maxToRenderPerBatch: 5,
    updateCellsBatchingPeriod: 50,
    windowSize: 5,
  });

  // Show loading state if needed
  if (loading && LoadingComponent) {
    return (
      <View style={[styles.container, contentContainerStyle]}>
        {typeof LoadingComponent === 'function' ? <LoadingComponent /> : LoadingComponent}
      </View>
    );
  }

  // Show empty state if no data
  if (!data.length && ListEmptyComponent) {
    return (
      <View style={[styles.container, contentContainerStyle]}>
        {typeof ListEmptyComponent === 'function' ? <ListEmptyComponent /> : ListEmptyComponent}
      </View>
    );
  }

  return (
    <View style={[styles.container, contentContainerStyle]}>
      <FlatList
        data={rows}
        renderItem={renderRow}
        keyExtractor={(_, index) => `row-${index}`}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={ListFooterComponent}
        onEndReached={onEndReached}
        onEndReachedThreshold={onEndReachedThreshold}
        refreshing={refreshing}
        onRefresh={onRefresh}
        removeClippedSubviews={false}
        initialNumToRender={listOptimizations.initialNumToRender}
        maxToRenderPerBatch={listOptimizations.maxToRenderPerBatch}
        updateCellsBatchingPeriod={listOptimizations.updateCellsBatchingPeriod}
        windowSize={listOptimizations.windowSize}
        key={listKey}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  listContent: {
    padding: getSpacing('xs'),
  },
  row: {
    flexDirection: 'row',
    marginBottom: getSpacing('xs'),
  },
  itemContainer: {
    flexGrow: 0,
    flexShrink: 0,
    padding: 2,
  },
});

// Memoize the component to prevent unnecessary re-renders
export const TravelsGrid = memo(TravelsGridComponent) as typeof TravelsGridComponent;
