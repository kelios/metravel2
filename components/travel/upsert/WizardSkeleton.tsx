import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import type { UpsertTravelController } from '@/components/travel/upsert/useUpsertTravelController';
import { DESIGN_TOKENS } from '@/constants/designSystem';

type Colors = UpsertTravelController['colors'];

const WizardSkeleton = ({ colors }: { colors: Colors }) => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const skeletonStyle = useMemo(
    () => ({ opacity: pulseAnim, backgroundColor: colors.surfaceMuted }),
    [colors.surfaceMuted, pulseAnim],
  );

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: false }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.skeletonContainer}>
      <Animated.View style={[styles.skeletonHeader, skeletonStyle]} />
      <Animated.View style={[styles.skeletonProgress, skeletonStyle]} />
      <Animated.View style={[styles.skeletonInput, skeletonStyle]} />
      <Animated.View style={[styles.skeletonBody, skeletonStyle]} />
      <Animated.View style={[styles.skeletonInput, skeletonStyle]} />
    </View>
  );
};

const styles = StyleSheet.create({
  skeletonContainer: {
    flex: 1,
    padding: DESIGN_TOKENS.spacing.lg,
  },
  skeletonHeader: {
    height: 60,
    borderRadius: DESIGN_TOKENS.radii.md,
    marginBottom: DESIGN_TOKENS.spacing.lg,
  },
  skeletonProgress: {
    height: 8,
    borderRadius: 4,
    marginBottom: DESIGN_TOKENS.spacing.xl,
  },
  skeletonInput: {
    height: 56,
    borderRadius: DESIGN_TOKENS.radii.md,
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  skeletonBody: {
    height: 120,
    borderRadius: DESIGN_TOKENS.radii.md,
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
});

export default WizardSkeleton;
