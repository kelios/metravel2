import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';

export const MapPageSkeleton: React.FC = () => {
  const colors = useThemedColors();
  const { isMobile } = useResponsive();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      flexDirection: isMobile ? 'column' : 'row',
    },
    mapArea: {
      flex: 1,
      backgroundColor: colors.surfaceLight,
      position: 'relative',
    },
    mapControls: {
      position: 'absolute',
      top: DESIGN_TOKENS.spacing.md,
      right: DESIGN_TOKENS.spacing.md,
      gap: DESIGN_TOKENS.spacing.sm,
      zIndex: 10,
    },
    controlButton: {
      width: 44,
      height: 44,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.surface,
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    sidePanel: {
      width: isMobile ? '100%' : 380,
      backgroundColor: colors.surface,
      borderLeftWidth: isMobile ? 0 : 1,
      borderLeftColor: colors.border,
      flexShrink: 0,
    },
    panelHeader: {
      padding: DESIGN_TOKENS.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.md,
    },
    panelContent: {
      padding: DESIGN_TOKENS.spacing.md,
    },
    filterSection: {
      marginBottom: DESIGN_TOKENS.spacing.lg,
    },
    filterLabel: {
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    listItem: {
      flexDirection: 'row',
      padding: DESIGN_TOKENS.spacing.md,
      backgroundColor: colors.background,
      borderRadius: DESIGN_TOKENS.radii.md,
      marginBottom: DESIGN_TOKENS.spacing.sm,
      gap: DESIGN_TOKENS.spacing.md,
    },
    listItemContent: {
      flex: 1,
      gap: DESIGN_TOKENS.spacing.xs,
    },
  }), [colors, isMobile]);

  return (
    <View style={styles.container}>
      <View style={styles.mapArea}>
        <SkeletonLoader width="100%" height={600} borderRadius={0} />
        
        <View style={styles.mapControls}>
          <View style={styles.controlButton}>
            <SkeletonLoader width={44} height={44} borderRadius={DESIGN_TOKENS.radii.md} />
          </View>
          <View style={styles.controlButton}>
            <SkeletonLoader width={44} height={44} borderRadius={DESIGN_TOKENS.radii.md} />
          </View>
          <View style={styles.controlButton}>
            <SkeletonLoader width={44} height={44} borderRadius={DESIGN_TOKENS.radii.md} />
          </View>
        </View>
      </View>

      <View style={styles.sidePanel}>
        <View style={styles.panelHeader}>
          <SkeletonLoader width={100} height={36} borderRadius={DESIGN_TOKENS.radii.md} />
          <SkeletonLoader width={100} height={36} borderRadius={DESIGN_TOKENS.radii.md} />
        </View>

        <View style={styles.panelContent}>
          <View style={styles.filterSection}>
            <SkeletonLoader width="40%" height={18} borderRadius={4} style={styles.filterLabel} />
            <SkeletonLoader width="100%" height={44} borderRadius={DESIGN_TOKENS.radii.md} />
          </View>

          <View style={styles.filterSection}>
            <SkeletonLoader width="35%" height={18} borderRadius={4} style={styles.filterLabel} />
            <SkeletonLoader width="100%" height={44} borderRadius={DESIGN_TOKENS.radii.md} />
          </View>

          <View style={styles.filterSection}>
            <SkeletonLoader width="45%" height={18} borderRadius={4} style={styles.filterLabel} />
            <View style={{ flexDirection: 'row', gap: DESIGN_TOKENS.spacing.sm, flexWrap: 'wrap' }}>
              <SkeletonLoader width={80} height={32} borderRadius={16} />
              <SkeletonLoader width={100} height={32} borderRadius={16} />
              <SkeletonLoader width={90} height={32} borderRadius={16} />
              <SkeletonLoader width={110} height={32} borderRadius={16} />
            </View>
          </View>

          <View style={{ marginTop: DESIGN_TOKENS.spacing.lg }}>
            {Array.from({ length: 4 }).map((_, index) => (
              <View key={`list-item-${index}`} style={styles.listItem}>
                <SkeletonLoader 
                  width={80} 
                  height={80} 
                  borderRadius={DESIGN_TOKENS.radii.sm}
                />
                <View style={styles.listItemContent}>
                  <SkeletonLoader width="90%" height={16} borderRadius={4} />
                  <SkeletonLoader width="70%" height={14} borderRadius={4} />
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

export const MapMobileSkeleton: React.FC = () => {
  const colors = useThemedColors();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    mapArea: {
      height: '60%',
      backgroundColor: colors.surfaceLight,
    },
    bottomSheet: {
      height: '40%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: DESIGN_TOKENS.radii.xl,
      borderTopRightRadius: DESIGN_TOKENS.radii.xl,
      padding: DESIGN_TOKENS.spacing.md,
    },
    dragHandle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    filterButton: {
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.mapArea}>
        <SkeletonLoader width="100%" height={400} borderRadius={0} />
      </View>

      <View style={styles.bottomSheet}>
        <View style={styles.dragHandle} />
        <SkeletonLoader 
          width="100%" 
          height={48} 
          borderRadius={DESIGN_TOKENS.radii.md}
          style={styles.filterButton}
        />
        <SkeletonLoader width="60%" height={20} borderRadius={4} style={{ marginBottom: DESIGN_TOKENS.spacing.sm }} />
        <SkeletonLoader width="100%" height={100} borderRadius={DESIGN_TOKENS.radii.md} />
      </View>
    </View>
  );
};
