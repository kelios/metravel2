import { memo, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import type { Badge } from '@/api/achievements';
import type { PlaceFirstBadge } from '@/api/gamification';
import BadgeMedal from '@/components/achievements/BadgeMedal';
import { formatDate as formatLocalizedDate, formatInteger, translate as i18nT } from '@/i18n'


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
  categoryId: null,
  categorySlug: 'geo',
  categoryName: i18nT('achievements:components.achievements.PlaceFirstBadgeCard.mesta_ea476637'),
  categoryIcon: null,
  tier: item.tier,
  imageUrl: item.imageUrl,
  imageStatus: null,
  awardType: 'auto',
  target: 'user',
  points: 0,
  isSecret: false,
  order: item.id,
});

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatLocalizedDate(d, {
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
    { icon: 'eye', value: item.views, label: i18nT('achievements:components.achievements.PlaceFirstBadgeCard.prosmotrov_5bf2561c') },
    { icon: 'bookmark', value: item.saves, label: i18nT('achievements:components.achievements.PlaceFirstBadgeCard.sohraneniy_c0f23756') },
    { icon: 'map-pin', value: item.visits, label: i18nT('achievements:components.achievements.PlaceFirstBadgeCard.posescheniy_79a706dc') },
  ];

  return (
    <Pressable
      style={[styles.card, style]}
      testID={testID}
      onPress={canOpen ? openPlace : undefined}
      disabled={!canOpen}
      accessibilityRole={canOpen ? 'button' : 'summary'}
      accessibilityLabel={i18nT('achievements:components.achievements.PlaceFirstBadgeCard.pervootkryvatel_mesta_value1_value2_1ce2a29a', { value1: item.placeName, value2: date ? i18nT('achievements:components.achievements.PlaceFirstBadgeCard.accessibility.openedOn', { value1: date }) : '' })}
    >
      <BadgeMedal badge={badge} size={64} earned />
      <View style={styles.body}>
        <View style={styles.statusRow}>
          <Feather name="award" size={13} color={colors.primaryDark} />
          <Text style={styles.status}>{item.authorStatus} {i18nT('achievements:components.achievements.PlaceFirstBadgeCard.mesta_9ea7c2fe')}</Text>
        </View>
        <Text style={styles.placeName} numberOfLines={2}>
          {item.placeName}
        </Text>
        {date ? <Text style={styles.date}>{i18nT('achievements:components.achievements.PlaceFirstBadgeCard.otkryto_66797293')}{date}</Text> : null}

        <View style={styles.statsRow}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <Feather name={s.icon} size={13} color={colors.textMuted} />
              <Text style={styles.statValue}>{formatInteger(s.value)}</Text>
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
