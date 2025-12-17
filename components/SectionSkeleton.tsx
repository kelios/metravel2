import React from 'react';
import { View, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import ReservedSpace from '@/components/ReservedSpace';

interface SectionSkeletonProps {
  lines?: number;
  height?: number;
}

export function SectionSkeleton({ lines = 3, height = 20 }: SectionSkeletonProps) {
  const lineH = height || 20;
  const totalH = lines * lineH + Math.max(0, lines - 1) * DESIGN_TOKENS.spacing.sm;
  return (
    <View style={styles.container}>
      <ReservedSpace testID="section-skeleton-reserved" height={totalH} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: DESIGN_TOKENS.spacing.md,
  },
});
