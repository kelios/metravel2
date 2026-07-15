import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { PersonalStatusSummary } from '@/components/profile/PersonalStatusSummary';
import ProfileSectionHeader from '@/components/profile/ProfileSectionHeader';
import {
  ProfileTravelEngagementSummary,
  type ProfileTravelEngagementMetricKey,
} from '@/components/profile/ProfileTravelEngagementSection';
import { translate as i18nT } from '@/i18n'


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
  onBackToOverview: () => void;
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
  onBackToOverview,
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
      <ProfileSectionHeader
        title={i18nT('profile:components.screens.profile.ProfileStatsTab.statistika_marshrutov_0d3cf72d')}
        subtitle={i18nT('profile:components.screens.profile.ProfileStatsTab.kak_soobschestvo_vzaimodeystvuet_s_vashimi_m_71f410df')}
        onBack={onBackToOverview}
        backLabel={i18nT('profile:components.screens.profile.ProfileStatsTab.uroven_9cb90129')}
      />
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
      <ProfileSectionHeader
        title={i18nT('profile:components.screens.profile.ProfileStatsTab.moi_poezdki_64c36557')}
        subtitle={i18nT('profile:components.screens.profile.ProfileStatsTab.lichnye_otmetki_gde_byli_chto_hotite_i_chto__7150bddf')}
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
