import React, { useMemo } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions, type DimensionValue } from 'react-native';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { METRICS } from '@/constants/layout';

const MARKER_POSITIONS: { top: DimensionValue; left: DimensionValue }[] = [
  { top: '25%', left: '30%' },
  { top: '40%', left: '55%' },
  { top: '35%', left: '70%' },
  { top: '55%', left: '40%' },
  { top: '60%', left: '65%' },
];

export const MapPageSkeleton: React.FC<{ inline?: boolean }> = ({ inline = false }) => {
  const colors = useThemedColors();
  const { width } = useWindowDimensions();
  const isMobile = width < METRICS.breakpoints.tablet;

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      ...(Platform.OS === 'web' && !isMobile
        ? ({ flexDirection: 'row-reverse' } as any)
        : null),
    },
    mapArea: {
      flex: 1,
      backgroundColor: colors.surfaceLight,
      position: 'relative',
    },
    chipsRow: {
      position: 'absolute',
      top: 10,
      left: 10,
      right: 10,
      flexDirection: 'row',
      gap: 6,
    },
    mapControls: {
      position: 'absolute',
      top: DESIGN_TOKENS.spacing.md,
      right: DESIGN_TOKENS.spacing.md,
      gap: DESIGN_TOKENS.spacing.sm,
      zIndex: 10,
    },
    controlButton: {
      width: 36,
      height: 36,
      borderRadius: DESIGN_TOKENS.radii.md,
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    markerDot: {
      position: 'absolute',
      zIndex: 5,
    },
    // Desktop side panel skeleton
    sidePanel: {
      width: 340,
      flexShrink: 0,
      backgroundColor: colors.surface,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.borderLight,
      paddingTop: 0,
    },
    sidePanelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    sidePanelContent: {
      padding: 12,
      gap: 10,
    },
    sidePanelItem: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
      paddingVertical: 4,
    },
  }), [colors, isMobile]);

  if (inline) {
    return (
      <View style={styles.mapArea} />
    );
  }

  return (
    <View style={styles.container}>
      {/* Map area — static background, no shimmer animation to avoid inflating LCP */}
      <View style={styles.mapArea}>

        {/* Quick filter chips skeleton */}
        <View style={[styles.chipsRow, { pointerEvents: 'none' }]}>
          {[52, 68, 58].map((w, i) => (
            <SkeletonLoader key={i} width={w} height={28} borderRadius={14} />
          ))}
        </View>

        {/* Marker placeholders */}
        {MARKER_POSITIONS.map((pos, i) => (
          <View key={i} style={[styles.markerDot, { top: pos.top, left: pos.left }]}>
            <SkeletonLoader width={18} height={18} borderRadius={9} />
          </View>
        ))}

        {/* Map controls */}
        <View style={styles.mapControls}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.controlButton}>
              <SkeletonLoader width={36} height={36} borderRadius={DESIGN_TOKENS.radii.md} />
            </View>
          ))}
        </View>
      </View>

      {/* Side panel skeleton (desktop only) */}
      {Platform.OS === 'web' && !isMobile && (
        <View style={styles.sidePanel}>
          <View style={styles.sidePanelHeader}>
            <SkeletonLoader width={120} height={26} borderRadius={8} />
            <SkeletonLoader width={60} height={26} borderRadius={8} />
          </View>
          <View style={styles.sidePanelContent}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.sidePanelItem}>
                <SkeletonLoader width={40} height={40} borderRadius={10} />
                <View style={{ flex: 1, gap: 6 }}>
                  <SkeletonLoader width="70%" height={13} borderRadius={4} />
                  <SkeletonLoader width="45%" height={11} borderRadius={4} />
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};
