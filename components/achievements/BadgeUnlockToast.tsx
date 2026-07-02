import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useMyAchievements } from '@/hooks/useAchievementsApi';
import type { UserBadge } from '@/api/achievements';
import BadgeMedal from '@/components/achievements/BadgeMedal';

// Значки, по которым тост уже показан в этой сессии — чтобы не дёргать повторно
// при рефетче/навигации. Сброс на полной перезагрузке (приемлемо для v1).
const shownBadgeIds = new Set<number>();

const VISIBLE_MS = 4500;

interface Props {
  enabled?: boolean;
}

function BadgeUnlockToast({ enabled = true }: Props) {
  const colors = useThemedColors();
  const { data } = useMyAchievements({ enabled });
  const [current, setCurrent] = useState<UserBadge | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    if (current) return;
    const next = data?.recentlyEarned?.find((ub) => !shownBadgeIds.has(ub.badge.id));
    if (next) {
      shownBadgeIds.add(next.badge.id);
      setCurrent(next);
    }
  }, [data?.recentlyEarned, current]);

  useEffect(() => {
    if (!current) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 14 }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -16, duration: 220, useNativeDriver: true }),
      ]).start(() => setCurrent(null));
    }, VISIBLE_MS);

    return () => clearTimeout(timer);
  }, [current, opacity, translateY]);

  if (!current) return null;

  const dismiss = () => {
    Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
      setCurrent(null),
    );
  };

  const styles = getStyles(colors);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { opacity, transform: [{ translateY }] }]}
    >
      <Pressable
        style={styles.toast}
        onPress={dismiss}
        accessibilityRole="alert"
        accessibilityLabel={`Новый значок: ${current.badge.name}`}
      >
        <BadgeMedal badge={current.badge} size={48} earned />
        <View style={styles.textBlock}>
          <Text style={styles.title}>Новый значок!</Text>
          <Text style={styles.name} numberOfLines={1}>
            {current.badge.name}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      top: DESIGN_TOKENS.spacing.lg,
      left: DESIGN_TOKENS.spacing.md,
      right: DESIGN_TOKENS.spacing.md,
      alignItems: 'center',
      zIndex: DESIGN_TOKENS.zIndex.toast,
    },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      maxWidth: 380,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 8,
    },
    textBlock: { flexShrink: 1, minWidth: 0 },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '700',
      color: colors.primaryText,
      letterSpacing: 0.3,
    },
    name: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '700',
      color: colors.text,
    },
  });

export default memo(BadgeUnlockToast);
