import { memo, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import ImageCardMedia from '@/components/ui/ImageCardMedia';
import BadgeEmblem from '@/components/achievements/BadgeEmblem';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import type { Badge } from '@/api/achievements';
import { TIER_VISUALS, tierLabel } from '@/components/achievements/badgeVisuals';

interface Props {
  badge: Badge;
  /** Диаметр медали в px. */
  size?: number;
  /** Получен ли значок. Незаработанные затемнены + замок. */
  earned?: boolean;
  /** Прогресс к получению (для locked): {current, threshold}. */
  progress?: { current: number; threshold: number } | null;
  /** Подпись с названием под медалью. */
  showLabel?: boolean;
  /** Показать краткое описание значка («за что») под названием. */
  showDescription?: boolean;
  onPress?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

function BadgeMedal({
  badge,
  size = 72,
  earned = true,
  progress = null,
  showLabel = false,
  showDescription = false,
  onPress,
  testID,
  style,
}: Props) {
  const colors = useThemedColors();
  const tier = TIER_VISUALS[badge.tier];
  const ratio =
    progress && progress.threshold > 0
      ? Math.max(0, Math.min(1, progress.current / progress.threshold))
      : 0;

  const accessibilityLabel = useMemo(() => {
    const tl = tierLabel(badge.tier);
    const state = earned ? 'получен' : 'не получен';
    const base = tl ? `${badge.name}, ${tl}, ${state}` : `${badge.name}, ${state}`;
    if (!earned && progress) {
      return `${base}. Прогресс ${progress.current} из ${progress.threshold}`;
    }
    return base;
  }, [badge.name, badge.tier, earned, progress]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { alignItems: 'center', width: showDescription ? size + 40 : size + 8 },
        medalBox: { width: size, height: size },
        medal: {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          // Мягкая тень под эмблемой (бумажный диск).
          shadowColor: tier.shade,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.22,
          shadowRadius: 5,
          elevation: 3,
        },
        // Круглая обводка тира поверх загруженной картинки (ветка imageUrl).
        imageMedal: {
          borderRadius: size / 2,
          borderWidth: Math.max(2, Math.round(size * 0.045)),
          borderColor: tier.ring,
          overflow: 'hidden',
          backgroundColor: colors.surface,
        },
        locked: { opacity: 0.5 },
        lockedScrim: {
          ...StyleSheet.absoluteFillObject,
          borderRadius: size / 2,
          backgroundColor: colors.overlayLight,
        },
        lockBadge: {
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: Math.round(size * 0.34),
          height: Math.round(size * 0.34),
          borderRadius: size,
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        label: {
          marginTop: DESIGN_TOKENS.spacing.xs,
          fontSize: DESIGN_TOKENS.typography.sizes.xs,
          fontWeight: '600',
          color: earned ? colors.text : colors.textMuted,
          textAlign: 'center',
          maxWidth: showDescription ? size + 40 : size + 8,
        },
        description: {
          marginTop: 2,
          fontSize: 10,
          lineHeight: 13,
          color: colors.textMuted,
          textAlign: 'center',
          maxWidth: size + 40,
        },
        progressTrack: {
          marginTop: 6,
          width: size,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.backgroundTertiary,
          overflow: 'hidden',
        },
        progressFill: {
          height: '100%',
          width: `${ratio * 100}%`,
          backgroundColor: tier.ring,
          borderRadius: 2,
        },
        progressText: {
          marginTop: 2,
          fontSize: DESIGN_TOKENS.typography.sizes.xs,
          color: colors.textMuted,
        },
      }),
    [colors, earned, ratio, size, showDescription, tier.ring, tier.shade],
  );

  const hasImage = !!badge.imageUrl;
  const medalInner = badge.imageUrl ? (
    <ImageCardMedia
      src={badge.imageUrl}
      alt={badge.name}
      width={size}
      height={size}
      fit="contain"
      borderRadius={size / 2}
      priority="normal"
    />
  ) : (
    <BadgeEmblem badge={badge} size={size} />
  );

  const Wrapper: typeof Pressable | typeof View = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      testID={testID}
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel={accessibilityLabel}
      style={styles.wrap}
    >
      <View style={styles.medalBox}>
        <View style={[styles.medal, hasImage && styles.imageMedal, !earned && styles.locked, style]}>
          {medalInner}
          {!earned ? <View style={styles.lockedScrim} pointerEvents="none" /> : null}
        </View>
        {!earned ? (
          <View style={styles.lockBadge} pointerEvents="none">
            <Feather name="lock" size={Math.round(size * 0.16)} color={colors.textMuted} />
          </View>
        ) : null}
      </View>
      {showLabel ? (
        <Text style={styles.label} numberOfLines={2}>
          {badge.name}
        </Text>
      ) : null}
      {showDescription && badge.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {badge.description}
        </Text>
      ) : null}
      {!earned && progress ? (
        <>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
          <Text style={styles.progressText}>
            {progress.current}/{progress.threshold}
          </Text>
        </>
      ) : null}
    </Wrapper>
  );
}

export default memo(BadgeMedal);
