import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';

export const TravelDetailPageSkeleton: React.FC = () => {
  const colors = useThemedColors();
  const { isMobile, isTablet } = useResponsive();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingBottom: DESIGN_TOKENS.spacing.xl,
    },
    heroSection: {
      width: '100%',
      height: isMobile ? 260 : isTablet ? 400 : 500,
      backgroundColor: colors.surfaceLight,
    },
    contentWrapper: {
      maxWidth: 1200,
      width: '100%',
      alignSelf: 'center',
      paddingHorizontal: isMobile ? DESIGN_TOKENS.spacing.md : DESIGN_TOKENS.spacing.lg,
    },
    headerSection: {
      marginTop: DESIGN_TOKENS.spacing.lg,
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.md,
      marginTop: DESIGN_TOKENS.spacing.sm,
      flexWrap: 'wrap',
    },
    descriptionSection: {
      marginTop: DESIGN_TOKENS.spacing.lg,
      padding: DESIGN_TOKENS.spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
    },
    descriptionLine: {
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    sectionContainer: {
      marginTop: DESIGN_TOKENS.spacing.xl,
    },
    sectionHeader: {
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    cardGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.md,
    },
    card: {
      width: isMobile ? '100%' : isTablet ? '48%' : '31%',
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      padding: DESIGN_TOKENS.spacing.md,
    },
    cardImage: {
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    mapSection: {
      marginTop: DESIGN_TOKENS.spacing.xl,
      height: 400,
      borderRadius: DESIGN_TOKENS.radii.lg,
      overflow: 'hidden',
    },
  }), [colors, isMobile, isTablet]);

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image Skeleton */}
        <SkeletonLoader 
          width="100%" 
          height={isMobile ? 260 : isTablet ? 400 : 500} 
          borderRadius={0}
        />

        <View style={styles.contentWrapper}>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <SkeletonLoader width="85%" height={isMobile ? 28 : 36} borderRadius={8} />
            <View style={styles.metaRow}>
              <SkeletonLoader width={100} height={20} borderRadius={12} />
              <SkeletonLoader width={80} height={20} borderRadius={12} />
              <SkeletonLoader width={120} height={20} borderRadius={12} />
            </View>
          </View>

          {/* Description Section */}
          <View style={styles.descriptionSection}>
            <SkeletonLoader width="40%" height={22} borderRadius={6} style={{ marginBottom: DESIGN_TOKENS.spacing.md }} />
            <SkeletonLoader width="100%" height={16} borderRadius={4} style={styles.descriptionLine} />
            <SkeletonLoader width="95%" height={16} borderRadius={4} style={styles.descriptionLine} />
            <SkeletonLoader width="98%" height={16} borderRadius={4} style={styles.descriptionLine} />
            <SkeletonLoader width="92%" height={16} borderRadius={4} style={styles.descriptionLine} />
            <SkeletonLoader width="88%" height={16} borderRadius={4} style={styles.descriptionLine} />
            <SkeletonLoader width="70%" height={16} borderRadius={4} />
          </View>

          {/* Gallery Section */}
          <View style={styles.sectionContainer}>
            <SkeletonLoader width="30%" height={24} borderRadius={6} style={styles.sectionHeader} />
            <View style={styles.cardGrid}>
              {Array.from({ length: isMobile ? 2 : isTablet ? 4 : 6 }).map((_, index) => (
                <View key={`gallery-${index}`} style={styles.card}>
                  <SkeletonLoader 
                    width="100%" 
                    height={isMobile ? 180 : 200} 
                    borderRadius={DESIGN_TOKENS.radii.md}
                    style={styles.cardImage}
                  />
                  <SkeletonLoader width="80%" height={14} borderRadius={4} />
                </View>
              ))}
            </View>
          </View>

          {/* Map Section */}
          <View style={styles.sectionContainer}>
            <SkeletonLoader width="25%" height={24} borderRadius={6} style={styles.sectionHeader} />
            <SkeletonLoader 
              width="100%" 
              height={400} 
              borderRadius={DESIGN_TOKENS.radii.lg}
            />
          </View>

          {/* Related Travels Section */}
          <View style={styles.sectionContainer}>
            <SkeletonLoader width="35%" height={24} borderRadius={6} style={styles.sectionHeader} />
            <View style={styles.cardGrid}>
              {Array.from({ length: 3 }).map((_, index) => (
                <View key={`related-${index}`} style={styles.card}>
                  <SkeletonLoader 
                    width="100%" 
                    height={160} 
                    borderRadius={DESIGN_TOKENS.radii.md}
                    style={styles.cardImage}
                  />
                  <SkeletonLoader width="90%" height={16} borderRadius={4} style={{ marginBottom: 6 }} />
                  <SkeletonLoader width="60%" height={14} borderRadius={4} />
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
