import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SkeletonLoader, TravelCardSkeleton, FiltersSkeleton } from '@/components/ui/SkeletonLoader';
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
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      paddingTop: DESIGN_TOKENS.spacing.lg,
      paddingBottom: DESIGN_TOKENS.spacing.lg,
    },
    mainContentMobile: {
      padding: DESIGN_TOKENS.spacing.md,
    },
    searchHeader: {
      minHeight: isMobile ? 56 : 76,
      marginBottom: DESIGN_TOKENS.spacing.md,
      paddingHorizontal: isMobile ? 0 : DESIGN_TOKENS.spacing.lg,
    },
    searchHeaderCard: {
      minHeight: isMobile ? 48 : 60,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      justifyContent: 'center',
    },
    searchHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    searchInputSkeleton: {
      flex: 1,
      minWidth: 0,
    },
    cardsScrollArea: {
      flex: 1,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      paddingTop: 8,
      paddingBottom: 28,
    },
    cardsScrollAreaMobile: {
      paddingHorizontal: 0,
    },
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.md,
      alignItems: 'flex-start',
    },
    cardWrapper: {
      width: isMobile ? '100%' : isTablet ? '48%' : '31%',
    },
    filterRow: {
      marginTop: DESIGN_TOKENS.spacing.md,
    },
  }), [colors, isMobile, isTablet]);

  if (!isMobile) {
    return (
      <View style={styles.container}>
        <View style={styles.sidebar}>
          <SkeletonLoader width="40%" height={24} borderRadius={8} />
          {Array.from({ length: 9 }).map((_, index) => (
            <View key={`filter-row-${index}`} style={styles.filterRow}>
              <SkeletonLoader width="100%" height={44} borderRadius={16} />
            </View>
          ))}
        </View>

        <View style={styles.mainContent}>
          <View style={styles.searchHeader}>
            <View style={styles.searchHeaderCard}>
              <View style={styles.searchHeaderRow}>
                <SkeletonLoader
                  width="100%"
                  height={48}
                  borderRadius={DESIGN_TOKENS.radii.pill}
                  style={styles.searchInputSkeleton}
                />
                <SkeletonLoader width={216} height={48} borderRadius={DESIGN_TOKENS.radii.pill} />
                <SkeletonLoader width={52} height={48} borderRadius={DESIGN_TOKENS.radii.pill} />
              </View>
            </View>
          </View>

          <ScrollView style={styles.cardsScrollArea} showsVerticalScrollIndicator={false}>
            <View style={styles.gridContainer}>
              {Array.from({ length: isTablet ? 6 : 9 }).map((_, index) => (
                <View key={`card-${index}`} style={styles.cardWrapper}>
                  <TravelCardSkeleton />
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.sidebar, isMobile && styles.sidebarMobile]}>
        <FiltersSkeleton />
      </View>

      <ScrollView 
        style={styles.mainContent}
        contentContainerStyle={isMobile && styles.mainContentMobile}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.searchHeader, styles.cardsScrollAreaMobile]}>
          <View style={styles.searchHeaderCard}>
            <View style={styles.searchHeaderRow}>
              <SkeletonLoader
                width="100%"
                height={44}
                borderRadius={DESIGN_TOKENS.radii.pill}
                style={styles.searchInputSkeleton}
              />
              <SkeletonLoader width={44} height={44} borderRadius={DESIGN_TOKENS.radii.md} />
            </View>
          </View>
        </View>

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
