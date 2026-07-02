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
import { useRouter } from 'expo-router';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import type { Badge } from '@/api/achievements';
import type { PlaceFirstBadge } from '@/api/gamification';
import BadgeMedal from '@/components/achievements/BadgeMedal';

interface Props {
  item: PlaceFirstBadge;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Синтетический Badge для переиспользования визуала BadgeMedal. */
const toBadge = (item: PlaceFirstBadge): Badge => ({
  id: item.id,
  slug: `place-first-${item.placeId}`,
  name: item.placeName,
  description: item.authorStatus,
  categorySlug: 'geo',
  categoryName: 'Места',
  tier: item.tier,
  imageUrl: item.imageUrl,
  points: 0,
  isSecret: false,
  order: item.id,
});

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/**
 * Карточка бейджа первооткрывателя места: медаль, имя места, дата открытия,
 * статус автора, счётчики (просмотры/сохранения/посещения), ссылка на место.
 * FE-place-first-badge.
 */
function PlaceFirstBadgeCard({ item, testID, style }: Props) {
  const colors = useThemedColors();
  const router = useRouter();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const badge = useMemo(() => toBadge(item), [item]);

  const date = formatDate(item.discoveredAt);
  const canOpen = Boolean(item.placeUrl);

  const openPlace = () => {
    if (item.placeUrl) router.push(item.placeUrl as never);
  };

  const stats: Array<{ icon: keyof typeof Feather.glyphMap; value: number; label: string }> = [
    { icon: 'eye', value: item.views, label: 'просмотров' },
    { icon: 'bookmark', value: item.saves, label: 'сохранений' },
    { icon: 'map-pin', value: item.visits, label: 'посещений' },
  ];

  return (
    <Pressable
      style={[styles.card, style]}
      testID={testID}
      onPress={canOpen ? openPlace : undefined}
      disabled={!canOpen}
      accessibilityRole={canOpen ? 'button' : 'summary'}
      accessibilityLabel={`Первооткрыватель места: ${item.placeName}${date ? `, открыто ${date}` : ''}`}
    >
      <BadgeMedal badge={badge} size={64} earned />
      <View style={styles.body}>
        <View style={styles.statusRow}>
          <Feather name="award" size={13} color={colors.primaryDark} />
          <Text style={styles.status}>{item.authorStatus} места</Text>
        </View>
        <Text style={styles.placeName} numberOfLines={2}>
          {item.placeName}
        </Text>
        {date ? <Text style={styles.date}>Открыто {date}</Text> : null}

        <View style={styles.statsRow}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <Feather name={s.icon} size={13} color={colors.textMuted} />
              <Text style={styles.statValue}>{s.value.toLocaleString('ru-RU')}</Text>
            </View>
          ))}
        </View>
      </View>
      {canOpen ? (
        <Feather name="chevron-right" size={20} color={colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.md,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      padding: DESIGN_TOKENS.spacing.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    body: { flex: 1, minWidth: 0, gap: 2 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    status: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '700',
      color: colors.primaryText,
      letterSpacing: 0.2,
    },
    placeName: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '800',
      color: colors.text,
    },
    date: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
    },
    statsRow: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.md,
      marginTop: 4,
    },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statValue: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '700',
      color: colors.text,
    },
  });

export default memo(PlaceFirstBadgeCard);
