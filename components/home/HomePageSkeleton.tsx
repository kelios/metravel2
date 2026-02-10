import React, { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';

export const HomePageSkeleton: React.FC = () => {
  const colors = useThemedColors();
  const { isSmallPhone, isPhone } = useResponsive();
  const isMobile = isSmallPhone || isPhone;

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      ...Platform.select({
        web: { minHeight: '100vh' } as any,
      }),
    },
    hero: {
      paddingVertical: isMobile ? 40 : 56,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'flex-start' : 'center',
      gap: isMobile ? 24 : 60,
      maxWidth: 1200,
      alignSelf: 'center',
      width: '100%',
    },
    heroText: {
      flex: 1,
      gap: 16,
    },
    heroImage: {
      display: isMobile ? 'none' : 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    heroButtons: {
      flexDirection: isMobile ? 'column' : 'row',
      gap: isMobile ? 12 : 16,
      marginTop: 16,
      width: '100%',
    },
    trustBlock: {
      paddingVertical: 40,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      maxWidth: 1200,
      alignSelf: 'center',
      width: '100%',
    },
    trustCard: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      flexDirection: isMobile ? 'column' : 'row',
      gap: 16,
    },
    trustItem: {
      flex: isMobile ? undefined : 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    howItWorks: {
      paddingVertical: 64,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      maxWidth: 1200,
      alignSelf: 'center',
      width: '100%',
    },
    stepsRow: {
      flexDirection: isMobile ? 'column' : 'row',
      gap: isMobile ? 20 : 24,
      marginTop: 40,
    },
    stepCard: {
      flex: isMobile ? undefined : 1,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 28,
      gap: 16,
    },
    inspiration: {
      paddingVertical: 72,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      backgroundColor: colors.backgroundSecondary,
      maxWidth: 1200,
      alignSelf: 'center',
      width: '100%',
    },
    inspirationFull: {
      paddingVertical: 72,
      backgroundColor: colors.backgroundSecondary,
      width: '100%',
    },
    cardsRow: {
      flexDirection: isMobile ? 'column' : 'row',
      gap: 20,
      marginTop: 24,
    },
    card: {
      flex: isMobile ? undefined : 1,
      borderRadius: DESIGN_TOKENS.radii.lg,
      overflow: 'hidden',
    },
  }), [colors, isMobile]);

  return (
    <View style={styles.container}>
      {/* Hero skeleton */}
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <SkeletonLoader width={isMobile ? '90%' : '80%'} height={isMobile ? 32 : 48} borderRadius={8} />
          <SkeletonLoader width="70%" height={20} borderRadius={6} />
          <SkeletonLoader width="55%" height={20} borderRadius={6} />
          <View style={styles.heroButtons}>
            <SkeletonLoader width={isMobile ? '100%' : 200} height={56} borderRadius={DESIGN_TOKENS.radii.lg} />
            <SkeletonLoader width={isMobile ? '100%' : 220} height={56} borderRadius={DESIGN_TOKENS.radii.lg} />
          </View>
        </View>
        {!isMobile && (
          <View style={styles.heroImage}>
            <SkeletonLoader width={320} height={400} borderRadius={DESIGN_TOKENS.radii.lg} />
          </View>
        )}
      </View>

      {/* Trust block skeleton */}
      <View style={styles.trustBlock}>
        <View style={styles.trustCard}>
          {Array.from({ length: 3 }).map((_, i) => (
            <View key={i} style={styles.trustItem}>
              <SkeletonLoader width={34} height={34} borderRadius={10} />
              <View style={{ flex: 1, gap: 4 }}>
                <SkeletonLoader width="60%" height={14} borderRadius={4} />
                <SkeletonLoader width="80%" height={12} borderRadius={4} />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* How it works skeleton */}
      <View style={styles.howItWorks}>
        <SkeletonLoader width={isMobile ? 180 : 260} height={isMobile ? 28 : 36} borderRadius={8} style={{ alignSelf: 'center' }} />
        <View style={styles.stepsRow}>
          {Array.from({ length: 3 }).map((_, i) => (
            <View key={i} style={styles.stepCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <SkeletonLoader width={56} height={56} borderRadius={DESIGN_TOKENS.radii.md} />
                <SkeletonLoader width={36} height={36} borderRadius={18} />
              </View>
              <SkeletonLoader width="70%" height={20} borderRadius={6} />
              <SkeletonLoader width="90%" height={14} borderRadius={4} />
            </View>
          ))}
        </View>
      </View>

      {/* Inspiration section skeleton */}
      <View style={styles.inspirationFull}>
        <View style={[styles.inspiration, { alignSelf: 'center' }]}>
          <SkeletonLoader width={isMobile ? 200 : 300} height={isMobile ? 28 : 36} borderRadius={8} />
          <SkeletonLoader width={isMobile ? 160 : 240} height={16} borderRadius={4} style={{ marginTop: 8 }} />
          <View style={styles.cardsRow}>
            {Array.from({ length: isMobile ? 2 : 3 }).map((_, i) => (
              <View key={i} style={styles.card}>
                <SkeletonLoader width="100%" height={200} borderRadius={DESIGN_TOKENS.radii.lg} />
                <View style={{ padding: 12, gap: 8 }}>
                  <SkeletonLoader width="80%" height={16} borderRadius={4} />
                  <SkeletonLoader width="50%" height={12} borderRadius={4} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

export default React.memo(HomePageSkeleton);
