/**
 * SkeletonList - Optimized FlatList with instant skeleton rendering
 * 
 * Features:
 * - Instant skeleton display while data loads
 * - Optimized FlatList with proper virtualization settings
 * - Smooth transition from skeleton to content
 * - Memoized item renderers for performance
 */
import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  FlatListProps,
  ListRenderItem,
  Platform,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SkeletonLoader } from './SkeletonLoader';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface SkeletonListProps<T> extends Omit<FlatListProps<T>, 'data' | 'renderItem'> {
  /** Data array - when undefined/null, shows skeleton */
  data: T[] | undefined | null;
  /** Render function for each item */
  renderItem: ListRenderItem<T>;
  /** Number of skeleton items to show while loading */
  skeletonCount?: number;
  /** Custom skeleton item renderer */
  renderSkeletonItem?: (index: number) => React.ReactNode;
  /** Skeleton item height for optimization */
  skeletonItemHeight?: number;
  /** Key extractor for items */
  keyExtractor: (item: T, index: number) => string;
  /** Container style */
  containerStyle?: ViewStyle;
  /** Is data loading? (alternative to checking data === undefined) */
  isLoading?: boolean;
  /** Test ID */
  testID?: string;
}

const DEFAULT_SKELETON_COUNT = 6;

type SkeletonItem = { __skeleton: true; index: number };

const SkeletonFlatList: React.FC<{
  count: number;
  renderItem: (index: number) => React.ReactNode;
  itemHeight: number;
  containerStyle?: ViewStyle;
  testID?: string;
}> = React.memo(({ count, renderItem, itemHeight, containerStyle, testID }) => {
  const data = useMemo(
    () => Array.from({ length: count }, (_, i) => ({ __skeleton: true as const, index: i })),
    [count]
  );

  const renderSkeletonItem: ListRenderItem<SkeletonItem> = useCallback(
    ({ item }) => <>{renderItem(item.index)}</>,
    [renderItem]
  );

  const keyExtractor = useCallback(
    (item: SkeletonItem) => `skeleton-${item.index}`,
    []
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: itemHeight,
      offset: itemHeight * index,
      index,
    }),
    [itemHeight]
  );

  return (
    <FlatList
      testID={testID}
      data={data}
      renderItem={renderSkeletonItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      contentContainerStyle={containerStyle}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
      initialNumToRender={count}
    />
  );
});

SkeletonFlatList.displayName = 'SkeletonFlatList';

function SkeletonListInner<T>(
  props: SkeletonListProps<T>,
  ref: React.ForwardedRef<FlatList<T>>
) {
  const {
    data,
    renderItem,
    skeletonCount = DEFAULT_SKELETON_COUNT,
    renderSkeletonItem,
    skeletonItemHeight = 200,
    keyExtractor,
    containerStyle,
    isLoading,
    testID,
    ...flatListProps
  } = props;

  const colors = useThemedColors();
  const isDataLoading = isLoading ?? !data;

  // Default skeleton item renderer
  const defaultSkeletonItem = useCallback(
    (_index: number) => (
      <View style={[styles.skeletonItem, { backgroundColor: colors.surface }]}>
        <SkeletonLoader
          width="100%"
          height={skeletonItemHeight * 0.6}
          borderRadius={DESIGN_TOKENS.radii.md}
        />
        <View style={styles.skeletonContent}>
          <SkeletonLoader width="80%" height={18} borderRadius={6} />
          <SkeletonLoader width="60%" height={14} borderRadius={4} style={styles.skeletonLine} />
          <SkeletonLoader width="40%" height={12} borderRadius={4} style={styles.skeletonLine} />
        </View>
      </View>
    ),
    [colors.surface, skeletonItemHeight]
  );

  const skeletonRenderer = renderSkeletonItem ?? defaultSkeletonItem;

  // Memoized item renderer wrapper for performance
  const memoizedRenderItem: ListRenderItem<T> = useCallback(
    (info) => renderItem(info),
    [renderItem]
  );

  // Optimized FlatList props
  const optimizedProps = useMemo(
    () => ({
      initialNumToRender: Platform.OS === 'web' ? 8 : 5,
      maxToRenderPerBatch: Platform.OS === 'web' ? 10 : 5,
      windowSize: Platform.OS === 'web' ? 11 : 7,
      removeClippedSubviews: Platform.OS !== 'web',
      updateCellsBatchingPeriod: 50,
      getItemLayout: skeletonItemHeight
        ? (_: ArrayLike<T> | null | undefined, index: number) => ({
            length: skeletonItemHeight,
            offset: skeletonItemHeight * index,
            index,
          })
        : undefined,
    }),
    [skeletonItemHeight]
  );

  if (isDataLoading) {
    return (
      <SkeletonFlatList
        testID={testID ? `${testID}-skeleton` : 'skeleton-list'}
        count={skeletonCount}
        renderItem={skeletonRenderer}
        itemHeight={skeletonItemHeight}
        containerStyle={containerStyle}
      />
    );
  }

  return (
    <FlatList
      ref={ref}
      testID={testID}
      data={data}
      renderItem={memoizedRenderItem}
      keyExtractor={keyExtractor}
      contentContainerStyle={containerStyle}
      showsVerticalScrollIndicator={false}
      {...optimizedProps}
      {...flatListProps}
    />
  );
}

export const SkeletonList = React.memo(
  React.forwardRef(SkeletonListInner)
) as <T>(
  props: SkeletonListProps<T> & { ref?: React.ForwardedRef<FlatList<T>> }
) => React.ReactElement;

/**
 * CardSkeleton - Reusable card skeleton for travel/article cards
 */
interface CardSkeletonProps {
  imageHeight?: number;
  showAvatar?: boolean;
  style?: ViewStyle;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = React.memo(({
  imageHeight = 180,
  showAvatar = false,
  style,
}) => {
  const colors = useThemedColors();

  return (
    <View style={[styles.cardSkeleton, { backgroundColor: colors.surface }, style]}>
      <SkeletonLoader
        width="100%"
        height={imageHeight}
        borderRadius={DESIGN_TOKENS.radii.md}
      />
      <View style={styles.cardContent}>
        {showAvatar && (
          <View style={styles.avatarRow}>
            <SkeletonLoader width={32} height={32} borderRadius={16} />
            <SkeletonLoader width="50%" height={14} borderRadius={4} style={styles.avatarName} />
          </View>
        )}
        <SkeletonLoader width="85%" height={18} borderRadius={6} />
        <SkeletonLoader width="65%" height={14} borderRadius={4} style={styles.cardLine} />
        <View style={styles.cardMeta}>
          <SkeletonLoader width={60} height={12} borderRadius={4} />
          <SkeletonLoader width={80} height={12} borderRadius={4} />
        </View>
      </View>
    </View>
  );
});

CardSkeleton.displayName = 'CardSkeleton';

/**
 * ListSkeleton - Simple skeleton list without FlatList
 */
interface ListSkeletonProps {
  count?: number;
  itemHeight?: number;
  renderItem?: (index: number) => React.ReactNode;
  horizontal?: boolean;
  gap?: number;
  style?: ViewStyle;
}

export const ListSkeleton: React.FC<ListSkeletonProps> = React.memo(({
  count = 3,
  itemHeight = 200,
  renderItem,
  horizontal = false,
  gap = DESIGN_TOKENS.spacing.md,
  style,
}) => {
  const defaultRenderer = useCallback(
    (_index: number) => <CardSkeleton imageHeight={itemHeight * 0.6} />,
    [itemHeight]
  );

  const renderer = renderItem ?? defaultRenderer;

  return (
    <View
      style={[
        styles.listSkeleton,
        horizontal && styles.listSkeletonHorizontal,
        { gap },
        style,
      ]}
    >
      {Array.from({ length: count }, (_, i) => (
        <React.Fragment key={i}>{renderer(i)}</React.Fragment>
      ))}
    </View>
  );
});

ListSkeleton.displayName = 'ListSkeleton';

const styles = StyleSheet.create({
  skeletonItem: {
    borderRadius: DESIGN_TOKENS.radii.lg,
    padding: DESIGN_TOKENS.spacing.md,
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  skeletonContent: {
    marginTop: DESIGN_TOKENS.spacing.md,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  skeletonLine: {
    marginTop: DESIGN_TOKENS.spacing.xs,
  },
  cardSkeleton: {
    borderRadius: DESIGN_TOKENS.radii.lg,
    overflow: 'hidden',
  },
  cardContent: {
    padding: DESIGN_TOKENS.spacing.md,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  avatarName: {
    marginLeft: DESIGN_TOKENS.spacing.sm,
  },
  cardLine: {
    marginTop: DESIGN_TOKENS.spacing.xs,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.md,
    marginTop: DESIGN_TOKENS.spacing.sm,
  },
  listSkeleton: {
    flexDirection: 'column',
  },
  listSkeletonHorizontal: {
    flexDirection: 'row',
  },
});

export default SkeletonList;
