import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import ContactRequestsInbox from '@/components/profile/ContactRequestsInbox';
import UserAchievementsSection from '@/components/achievements/UserAchievementsSection';
import UserRareAwardsSection from '@/components/achievements/UserRareAwardsSection';
import AdminGrantRareAward from '@/components/achievements/AdminGrantRareAward';
import GamificationProfileBlock from '@/components/achievements/GamificationProfileBlock';

interface PublicProfileOverviewTabProps {
  userId: string;
  fullName: string;
  isOwnProfile: boolean;
}

export function PublicProfileOverviewTab({ userId, fullName, isOwnProfile }: PublicProfileOverviewTabProps) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          gap: DESIGN_TOKENS.spacing.md,
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
          paddingBottom: DESIGN_TOKENS.spacing.md,
        },
        section: {
          marginTop: 0,
        },
      }),
    []
  );

  return (
    <View style={styles.wrap}>
      {isOwnProfile ? <ContactRequestsInbox key={`contact-inbox-${userId}`} /> : null}
      <UserAchievementsSection userId={userId} style={styles.section} />
      <UserRareAwardsSection userId={userId} style={styles.section} />
      <AdminGrantRareAward recipientId={userId} recipientName={fullName || undefined} style={styles.section} />
      <GamificationProfileBlock userId={userId} style={styles.section} />
    </View>
  );
}
