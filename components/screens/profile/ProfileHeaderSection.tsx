import { useMemo } from 'react';
import { View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileTabs, type ProfileTabKey } from '@/components/profile/ProfileTabs';
import type { ProfileHeaderActionKey } from '@/components/profile/ProfileHeaderQuickActions';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import Button from '@/components/ui/Button';
import type { createProfileScreenStyles } from './profileScreen.styles';
import { translate as i18nT } from '@/i18n'


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
  handleHeaderAction: (key: ProfileHeaderActionKey) => void;
  onRankPress?: () => void;
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
  handleHeaderAction,
  onRankPress,
  activeTab,
  handleProfileTabChange,
  tabCounts,
  showClearButton,
  handleClearActiveTab,
}: ProfileHeaderSectionProps) {
  const colors = useThemedColors();
  // «Очистить» — разрушающее ВТОРОСТЕПЕННОЕ действие над списком вкладки.
  // Залитый `danger` делал его самым контрастным пятном экрана на телефоне
  // (#1670), поэтому здесь ghost без заливки и рамки: вес несёт только красная
  // подпись с иконкой корзины. Подтверждение удаления остаётся на месте.
  const clearIcon = useMemo(
    () => <Feather name="trash-2" size={16} color={colors.danger} />,
    [colors.danger]
  );
  const clearLabelStyle = useMemo(() => ({ color: colors.danger }), [colors.danger]);
  // Web-hover варианта `ghost` возвращает заливку `primarySoft` (Button.tsx:330),
  // то есть под красной подписью проступал бы БРЕНДОВЫЙ тон. Перекрываем своим
  // мягким danger-фоном: наведение остаётся заметным, но не «первичным».
  const clearHoverStyle = useMemo(
    () => ({ backgroundColor: colors.dangerSoft }),
    [colors.dangerSoft]
  );

  return (
    <View style={[styles.headerComponent, styles.fullRow]}>
      {profileLoading ? (
        <View style={styles.skeletonWrap}>
          {/* Cover skeleton — matches photo banner hero with inline quick actions (132px) */}
          <SkeletonLoader width="100%" height={132} borderRadius={0} />
          {/* Identity row: avatar left (84 + 3*2 ring), name+status right */}
          <View style={styles.skeletonIdentityRow}>
            <SkeletonLoader width={90} height={90} borderRadius={45} />
            <View style={styles.skeletonIdentityText}>
              <SkeletonLoader width={180} height={22} borderRadius={4} />
              <SkeletonLoader width={140} height={16} borderRadius={4} />
              <SkeletonLoader width={200} height={14} borderRadius={4} />
            </View>
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
            onEdit={handleEdit}
            onLogout={handleLogout}
            onQuickAction={handleHeaderAction}
            onRankPress={onRankPress}
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
              label={i18nT('profile:components.screens.profile.ProfileHeaderSection.ochistit_0cf8b203')}
              onPress={handleClearActiveTab}
              variant="ghost"
              size="sm"
              icon={clearIcon}
              labelStyle={clearLabelStyle}
              hoverStyle={clearHoverStyle}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
