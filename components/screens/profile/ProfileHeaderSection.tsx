import { View } from 'react-native';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileTabs, type ProfileTabKey } from '@/components/profile/ProfileTabs';
import { ProfileStatPills, type ProfileStatPill } from '@/components/profile/ProfileStatPills';
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
  statPills: ProfileStatPill[];
  activeTab: ProfileTabKey;
  handleProfileTabChange: (tab: ProfileTabKey) => void;
  tabCounts: Partial<Record<ProfileTabKey, number>>;
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
  statPills,
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
          {/* Cover skeleton — matches gradient hero (148px) */}
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
          {/* Stat pills row */}
          <View style={styles.skeletonStatsRow}>
            <SkeletonLoader width="100%" height={64} borderRadius={16} />
          </View>
          {/* Tabs */}
          <View style={styles.skeletonStatsRow}>
            <SkeletonLoader width="100%" height={48} borderRadius={24} />
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
          <ProfileStatPills pills={statPills} />
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
