import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SkeletonLoader, TravelCardSkeleton, FiltersSkeleton } from '@/components/SkeletonLoader';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';

export const SearchPageSkeleton: React.FC = () => {
  const colors = useThemedColors();
  const { isMobile, isTablet } = useResponsive();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      flexDirection: isMobile ? 'column' : 'row',
    },
    sidebar: {
      width: isMobile ? '100%' : 320,
      backgroundColor: colors.surface,
      borderRightWidth: isMobile ? 0 : 1,
      borderRightColor: colors.border,
      padding: DESIGN_TOKENS.spacing.lg,
    },
    sidebarMobile: {
      borderRightWidth: 0,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    mainContent: {
      flex: 1,
      padding: DESIGN_TOKENS.spacing.lg,
    },
    mainContentMobile: {
      padding: DESIGN_TOKENS.spacing.md,
    },
    header: {
      marginBottom: DESIGN_TOKENS.spacing.lg,
    },
    searchBar: {
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    filterChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.sm,
      marginBottom: DESIGN_TOKENS.spacing.lg,
    },
    resultsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.md,
    },
    cardWrapper: {
      width: isMobile ? '100%' : isTablet ? '48%' : '31%',
    },
  }), [colors, isMobile, isTablet]);

  return (
    <View style={styles.container}>
      {/* Sidebar with Filters */}
      <View style={[styles.sidebar, isMobile && styles.sidebarMobile]}>
        <SkeletonLoader 
          width="60%" 
          height={24} 
          borderRadius={6} 
          style={{ marginBottom: DESIGN_TOKENS.spacing.lg }} 
        />
        <FiltersSkeleton />
      </View>

      {/* Main Content Area */}
      <ScrollView 
        style={styles.mainContent}
        contentContainerStyle={isMobile && styles.mainContentMobile}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <SkeletonLoader width="40%" height={32} borderRadius={8} style={{ marginBottom: DESIGN_TOKENS.spacing.sm }} />
          <SkeletonLoader width="60%" height={16} borderRadius={4} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <SkeletonLoader width="100%" height={48} borderRadius={DESIGN_TOKENS.radii.lg} />
        </View>

        {/* Active Filter Chips */}
        <View style={styles.filterChips}>
          <SkeletonLoader width={100} height={32} borderRadius={16} />
          <SkeletonLoader width={120} height={32} borderRadius={16} />
          <SkeletonLoader width={90} height={32} borderRadius={16} />
        </View>

        {/* Results Header */}
        <View style={styles.resultsHeader}>
          <SkeletonLoader width={150} height={20} borderRadius={4} />
          <SkeletonLoader width={80} height={36} borderRadius={DESIGN_TOKENS.radii.md} />
        </View>

        {/* Travel Cards Grid */}
        <View style={styles.gridContainer}>
          {Array.from({ length: isMobile ? 4 : isTablet ? 6 : 9 }).map((_, index) => (
            <View key={`card-${index}`} style={styles.cardWrapper}>
              <TravelCardSkeleton />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export const SearchPageMobileSkeleton: React.FC = () => {
  const colors = useThemedColors();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      padding: DESIGN_TOKENS.spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    searchBar: {
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    filterButton: {
      marginTop: DESIGN_TOKENS.spacing.sm,
    },
    content: {
      padding: DESIGN_TOKENS.spacing.md,
    },
    resultsHeader: {
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      {/* Header with Search */}
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <SkeletonLoader width="100%" height={48} borderRadius={DESIGN_TOKENS.radii.lg} />
        </View>
        <View style={styles.filterButton}>
          <SkeletonLoader width="100%" height={44} borderRadius={DESIGN_TOKENS.radii.md} />
        </View>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.resultsHeader}>
          <SkeletonLoader width={120} height={20} borderRadius={4} />
        </View>

        {Array.from({ length: 5 }).map((_, index) => (
          <TravelCardSkeleton key={`mobile-card-${index}`} />
        ))}
      </ScrollView>
    </View>
  );
};
