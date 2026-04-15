 /**
 * SearchPageSkeleton - YouTube-style instant skeleton for search page
 * 
 * Key features:
 * - Renders instantly on first paint (no delays)
 * - Web sidebar navigation sections remain accessible
 * - Shimmer animation for visual feedback
 * - Responsive layout matching actual content
 * - No layout shifts during transition
 */
import React, { memo, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Platform, Text, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { SkeletonLoader, TravelCardSkeleton } from '@/components/ui/SkeletonLoader';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { BREAKPOINTS } from './utils/listTravelConstants';

/** Filter section navigation items for web sidebar */
const FILTER_SECTIONS = [
  { key: 'sort', title: 'Сортировка', icon: 'sliders' },
  { key: 'categories', title: 'Категории', icon: 'grid' },
  { key: 'transports', title: 'Транспорт', icon: 'truck' },
  { key: 'categoryTravelAddress', title: 'Объекты', icon: 'map-pin' },
  { key: 'companions', title: 'Спутники', icon: 'users' },
  { key: 'complexity', title: 'Сложность', icon: 'activity' },
  { key: 'month', title: 'Месяц', icon: 'calendar' },
  { key: 'over_nights_stay', title: 'Ночлег', icon: 'moon' },
] as const;

interface SidebarSkeletonProps {
  colors: ReturnType<typeof useThemedColors>;
  /** If true, render interactive navigation sections instead of pure skeleton */
  showNavigation?: boolean;
  /** Callback when section is clicked (for scroll-to-section) */
  onSectionPress?: (sectionKey: string) => void;
}

/** Sidebar skeleton with optional interactive navigation */
const SidebarSkeleton = memo<SidebarSkeletonProps>(({ colors, showNavigation = true, onSectionPress }) => {
  const styles = useMemo(() => StyleSheet.create({
    container: {
      width: 320,
      backgroundColor: colors.surface,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      paddingTop: DESIGN_TOKENS.spacing.lg,
      paddingBottom: DESIGN_TOKENS.spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    headerTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.text,
    },
    sectionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      marginBottom: DESIGN_TOKENS.spacing.xs,
      gap: DESIGN_TOKENS.spacing.sm,
    },
    sectionItemHover: Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.15s ease',
      } as any,
      default: {},
    }),
    sectionIcon: {
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      flex: 1,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textSecondary,
    },
    sectionChevron: {
      opacity: 0.5,
    },
    skeletonRow: {
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginVertical: DESIGN_TOKENS.spacing.md,
    },
  }), [colors]);

  if (!showNavigation) {
    return (
      <View style={styles.container}>
        <SkeletonLoader width="40%" height={24} borderRadius={8} />
        {Array.from({ length: 9 }).map((_, index) => (
          <View key={`filter-skeleton-${index}`} style={styles.skeletonRow}>
            <SkeletonLoader width="100%" height={44} borderRadius={DESIGN_TOKENS.radii.md} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Фильтры</Text>
        <SkeletonLoader width={80} height={20} borderRadius={4} />
      </View>

      <View style={styles.divider} />

      {FILTER_SECTIONS.map((section) => (
        <Pressable
          key={section.key}
          style={({ pressed }) => [
            styles.sectionItem,
            styles.sectionItemHover,
            pressed && { backgroundColor: colors.surfaceLight },
          ]}
          onPress={() => onSectionPress?.(section.key)}
          accessibilityRole="button"
          accessibilityLabel={`Перейти к фильтру: ${section.title}`}
        >
          <View style={styles.sectionIcon}>
            <Feather name={section.icon as any} size={16} color={colors.textMuted} />
          </View>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Feather
            name="chevron-down"
            size={14}
            color={colors.textMuted}
            style={styles.sectionChevron}
          />
        </Pressable>
      ))}

      <View style={styles.divider} />

      {/* Year filter skeleton */}
      <View style={styles.skeletonRow}>
        <SkeletonLoader width="100%" height={40} borderRadius={DESIGN_TOKENS.radii.md} />
      </View>
    </View>
  );
});

SidebarSkeleton.displayName = 'SidebarSkeleton';

/** Search header skeleton */
const SearchHeaderSkeleton = memo<{ colors: ReturnType<typeof useThemedColors>; isMobile: boolean }>(({ colors, isMobile }) => {
  const styles = useMemo(() => StyleSheet.create({
    container: {
      minHeight: isMobile ? 56 : 76,
      marginBottom: DESIGN_TOKENS.spacing.md,
      paddingHorizontal: isMobile ? DESIGN_TOKENS.spacing.sm : DESIGN_TOKENS.spacing.lg,
    },
    card: {
      minHeight: isMobile ? 48 : 60,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      justifyContent: 'center',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
    },
  }), [colors, isMobile]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.row}>
          <SkeletonLoader
            width="100%"
            height={isMobile ? 44 : 48}
            borderRadius={DESIGN_TOKENS.radii.pill}
            style={styles.searchInput}
          />
          {!isMobile && (
            <>
              <SkeletonLoader width={180} height={48} borderRadius={DESIGN_TOKENS.radii.pill} />
              <SkeletonLoader width={48} height={48} borderRadius={DESIGN_TOKENS.radii.pill} />
            </>
          )}
          {isMobile && (
            <SkeletonLoader width={44} height={44} borderRadius={DESIGN_TOKENS.radii.md} />
          )}
        </View>
      </View>
    </View>
  );
});

SearchHeaderSkeleton.displayName = 'SearchHeaderSkeleton';

/** Cards grid skeleton */
const CardsGridSkeleton = memo<{ 
  count: number;
  columns: number;
  isMobile: boolean;
}>(({ count, columns, isMobile }) => {
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.md,
      alignItems: 'flex-start',
      paddingHorizontal: isMobile ? DESIGN_TOKENS.spacing.sm : DESIGN_TOKENS.spacing.lg,
      paddingTop: DESIGN_TOKENS.spacing.sm,
      paddingBottom: DESIGN_TOKENS.spacing.xl,
    },
    cardWrapper: {
      width: columns === 1 ? '100%' : `${Math.floor(100 / columns) - 2}%`,
      ...(Platform.OS === 'web' && columns > 1 ? {
        flexBasis: `calc((100% - ${(columns - 1) * DESIGN_TOKENS.spacing.md}px) / ${columns})`,
        flexGrow: 0,
        flexShrink: 0,
      } as any : {}),
    },
  }), [columns, isMobile]);

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={`card-skeleton-${index}`} style={styles.cardWrapper}>
          <TravelCardSkeleton />
        </View>
      ))}
    </View>
  );
});

CardsGridSkeleton.displayName = 'CardsGridSkeleton';

export interface SearchPageSkeletonProps {
  /** Show interactive navigation in sidebar (default: true on web) */
  showSidebarNavigation?: boolean;
  /** Callback when sidebar section is clicked */
  onSectionPress?: (sectionKey: string) => void;
}

/**
 * Main search page skeleton - renders instantly on mount
 * Shows accessible sidebar navigation on web while content loads
 */
export const SearchPageSkeleton = memo<SearchPageSkeletonProps>(({ 
  showSidebarNavigation = Platform.OS === 'web',
  onSectionPress,
}) => {
  const colors = useThemedColors();
  const { width: responsiveWidth } = useResponsive();
  // Use the same breakpoints as listTravelBaseModel to avoid layout shift
  const viewportWidth =
    Platform.OS === 'web' && typeof window !== 'undefined' ? window.innerWidth : responsiveWidth;
  const isMobile = viewportWidth < BREAKPOINTS.TABLET; // 1024 — matches isMobileDevice
  const isTablet = viewportWidth >= BREAKPOINTS.TABLET && viewportWidth < BREAKPOINTS.DESKTOP;

  const cardCount = useMemo(() => {
    if (isMobile) return 4;
    if (isTablet) return 6;
    return 9;
  }, [isMobile, isTablet]);

  const columns = useMemo(() => {
    if (isMobile) return 1;
    if (isTablet) return 2;
    return 3;
  }, [isMobile, isTablet]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      flexDirection: isMobile ? 'column' : 'row',
    },
    mainContent: {
      flex: 1,
      minWidth: 0,
    },
    scrollArea: {
      flex: 1,
    },
  }), [colors, isMobile]);

  // Desktop/Tablet layout with sidebar
  if (!isMobile) {
    return (
      <View style={styles.container} testID="search-skeleton">
        <SidebarSkeleton 
          colors={colors} 
          showNavigation={showSidebarNavigation}
          onSectionPress={onSectionPress}
        />
        <View style={styles.mainContent}>
          <SearchHeaderSkeleton colors={colors} isMobile={false} />
          <ScrollView 
            style={styles.scrollArea} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            <CardsGridSkeleton 
              count={cardCount}
              columns={columns}
              isMobile={false}
            />
          </ScrollView>
        </View>
      </View>
    );
  }

  // Mobile layout
  return (
    <View style={styles.container} testID="search-skeleton-mobile">
      <SearchHeaderSkeleton colors={colors} isMobile={true} />
      <ScrollView 
        style={styles.scrollArea}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
      >
        <CardsGridSkeleton 
          count={cardCount}
          columns={1}
          isMobile={true}
        />
      </ScrollView>
    </View>
  );
});

SearchPageSkeleton.displayName = 'SearchPageSkeleton';

