import { useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { ProfileCompleteness } from '@/components/profile/ProfileCompleteness';
import RankProgressCard from '@/components/profile/RankProgressCard';
import ProfileFirstStepsCard from '@/components/profile/ProfileFirstStepsCard';
import ProfileSectionHeader from '@/components/profile/ProfileSectionHeader';
import AwardsHub from '@/components/achievements/AwardsHub';
import GamificationOnboarding from '@/components/achievements/GamificationOnboarding';
import PlaceFirstBadgesSection from '@/components/achievements/PlaceFirstBadgesSection';
import { ProfileSectionsHub } from '@/components/screens/profile/ProfileSectionsHub';
import { useMyAchievements } from '@/hooks/useAchievementsApi';
import { useSeedGamificationFromAchievements } from '@/hooks/useGamification';

interface ProfileOverviewTabProps {
  userProp: { name: string; email: string; avatar?: string | null };
  profile: Parameters<typeof ProfileCompleteness>[0]['profile'];
  travelsCount: number;
  userId?: string | number | null;
  onCreateRoute: () => void;
  onStartQuest: () => void;
}

export function ProfileOverviewTab({
  userProp,
  profile,
  travelsCount,
  userId,
  onCreateRoute,
  onStartQuest,
}: ProfileOverviewTabProps) {
  // Засеваем кэши персонажа/прогрессии из консолидированного /achievements/me/,
  // чтобы вкладка «Ваш путь» рендерилась сразу, без двух медленных запросов (#588).
  useSeedGamificationFromAchievements(true);
  const { data: achievements } = useMyAchievements();
  const [awardsTab, setAwardsTab] = useState<{ key: 'all'; token: number } | null>(null);
  const tokenRef = useRef(0);

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

  const openAwardsDetails = () => {
    tokenRef.current += 1;
    setAwardsTab({ key: 'all', token: tokenRef.current });
  };

  return (
    <View style={styles.wrap}>
      <GamificationOnboarding />
      <RankProgressCard rank={achievements?.rank} onPress={openAwardsDetails} />
      <ProfileFirstStepsCard
        travelsCount={travelsCount}
        rank={achievements?.rank}
        onCreateRoute={onCreateRoute}
        onStartQuest={onStartQuest}
      />
      <ProfileSectionHeader
        title="Награды и прогресс"
        subtitle="Уровень, значки и достижения"
      />
      <AwardsHub requestedTab={awardsTab} />
      <PlaceFirstBadgesSection />
      <ProfileSectionHeader
        title="Профиль"
        subtitle="Заполните профиль, чтобы открыть больше возможностей"
      />
      <ProfileCompleteness user={userProp} profile={profile} travelsCount={travelsCount} />
      <ProfileSectionsHub userId={userId} />
    </View>
  );
}
