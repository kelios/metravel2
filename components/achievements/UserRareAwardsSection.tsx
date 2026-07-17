import { memo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useUserRareAwards } from '@/hooks/useAchievementsApi';
import RareAwardCard from '@/components/achievements/RareAwardCard';
import { translate as i18nT } from '@/i18n'


interface Props {
  userId: string | number;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

function UserRareAwardsSection({ userId, testID, style }: Props) {
  const colors = useThemedColors();
  const { data, isError } = useUserRareAwards(userId);
  const styles = getStyles(colors);

  // Публичную секцию показываем только при наличии наград (как peer-секцию).
  if (isError || !data || data.length === 0) return null;

  return (
    <View style={[styles.card, style]} testID={testID}>
      <View style={styles.headerRow}>
        <Feather name="star" size={16} color={colors.primaryDark} />
        <Text style={styles.heading}>{i18nT('achievements:components.achievements.UserRareAwardsSection.redkie_nagrady_145b33ae')}</Text>
      </View>
      <View style={styles.list}>
        {data.map((award) => (
          <RareAwardCard key={award.id} award={award} shareable={false} />
        ))}
      </View>
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
  });

export default memo(UserRareAwardsSection);
