import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { METRICS } from '@/constants/layout';
import { useThemedColors } from '@/hooks/useTheme';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const TravelDetailPageSkeleton: React.FC = () => {
  const colors = useThemedColors();
  const { width, height } = useWindowDimensions();
  const isMobile = width < METRICS.breakpoints.tablet;
  const isTablet =
    width >= METRICS.breakpoints.tablet &&
    width < METRICS.breakpoints.largeTablet;
  const isDesktop = width >= METRICS.breakpoints.largeTablet;
  const desktopSidebarWidth = clamp(Math.round(width * 0.28), 320, 480);
  const desktopHeroHeight = clamp(Math.round(height * 0.7), 360, 750);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingBottom: DESIGN_TOKENS.spacing.xl,
    },
    contentWrapper: {
      maxWidth: 1600,
      width: '100%',
      alignSelf: 'center',
      paddingHorizontal: isMobile ? DESIGN_TOKENS.spacing.md : DESIGN_TOKENS.spacing.lg,
    },
    desktopShell: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: DESIGN_TOKENS.spacing.lg,
      marginTop: DESIGN_TOKENS.spacing.md,
    },
    desktopSidebar: {
      width: desktopSidebarWidth,
      flexShrink: 0,
    },
    sidebarCard: {
      padding: DESIGN_TOKENS.spacing.lg,
      borderRadius: DESIGN_TOKENS.radii.xl,
      backgroundColor: colors.surface,
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    sidebarAuthorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    sidebarAuthorMeta: {
      flex: 1,
      marginLeft: DESIGN_TOKENS.spacing.md,
      gap: DESIGN_TOKENS.spacing.sm,
    },
    sidebarActionColumn: {
      gap: DESIGN_TOKENS.spacing.sm,
      marginLeft: DESIGN_TOKENS.spacing.md,
    },
    sidebarSectionCard: {
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.xl,
      backgroundColor: colors.surface,
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    sidebarMenuLine: {
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    desktopMain: {
      flex: 1,
      minWidth: 0,
    },
    desktopHero: {
      width: '100%',
      height: desktopHeroHeight,
      borderRadius: DESIGN_TOKENS.radii.xl,
      overflow: 'hidden',
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    headerSection: {
      marginTop: isDesktop ? 0 : DESIGN_TOKENS.spacing.lg,
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
  }), [colors, desktopHeroHeight, desktopSidebarWidth, isDesktop, isMobile, isTablet]);

  if (isDesktop) {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentWrapper}>
            <View style={styles.desktopShell}>
              <View style={styles.desktopSidebar}>
                <View style={styles.sidebarCard}>
                  <View style={styles.sidebarAuthorRow}>
                    <SkeletonLoader width={56} height={56} borderRadius={28} />
                    <View style={styles.sidebarAuthorMeta}>
                      <SkeletonLoader width="58%" height={22} borderRadius={8} />
                      <SkeletonLoader width="72%" height={16} borderRadius={6} />
                    </View>
                    <View style={styles.sidebarActionColumn}>
                      <SkeletonLoader width={40} height={40} borderRadius={12} />
                      <SkeletonLoader width={40} height={40} borderRadius={12} />
                    </View>
                  </View>
                  <SkeletonLoader width="78%" height={44} borderRadius={22} />
                </View>

                <View style={styles.sidebarSectionCard}>
                  {Array.from({ length: 10 }).map((_, index) => (
                    <SkeletonLoader
                      key={`sidebar-line-${index}`}
                      width={index === 0 ? '100%' : index < 6 ? '72%' : '64%'}
                      height={index === 0 ? 44 : 18}
                      borderRadius={index === 0 ? 16 : 8}
                      style={styles.sidebarMenuLine}
                    />
                  ))}
                </View>

                <View style={styles.sidebarSectionCard}>
                  <SkeletonLoader width="88%" height={26} borderRadius={8} style={styles.sidebarMenuLine} />
                  <View style={[styles.metaRow, { marginTop: 0 }]}>
                    <SkeletonLoader width="28%" height={18} borderRadius={8} />
                    <SkeletonLoader width="28%" height={18} borderRadius={8} />
                    <SkeletonLoader width="28%" height={18} borderRadius={8} />
                  </View>
                </View>
              </View>

              <View style={styles.desktopMain}>
                <SkeletonLoader
                  width="100%"
                  height={desktopHeroHeight}
                  borderRadius={DESIGN_TOKENS.radii.xl}
                />

                <View style={styles.headerSection}>
                  <View style={styles.metaRow}>
                    <SkeletonLoader width={90} height={20} borderRadius={12} />
                    <SkeletonLoader width={90} height={20} borderRadius={12} />
                    <SkeletonLoader width={260} height={20} borderRadius={12} />
                  </View>
                  <View style={[styles.metaRow, { marginTop: DESIGN_TOKENS.spacing.md }]}>
                    <SkeletonLoader width={110} height={18} borderRadius={12} />
                    <SkeletonLoader width={90} height={18} borderRadius={12} />
                    <SkeletonLoader width={140} height={18} borderRadius={12} />
                    <SkeletonLoader width={110} height={18} borderRadius={12} />
                  </View>
                </View>

                <View style={styles.descriptionSection}>
                  <SkeletonLoader width="42%" height={22} borderRadius={6} style={{ marginBottom: DESIGN_TOKENS.spacing.md }} />
                  <SkeletonLoader width="100%" height={16} borderRadius={4} style={styles.descriptionLine} />
                  <SkeletonLoader width="96%" height={16} borderRadius={4} style={styles.descriptionLine} />
                  <SkeletonLoader width="98%" height={16} borderRadius={4} style={styles.descriptionLine} />
                  <SkeletonLoader width="90%" height={16} borderRadius={4} style={styles.descriptionLine} />
                  <SkeletonLoader width="84%" height={16} borderRadius={4} />
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SkeletonLoader
          width="100%"
          height={isMobile ? 260 : 400}
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
