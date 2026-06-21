import { memo, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { rareAwardToBadge, type RareAward } from '@/api/achievements';
import BadgeMedal from '@/components/achievements/BadgeMedal';

interface Props {
  award: RareAward;
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

function RareAwardCard({ award, testID, style }: Props) {
  const colors = useThemedColors();
  const badge = useMemo(() => rareAwardToBadge(award), [award]);
  const styles = getStyles(colors);
  const date = formatDate(award.grantedAt);

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
  });

export default memo(RareAwardCard);
