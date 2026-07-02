import { memo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useUserAchievements } from '@/hooks/useAchievementsApi';
import RankBar from '@/components/achievements/RankBar';
import BadgeGrid, { type BadgeGridItem } from '@/components/achievements/BadgeGrid';
import PeerBadgeReceivedRow from '@/components/achievements/PeerBadgeReceivedRow';

interface Props {
  userId: string | number;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

function UserAchievementsSection({ userId, testID, style }: Props) {
  const colors = useThemedColors();
  const { data, isLoading, isError } = useUserAchievements(userId);

  const styles = getStyles(colors);

  if (isError) return null;

  if (isLoading || !data) {
    return (
      <View style={[styles.card, style]} testID={testID}>
        <ActivityIndicator color={colors.primaryDark} />
      </View>
    );
  }

  // Нет ни ранга, ни значков, ни наград — секцию не показываем.
  if (
    data.earned.length === 0 &&
    data.rank.totalPoints === 0 &&
    data.peerReceived.length === 0
  ) {
    return null;
  }

  const items: BadgeGridItem[] = data.earned.map((ub) => ({
    badge: ub.badge,
    earned: true,
  }));

  return (
    <View style={[styles.card, style]} testID={testID}>
      <Text style={styles.heading}>Достижения</Text>
      <RankBar rank={data.rank} />
      {items.length > 0 ? (
        <BadgeGrid items={items} size={60} style={styles.grid} />
      ) : null}
      {data.peerReceived.length > 0 ? (
        <PeerBadgeReceivedRow items={data.peerReceived} size={56} style={styles.peerRow} />
      ) : null}
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      padding: DESIGN_TOKENS.spacing.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: DESIGN_TOKENS.spacing.md,
    },
    heading: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '800',
      color: colors.text,
    },
    grid: { marginTop: DESIGN_TOKENS.spacing.xs },
    peerRow: { marginTop: DESIGN_TOKENS.spacing.sm },
  });

export default memo(UserAchievementsSection);
