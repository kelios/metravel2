import { memo, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import GamificationOnboarding from '@/components/achievements/GamificationOnboarding';
import PlaceFirstBadgesSection from '@/components/achievements/PlaceFirstBadgesSection';
import ActivityProgressionSection from '@/components/achievements/ActivityProgressionSection';
import CharacterProfileCard from '@/components/achievements/CharacterProfileCard';

interface Props {
  /** userId — публичный профиль автора; не задан — собственный профиль. */
  userId?: string | number | null;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Композитный блок геймификации-2 для профиля: онбординг (только свой профиль) +
 * открытые места + линейки прогрессии + персонаж с выбором пути.
 */
function GamificationProfileBlock({ userId, testID, style }: Props) {
  const isOwn = userId == null;
  const styles = useMemo(() => getStyles(), []);

  return (
    <View style={[styles.wrap, style]} testID={testID}>
      {isOwn ? <GamificationOnboarding /> : null}
      <PlaceFirstBadgesSection userId={userId} />
      <ActivityProgressionSection userId={userId} />
      <CharacterProfileCard userId={userId} />
    </View>
  );
}

const getStyles = () =>
  StyleSheet.create({
    wrap: { gap: DESIGN_TOKENS.spacing.md },
  });

export default memo(GamificationProfileBlock);
