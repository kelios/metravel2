import React from 'react';
import { View, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface SectionSkeletonProps {
  lines?: number;
  height?: number;
}

export function SectionSkeleton({ lines = 3, height = 20 }: SectionSkeletonProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: lines }).map((_, index) => (
        <View 
          key={index} 
          style={[
            styles.skeletonLine,
            { height: height || 20 },
            index === lines - 1 && { width: '60%' }
          ]} 
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: DESIGN_TOKENS.spacing.md,
  },
  skeletonLine: {
    width: '100%',
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
});
