import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { ProfileCompleteness } from '@/components/profile/ProfileCompleteness';
import AwardsHub from '@/components/achievements/AwardsHub';
import GamificationOnboarding from '@/components/achievements/GamificationOnboarding';
import PlaceFirstBadgesSection from '@/components/achievements/PlaceFirstBadgesSection';

interface ProfileOverviewTabProps {
  userProp: { name: string; email: string; avatar?: string | null };
  profile: Parameters<typeof ProfileCompleteness>[0]['profile'];
  travelsCount: number;
}

export function ProfileOverviewTab({
  userProp,
  profile,
  travelsCount,
}: ProfileOverviewTabProps) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          gap: DESIGN_TOKENS.spacing.md,
          paddingBottom: DESIGN_TOKENS.spacing.md,
        },
      }),
    []
  );

  return (
    <View style={styles.wrap}>
      <GamificationOnboarding />
      <AwardsHub />
      <PlaceFirstBadgesSection />
      <ProfileCompleteness user={userProp} profile={profile} travelsCount={travelsCount} />
    </View>
  );
}
