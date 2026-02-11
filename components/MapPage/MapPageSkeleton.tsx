import React, { useMemo } from 'react';
import { View, StyleSheet, Text, type DimensionValue } from 'react-native';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

const MARKER_POSITIONS: { top: DimensionValue; left: DimensionValue }[] = [
  { top: '25%', left: '30%' },
  { top: '40%', left: '55%' },
  { top: '35%', left: '70%' },
  { top: '55%', left: '40%' },
  { top: '60%', left: '65%' },
];

export const MapPageSkeleton: React.FC<{ inline?: boolean }> = ({ inline = false }) => {
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
    controlButton: {
      width: 44,
      height: 44,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.surface,
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    markerDot: {
      position: 'absolute',
      zIndex: 5,
    },
  }), [colors]);

  if (inline) {
    return (
      <View style={styles.mapArea}>
        <SkeletonLoader width="100%" height={1} borderRadius={0} style={StyleSheet.absoluteFillObject} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapArea}>
        <SkeletonLoader width="100%" height={1} borderRadius={0} style={StyleSheet.absoluteFillObject} />
        <Text style={styles.headlineText}>Карта путешествий</Text>

        {/* Pulsing marker placeholders */}
        {MARKER_POSITIONS.map((pos, i) => (
          <View key={i} style={[styles.markerDot, { top: pos.top, left: pos.left }]}>
            <SkeletonLoader width={20} height={20} borderRadius={10} />
          </View>
        ))}
        
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
