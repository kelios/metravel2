import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

export const MapPageSkeleton: React.FC = () => {
  const colors = useThemedColors();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    mapArea: {
      flex: 1,
      backgroundColor: colors.surfaceLight,
      position: 'relative',
    },
    headlineText: {
      position: 'absolute',
      left: DESIGN_TOKENS.spacing.lg,
      right: DESIGN_TOKENS.spacing.lg,
      top: DESIGN_TOKENS.spacing.lg,
      color: colors.text,
      fontSize: 24,
      fontWeight: '700',
      lineHeight: 30,
    },
    mapControls: {
      position: 'absolute',
      top: DESIGN_TOKENS.spacing.md,
      right: DESIGN_TOKENS.spacing.md,
      gap: DESIGN_TOKENS.spacing.sm,
      zIndex: 10,
    },
    placeholderText: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: DESIGN_TOKENS.spacing.lg,
      textAlign: 'center',
      color: colors.textMuted,
      fontSize: 16,
    },
    controlButton: {
      width: 44,
      height: 44,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.surface,
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.mapArea}>
        <SkeletonLoader width="100%" height={1} borderRadius={0} style={StyleSheet.absoluteFillObject} />
        <Text style={styles.headlineText}>{'Карта путешествий\nЗагружаем…'}</Text>
        <Text style={styles.placeholderText}>Загружаем карту…</Text>
        
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
