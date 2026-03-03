// components/ui/UploadProgressBar.tsx
// AND-15: Animated upload progress bar for image uploads.

import React, { memo, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

// Lazy-require reanimated only on native
const Reanimated = Platform.OS !== 'web' ? require('react-native-reanimated') : null;
const Animated = Reanimated?.default;
const useSharedValue = Reanimated?.useSharedValue;
const useAnimatedStyle = Reanimated?.useAnimatedStyle;
const withTiming = Reanimated?.withTiming;

interface UploadProgressBarProps {
  /** 0..1 progress value */
  progress: number;
  /** e.g. "2/5" */
  label?: string;
  /** Whether upload is in progress */
  visible?: boolean;
}

function UploadProgressBarInner({ progress, label, visible = true }: UploadProgressBarProps) {
  const colors = useThemedColors();

  if (!visible) return null;

  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {label ? (
          <Text style={[styles.label, { color: colors.textMuted }]}>{label} — {percent}%</Text>
        ) : (
          <Text style={[styles.label, { color: colors.textMuted }]}>{percent}%</Text>
        )}
        <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
          <View
            style={[
              styles.fill,
              {
                backgroundColor: colors.primary,
                width: `${percent}%`,
                // @ts-ignore web-only transition
                transition: 'width 0.3s ease',
              },
            ]}
          />
        </View>
      </View>
    );
  }

  return <NativeProgressBar progress={progress} label={label} percent={percent} colors={colors} />;
}

/** Native animated progress bar via Reanimated */
function NativeProgressBar({
  progress,
  label,
  percent,
  colors,
}: {
  progress: number;
  label?: string;
  percent: number;
  colors: ReturnType<typeof useThemedColors>;
}) {
  const widthPct = useSharedValue!(0);

  useEffect(() => {
    widthPct.value = withTiming!(Math.min(1, Math.max(0, progress)), { duration: 300 });
  }, [progress, widthPct]);

  const fillStyle = useAnimatedStyle!(() => ({
    width: `${Math.round(widthPct.value * 100)}%`,
  }));

  return (
    <View style={styles.container} accessible accessibilityLabel={`Загрузка ${percent}%`} accessibilityRole="progressbar">
      {label ? (
        <Text style={[styles.label, { color: colors.textMuted }]}>{label} — {percent}%</Text>
      ) : (
        <Text style={[styles.label, { color: colors.textMuted }]}>{percent}%</Text>
      )}
      <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
        <Animated.View style={[styles.fill, { backgroundColor: colors.primary }, fillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 13,
    marginBottom: 4,
    textAlign: 'center',
  },
  track: {
    height: 6,
    borderRadius: DESIGN_TOKENS.radii.sm,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: DESIGN_TOKENS.radii.sm,
  },
});

export const UploadProgressBar = memo(UploadProgressBarInner);
export default UploadProgressBar;


