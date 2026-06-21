import { memo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useMyRareAwards } from '@/hooks/useAchievementsApi';
import RareAwardCard from '@/components/achievements/RareAwardCard';

interface Props {
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

function RareAwardsSection({ testID, style }: Props) {
  const colors = useThemedColors();
  const { data, isLoading, isError } = useMyRareAwards();
  const styles = getStyles(colors);

  // Тихо скрываем при ошибке — секция необязательная.
  if (isError) return null;

  return (
    <View style={[styles.card, style]} testID={testID}>
      <View style={styles.headerRow}>
        <Feather name="star" size={16} color={colors.primary} />
        <Text style={styles.heading}>Редкие награды</Text>
      </View>

      {isLoading || !data ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : data.length > 0 ? (
        <View style={styles.list}>
          {data.map((award) => (
            <RareAwardCard key={award.id} award={award} />
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>
          Редкие награды вручает команда MeTravel за особый вклад в сообщество.
        </Text>
      )}
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
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    heading: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '800',
      color: colors.text,
    },
    list: { gap: DESIGN_TOKENS.spacing.sm },
    loading: { paddingVertical: DESIGN_TOKENS.spacing.lg, alignItems: 'center' },
    empty: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
      lineHeight: 20,
    },
  });

export default memo(RareAwardsSection);
