import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { UserProfileDto } from '@/api/user';
import AuthorCard from '@/components/subscriptions/AuthorCard';
import SubscriberCard from '@/components/subscriptions/SubscriberCard';
import EmptyState from '@/components/ui/EmptyState';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import type { AuthorWithTravels, SubscriptionTab } from '@/hooks/useSubscriptionsData';
import { globalFocusStyles } from '@/styles/globalFocus';
import { translate as i18nT } from '@/i18n'


type WebEnhancedViewStyle = ViewStyle & { boxShadow?: string; cursor?: 'pointer' };
type WebEnhancedTextStyle = TextStyle & { outlineStyle?: 'none' };

const WEB_CARD_SHADOW_STYLE: WebEnhancedViewStyle = { boxShadow: DESIGN_TOKENS.shadows.card };
const WEB_TEXT_OUTLINE_NONE_STYLE = { outlineStyle: 'none' } as WebEnhancedTextStyle;

interface SubscriptionsTabContentProps {
  activeTab: SubscriptionTab;
  onChangeTab?: (tab: SubscriptionTab) => void;
  showTabBar?: boolean;
  subscriptions: UserProfileDto[];
  subscribers: UserProfileDto[];
  authors: AuthorWithTravels[];
  subscriptionsLoading: boolean;
  subscribersLoading: boolean;
  getFullName: (profile: UserProfileDto) => string;
  handleUnsubscribe: (userId: number) => void;
  onMessage: (userId: number) => void;
  onOpenTravel: (url: string) => void;
  onOpenProfile: (userId: number) => void;
  onFindTravels: () => void;
}

export default function SubscriptionsTabContent({
  activeTab,
  onChangeTab,
  showTabBar = true,
  subscriptions,
  subscribers,
  authors,
  subscriptionsLoading,
  subscribersLoading,
  getFullName,
  handleUnsubscribe,
  onMessage,
  onOpenTravel,
  onOpenProfile,
  onFindTravels,
}: SubscriptionsTabContentProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [search, setSearch] = useState('');

  const filteredAuthors = useMemo(() => {
    if (!search.trim()) return authors;
    const q = search.trim().toLowerCase();
    return authors.filter((author) => getFullName(author.profile).includes(q));
  }, [authors, search, getFullName]);

  const filteredSubscribers = useMemo(() => {
    if (!search.trim()) return subscribers;
    const q = search.trim().toLowerCase();
    return subscribers.filter((profile) => getFullName(profile).includes(q));
  }, [subscribers, search, getFullName]);

  const isActiveLoading = activeTab === 'subscriptions' ? subscriptionsLoading : subscribersLoading;

  const renderTabBar = () => {
    if (!showTabBar || !onChangeTab) return null;

    return (
      <View style={styles.tabBar} accessibilityRole="tablist">
        {(['subscriptions', 'subscribers'] as const).map((tab) => {
          const isActive = activeTab === tab;
          const count = tab === 'subscriptions' ? subscriptions.length : subscribers.length;
          const label = tab === 'subscriptions' ? i18nT('shared:components.subscriptions.SubscriptionsTabContent.podpiski_d6c645a6') : i18nT('shared:components.subscriptions.SubscriptionsTabContent.podpischiki_fc40a23e');
          return (
            <Pressable
              key={tab}
              style={[styles.tab, isActive && styles.tabActive, globalFocusStyles.focusable]}
              onPress={() => onChangeTab(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={label}
              {...Platform.select({ web: { cursor: 'pointer' } })}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {label}{count > 0 ? ` (${count})` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  const renderSearchBar = () => (
    <View style={[styles.searchContainer, { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderLight }]}>
      <Feather name="search" size={16} color={colors.textMuted} />
      <TextInput
        style={[styles.searchInput, { color: colors.text }]}
        value={search}
        onChangeText={setSearch}
        placeholder={i18nT('shared:components.subscriptions.SubscriptionsTabContent.poisk_po_imeni_d9595c41')}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={i18nT('shared:components.subscriptions.SubscriptionsTabContent.poisk_po_podpiskam_c8a8ffba')}
      />
      {search.length > 0 ? (
        <Pressable onPress={() => setSearch('')} accessibilityLabel={i18nT('shared:components.subscriptions.SubscriptionsTabContent.ochistit_poisk_8fa83cac')}>
          <Feather name="x" size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );

  const renderSubscriptionsTab = () => {
    if (subscriptions.length === 0) {
      return (
        <EmptyState
          icon="users"
          title={i18nT('shared:components.subscriptions.SubscriptionsTabContent.vy_esche_ni_na_kogo_ne_podpisany_5e3d37ec')}
          description={i18nT('shared:components.subscriptions.SubscriptionsTabContent.podpishites_na_avtorov_chtoby_videt_ih_putes_17ba432e')}
          variant="empty"
          action={{ label: i18nT('shared:components.subscriptions.SubscriptionsTabContent.nayti_puteshestviya_1951ac15'), onPress: onFindTravels }}
        />
      );
    }

    return (
      <>
        {renderSearchBar()}
        <View style={styles.header}>
          <Text style={styles.subtitle}>
            {subscriptions.length}{' '}
            {subscriptions.length === 1 ? i18nT('shared:components.subscriptions.SubscriptionsTabContent.avtor_5d6c4cc2') : subscriptions.length < 5 ? i18nT('shared:components.subscriptions.SubscriptionsTabContent.avtora_ab6b344d') : i18nT('shared:components.subscriptions.SubscriptionsTabContent.avtorov_1228ef6a')}
          </Text>
        </View>
        {filteredAuthors.map((author) => (
          <AuthorCard
            key={author.profile.user ?? author.profile.id}
            author={author}
            onUnsubscribe={handleUnsubscribe}
            onMessage={onMessage}
            onOpenTravel={onOpenTravel}
            onOpenProfile={onOpenProfile}
          />
        ))}
        {filteredAuthors.length === 0 && search.trim() ? (
          <View style={styles.noResults}>
            <Text style={[styles.noResultsText, { color: colors.textMuted }]}>{i18nT('shared:components.subscriptions.SubscriptionsTabContent.nichego_ne_naydeno_bf51f155')}</Text>
          </View>
        ) : null}
      </>
    );
  };

  const renderSubscribersTab = () => {
    if (subscribers.length === 0) {
      return (
        <EmptyState
          icon="users"
          title={i18nT('shared:components.subscriptions.SubscriptionsTabContent.u_vas_poka_net_podpischikov_6c98b691')}
          description={i18nT('shared:components.subscriptions.SubscriptionsTabContent.publikuyte_puteshestviya_chtoby_privlech_pod_921c01f5')}
          variant="empty"
        />
      );
    }

    return (
      <>
        {renderSearchBar()}
        <View style={styles.header}>
          <Text style={styles.subtitle}>
            {subscribers.length}{' '}
            {subscribers.length === 1 ? i18nT('shared:components.subscriptions.SubscriptionsTabContent.podpischik_015c98e8') : subscribers.length < 5 ? i18nT('shared:components.subscriptions.SubscriptionsTabContent.podpischika_5468c76c') : i18nT('shared:components.subscriptions.SubscriptionsTabContent.podpischikov_047f694a')}
          </Text>
        </View>
        {filteredSubscribers.map((profile) => (
          <SubscriberCard
            key={profile.user ?? profile.id}
            profile={profile}
            onMessage={onMessage}
            onOpenProfile={onOpenProfile}
          />
        ))}
        {filteredSubscribers.length === 0 && search.trim() ? (
          <View style={styles.noResults}>
            <Text style={[styles.noResultsText, { color: colors.textMuted }]}>{i18nT('shared:components.subscriptions.SubscriptionsTabContent.nichego_ne_naydeno_bf51f155')}</Text>
          </View>
        ) : null}
      </>
    );
  };

  return (
    <View style={styles.wrapper}>
      {renderTabBar()}
      {isActiveLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primaryDark} />
        </View>
      ) : activeTab === 'subscriptions' ? (
        renderSubscriptionsTab()
      ) : (
        renderSubscribersTab()
      )}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    wrapper: {
      width: '100%',
    },
    header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
    subtitle: { marginTop: 4, fontSize: 13, color: colors.textMuted },
    loadingWrap: { padding: 16, alignItems: 'center', justifyContent: 'center', minHeight: 180 },
    tabBar: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginBottom: 10,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.mutedBackground,
      padding: 4,
    },
    tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: DESIGN_TOKENS.radii.sm },
    tabActive: {
      backgroundColor: colors.surface,
      ...(Platform.OS === 'web' ? WEB_CARD_SHADOW_STYLE : Platform.OS === 'android' ? { elevation: 1 } : {}),
    },
    tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
    tabTextActive: { color: colors.primaryText },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 8,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: 6,
      borderWidth: 1,
      borderRadius: DESIGN_TOKENS.radii.lg,
      gap: DESIGN_TOKENS.spacing.xs,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      ...(Platform.OS === 'web' ? WEB_TEXT_OUTLINE_NONE_STYLE : {}),
    },
    noResults: { paddingVertical: DESIGN_TOKENS.spacing.xl, alignItems: 'center' },
    noResultsText: { fontSize: 14, fontStyle: 'italic' },
  });
