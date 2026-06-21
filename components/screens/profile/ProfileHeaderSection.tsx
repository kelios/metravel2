import { View } from 'react-native';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileTabs, type ProfileTabKey } from '@/components/profile/ProfileTabs';
import type { ProfileStatSegmentItem } from '@/components/profile/ProfileStatSegment';
import type { ProfileHeaderActionKey } from '@/components/profile/ProfileHeaderQuickActions';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import Button from '@/components/ui/Button';
import type { createProfileScreenStyles } from './profileScreen.styles';

type ProfileScreenStyles = ReturnType<typeof createProfileScreenStyles>;

interface ProfileHeaderSectionProps {
  styles: ProfileScreenStyles;
  profileLoading: boolean;
  userProp: { name: string; email: string; avatar?: string | null };
  profile: Parameters<typeof ProfileHeader>[0]['profile'];
  rank?: { level: number; title: string } | null;
  unreadMessagesCount: number;
  handleEdit: () => void;
  handleLogout: () => void;
  pickAndUpload: () => void;
  avatarUploading: boolean;
  statItems: ProfileStatSegmentItem[];
  handleHeaderAction: (key: ProfileHeaderActionKey) => void;
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
  rank,
  unreadMessagesCount,
  handleEdit,
  handleLogout,
  pickAndUpload,
  avatarUploading,
  statItems,
  handleHeaderAction,
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
          {/* Cover skeleton — matches compact gradient hero (90px) */}
          <SkeletonLoader width="100%" height={90} borderRadius={0} />
          {/* Identity row: avatar left (84 + 3*2 ring), name+status right */}
          <View style={styles.skeletonIdentityRow}>
            <SkeletonLoader width={90} height={90} borderRadius={45} />
            <View style={styles.skeletonIdentityText}>
              <SkeletonLoader width={180} height={22} borderRadius={4} />
              <SkeletonLoader width={140} height={16} borderRadius={4} />
              <SkeletonLoader width={200} height={14} borderRadius={4} />
            </View>
          </View>
          {/* Stat segment row */}
          <View style={styles.skeletonStatsRow}>
            <SkeletonLoader width="100%" height={50} borderRadius={16} />
          </View>
          {/* Quick actions row */}
          <View style={styles.skeletonStatsRow}>
            <SkeletonLoader width="100%" height={56} borderRadius={12} />
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
            rank={rank}
            unreadMessagesCount={unreadMessagesCount}
            statItems={statItems}
            onEdit={handleEdit}
            onLogout={handleLogout}
            onQuickAction={handleHeaderAction}
            onAvatarUpload={pickAndUpload}
            avatarUploading={avatarUploading}
          />
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
