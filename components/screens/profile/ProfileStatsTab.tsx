import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { PersonalStatusSummary } from '@/components/profile/PersonalStatusSummary';
import {
  ProfileTravelEngagementSummary,
  type ProfileTravelEngagementMetricKey,
} from '@/components/profile/ProfileTravelEngagementSection';

interface ProfileStatsTabProps {
  travelsCount: number;
  loadedTravelsCount: number;
  travelsLoading: boolean;
  authoredTravelEngagementSummary: Parameters<typeof ProfileTravelEngagementSummary>[0]['summary'];
  authoredTravelEngagementScope: 'all' | 'loaded';
  activeTravelMetric: ProfileTravelEngagementMetricKey | null;
  handleTravelMetricPress: (metric: ProfileTravelEngagementMetricKey) => void;
  personalTravelStatusSummary: { visited: number; wishlist: number; planned: number };
  formatTripsCount: (count: number) => string;
  onOpenCalendar: (status?: 'visited' | 'wishlist' | 'planned') => void;
}

export function ProfileStatsTab({
  travelsCount,
  loadedTravelsCount,
  travelsLoading,
  authoredTravelEngagementSummary,
  authoredTravelEngagementScope,
  activeTravelMetric,
  handleTravelMetricPress,
  personalTravelStatusSummary,
  formatTripsCount,
  onOpenCalendar,
}: ProfileStatsTabProps) {
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
      <ProfileTravelEngagementSummary
        summary={authoredTravelEngagementSummary}
        travelsCount={travelsCount}
        loadedTravelsCount={loadedTravelsCount}
        isLoading={travelsLoading}
        mode="author"
        activeMetric={activeTravelMetric}
        onMetricPress={handleTravelMetricPress}
        summaryScope={authoredTravelEngagementScope}
      />
      <PersonalStatusSummary
        visited={personalTravelStatusSummary.visited}
        wishlist={personalTravelStatusSummary.wishlist}
        planned={personalTravelStatusSummary.planned}
        formatTripsCount={formatTripsCount}
        onOpenCalendar={onOpenCalendar}
      />
    </View>
  );
}
