import { memo, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { rareAwardToBadge, type RareAward } from '@/api/achievements';
import BadgeMedal from '@/components/achievements/BadgeMedal';
import ShareBadgeSheet from '@/components/achievements/ShareBadgeSheet';

interface Props {
  award: RareAward;
  /** Ник владельца для подписи на share-карточке. */
  ownerName?: string;
  /** Скрыть кнопку «Поделиться» (напр. на публичном профиле другого автора). */
  shareable?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const formatDate = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

function RareAwardCard({ award, ownerName, shareable = true, testID, style }: Props) {
  const colors = useThemedColors();
  const badge = useMemo(() => rareAwardToBadge(award), [award]);
  const styles = getStyles(colors);
  const date = formatDate(award.grantedAt);
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <View style={[styles.card, style]} testID={testID}>
      <BadgeMedal badge={badge} size={56} earned />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {award.title}
        </Text>
        {award.reason ? (
          <Text style={styles.reason} numberOfLines={3}>
            {award.reason}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          {date ? <Text style={styles.meta}>{date}</Text> : null}
          {award.grantedByProfile?.name ? (
            <Text style={styles.meta} numberOfLines={1}>
              · {award.grantedByProfile.name}
            </Text>
          ) : null}
        </View>
      </View>

      {shareable ? (
        <Pressable
          style={styles.shareBtn}
          onPress={() => setShareOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Поделиться наградой «${award.title}»`}
          testID={testID ? `${testID}-share` : undefined}
        >
          <Feather name="share-2" size={16} color={colors.primaryDark} />
        </Pressable>
      ) : null}

      <ShareBadgeSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        context="card"
        subject={{
          achievementId: award.id,
          slug: award.slug,
          badge,
          ownerName,
          reason: award.reason,
          dateLabel: date,
          isRare: true,
        }}
      />
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.md,
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surfaceMuted,
    },
    body: { flex: 1, minWidth: 0, gap: 2 },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '800',
      color: colors.text,
    },
    reason: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      lineHeight: 18,
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    meta: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      fontWeight: '600',
    },
    shareBtn: {
      width: 36,
      height: 36,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
  });

export default memo(RareAwardCard);
