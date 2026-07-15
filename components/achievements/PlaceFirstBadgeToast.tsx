import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useMyPlaceFirstBadges } from '@/hooks/useGamification';
import { trackPlaceFirstBadgeEarned } from '@/utils/gamificationAnalytics';
import type { PlaceFirstBadge } from '@/api/gamification';
import { translate as i18nT } from '@/i18n'


// Места, по которым тост уже показан в этой сессии — без повторов при рефетче.
const shownIds = new Set<number>();

const VISIBLE_MS = 4500;

/** Unlock-тост при получении бейджа первооткрывателя места. FE-place-first-badge. */
interface Props {
  enabled?: boolean;
}

function PlaceFirstBadgeToast({ enabled = true }: Props) {
  const colors = useThemedColors();
  const { data } = useMyPlaceFirstBadges({ enabled });
  const [current, setCurrent] = useState<PlaceFirstBadge | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    if (current) return;
    const next = data?.find((b) => b.isFresh && !shownIds.has(b.id));
    if (next) {
      shownIds.add(next.id);
      setCurrent(next);
      trackPlaceFirstBadgeEarned({
        placeId: next.placeId,
        placeName: next.placeName,
        date: next.discoveredAt,
      });
    }
  }, [data, current]);

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
        accessibilityLabel={i18nT('achievements:components.achievements.PlaceFirstBadgeToast.vy_pervootkryvatel_mesta_value1_a8a5019e', { value1: current.placeName })}
      >
        <View style={styles.iconWrap}>
          <Feather name="map-pin" size={22} color={colors.textOnPrimary} />
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.title}>{i18nT('achievements:components.achievements.PlaceFirstBadgeToast.pervootkryvatel_mesta_e52eb0e2')}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {current.placeName}
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
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
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

export default memo(PlaceFirstBadgeToast);
