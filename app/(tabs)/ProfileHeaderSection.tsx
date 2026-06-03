import { View } from 'react-native';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileCompleteness } from '@/components/profile/ProfileCompleteness';
import { ProfileTabs, type ProfileTabKey } from '@/components/profile/ProfileTabs';
import { ProfileQuickActions } from '@/components/profile/ProfileQuickActions';
import { PersonalStatusSummary } from '@/components/profile/PersonalStatusSummary';
import {
  ProfileTravelEngagementSummary,
  type ProfileTravelEngagementMetricKey,
} from '@/components/profile/ProfileTravelEngagementSection';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import Button from '@/components/ui/Button';
import type { createProfileScreenStyles } from './profileScreen.styles';

type ProfileScreenStyles = ReturnType<typeof createProfileScreenStyles>;

interface ProfileHeaderSectionProps {
  styles: ProfileScreenStyles;
  profileLoading: boolean;
  userProp: { name: string; email: string; avatar?: string | null };
  profile: Parameters<typeof ProfileHeader>[0]['profile'];
  handleEdit: () => void;
  handleLogout: () => void;
  pickAndUpload: () => void;
  avatarUploading: boolean;
  authoredTravelEngagementSummary: Parameters<typeof ProfileTravelEngagementSummary>[0]['summary'];
  travelsCount: number;
  loadedTravelsCount: number;
  travelsLoading: boolean;
  activeTravelMetric: ProfileTravelEngagementMetricKey | null;
  handleTravelMetricPress: (metric: ProfileTravelEngagementMetricKey) => void;
  authoredTravelEngagementScope: 'all' | 'loaded';
  personalTravelStatusSummary: { visited: number; wishlist: number; planned: number };
  formatTripsCount: (count: number) => string;
  onOpenCalendar: () => void;
  handleQuickAction: (key: string) => void;
  activeTab: ProfileTabKey;
  handleProfileTabChange: (tab: ProfileTabKey) => void;
  tabCounts: { travels: number; favorites: number; history: number };
  showClearButton: boolean;
  handleClearActiveTab: () => void;
}

export function ProfileHeaderSection({
  styles,
  profileLoading,
  userProp,
  profile,
  handleEdit,
  handleLogout,
  pickAndUpload,
  avatarUploading,
  authoredTravelEngagementSummary,
  travelsCount,
  loadedTravelsCount,
  travelsLoading,
  activeTravelMetric,
  handleTravelMetricPress,
  authoredTravelEngagementScope,
  personalTravelStatusSummary,
  formatTripsCount,
  onOpenCalendar,
  handleQuickAction,
  activeTab,
  handleProfileTabChange,
  tabCounts,
  showClearButton,
  handleClearActiveTab,
}: ProfileHeaderSectionProps) {
  return (
    <View style={[styles.headerComponent, styles.fullRow]}>
      {profileLoading ? (
        <View style={styles.skeletonWrap}>
          {/* Cover skeleton — matches new gradient hero (148px) */}
          <SkeletonLoader width="100%" height={148} borderRadius={0} />
          {/* Avatar skeleton overlapping cover (124 + 4*2 ring) */}
          <View style={styles.skeletonAvatarRow}>
            <SkeletonLoader width={132} height={132} borderRadius={66} />
          </View>
          {/* Name + email centered */}
          <View style={styles.skeletonCenterText}>
            <SkeletonLoader width={200} height={26} borderRadius={4} />
            <SkeletonLoader width={220} height={14} borderRadius={4} />
          </View>
          {/* Edit button */}
          <View style={styles.skeletonCenterText}>
            <SkeletonLoader width={150} height={40} borderRadius={20} />
          </View>
          {/* Engagement metrics card */}
          <View style={styles.skeletonStatsRow}>
            <SkeletonLoader width="100%" height={180} borderRadius={16} />
          </View>
          {/* Personal status card */}
          <View style={styles.skeletonStatsRow}>
            <SkeletonLoader width="100%" height={150} borderRadius={20} />
          </View>
        </View>
      ) : (
        <>
          <ProfileHeader
            user={userProp}
            profile={profile}
            onEdit={handleEdit}
            onLogout={handleLogout}
            onAvatarUpload={pickAndUpload}
            avatarUploading={avatarUploading}
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
          <PersonalStatusSummary
            visited={personalTravelStatusSummary.visited}
            wishlist={personalTravelStatusSummary.wishlist}
            planned={personalTravelStatusSummary.planned}
            formatTripsCount={formatTripsCount}
            onOpenCalendar={onOpenCalendar}
          />
          <ProfileCompleteness
            user={userProp}
            profile={profile}
            travelsCount={travelsCount}
          />
          <ProfileQuickActions onPress={handleQuickAction} />
          <ProfileTabs
            activeTab={activeTab}
            onChangeTab={handleProfileTabChange}
            counts={tabCounts}
          />
        </>
      )}
      {showClearButton ? (
        <View style={styles.tabActions}>
          <View style={styles.tabActionsRow}>
            <Button
              label="Очистить"
              onPress={handleClearActiveTab}
              variant="danger"
              size="sm"
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
