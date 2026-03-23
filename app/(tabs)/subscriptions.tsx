import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, Pressable, Platform,
  ScrollView, ActivityIndicator, TextInput, type TextStyle, type ViewStyle,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter, type Href } from 'expo-router';

import { useSubscriptionsData, type SubscriptionTab } from '@/hooks/useSubscriptionsData';
import AuthorCard from '@/components/subscriptions/AuthorCard';
import SubscriberCard from '@/components/subscriptions/SubscriberCard';
import EmptyState from '@/components/ui/EmptyState';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { buildLoginHref } from '@/utils/authNavigation';
import { webTouchScrollStyle } from '@/utils';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl } from '@/utils/seo';

type WebEnhancedViewStyle = ViewStyle & { boxShadow?: string; cursor?: 'pointer' };
type WebEnhancedTextStyle = TextStyle & { outlineStyle?: 'none' };

const WEB_CARD_SHADOW_STYLE: WebEnhancedViewStyle = { boxShadow: DESIGN_TOKENS.shadows.card };
const WEB_TEXT_OUTLINE_NONE_STYLE = { outlineStyle: 'none' } as WebEnhancedTextStyle;

export default function SubscriptionsScreen() {
  const router = useRouter();
  const pushRoute = useCallback((href: string) => { router.push(href as Href); }, [router]);
  useResponsive();
  const colors = useThemedColors();
  const styles = useMemo(() => createPageStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<SubscriptionTab>('subscriptions');
  const [search, setSearch] = useState('');

  const {
    isAuthenticated, authReady,
    subscriptions, subscribers, authors,
    subscriptionsLoading, subscribersLoading,
    getFullName, handleUnsubscribe,
  } = useSubscriptionsData();

  const handleMessage = useCallback((userId: number) => { pushRoute(`/messages?userId=${encodeURIComponent(userId)}`); }, [pushRoute]);
  const handleOpenTravel = useCallback((url: string) => { pushRoute(url); }, [pushRoute]);
  const handleOpenProfile = useCallback((userId: number) => { pushRoute(`/user/${userId}`); }, [pushRoute]);
  const handleBackToProfile = useCallback(() => { pushRoute('/profile'); }, [pushRoute]);

  const filteredAuthors = useMemo(() => {
    if (!search.trim()) return authors;
    const q = search.trim().toLowerCase();
    return authors.filter((a) => getFullName(a.profile).includes(q));
  }, [authors, search, getFullName]);

  const filteredSubscribers = useMemo(() => {
    if (!search.trim()) return subscribers;
    const q = search.trim().toLowerCase();
    return subscribers.filter((p) => getFullName(p).includes(q));
  }, [subscribers, search, getFullName]);

  // --- Loading / Auth guards ---

  const headerBlock = (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.title}>Подписки</Text>
          <Text style={styles.subtitle}>Профиль</Text>
        </View>
        <Pressable
          style={[styles.backToProfileButton, globalFocusStyles.focusable]}
          onPress={handleBackToProfile}
          accessibilityRole="button"
          accessibilityLabel="Перейти в профиль"
          {...Platform.select({ web: { cursor: 'pointer' } })}
        >
          <Feather name="user" size={16} color={colors.primary} />
          <Text style={styles.backToProfileButtonText}>В профиль</Text>
        </Pressable>
      </View>
    </View>
  );

  if (!authReady) {
    return (
      <SafeAreaView style={styles.container}>
        {headerBlock}
        <View style={styles.loadingWrap}>
          {Array.from({ length: 2 }).map((_, i) => (
            <SkeletonLoader key={i} width="100%" height={200} borderRadius={12} style={{ marginBottom: 14 }} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="users"
          title="Войдите в аккаунт"
          description="Войдите, чтобы подписываться на авторов и видеть их путешествия."
          action={{
            label: 'Войти',
            onPress: () => pushRoute(buildLoginHref({ redirect: '/subscriptions', intent: 'subscriptions' })),
          }}
        />
      </SafeAreaView>
    );
  }

  const isActiveLoading = activeTab === 'subscriptions' ? subscriptionsLoading : subscribersLoading;

  if (isActiveLoading) {
    return (
      <SafeAreaView style={styles.container}>
        {headerBlock}
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // --- Tab bar + search ---

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      {(['subscriptions', 'subscribers'] as const).map((tab) => {
        const isActive = activeTab === tab;
        const count = tab === 'subscriptions' ? subscriptions.length : subscribers.length;
        const label = tab === 'subscriptions' ? 'Подписки' : 'Подписчики';
        return (
          <Pressable
            key={tab}
            style={[styles.tab, isActive && styles.tabActive, globalFocusStyles.focusable]}
            onPress={() => setActiveTab(tab)}
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

  const renderSearchBar = () => (
    <View style={[styles.searchContainer, { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderLight }]}>
      <Feather name="search" size={16} color={colors.textMuted} />
      <TextInput
        style={[styles.searchInput, { color: colors.text }]}
        value={search}
        onChangeText={setSearch}
        placeholder="Поиск по имени..."
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Поиск по подпискам"
      />
      {search.length > 0 && (
        <Pressable onPress={() => setSearch('')} accessibilityLabel="Очистить поиск">
          <Feather name="x" size={16} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );

  // --- Tab content ---

  const renderSubscriptionsTab = () => {
    if (subscriptions.length === 0) {
      return (
        <EmptyState
          icon="users" title="Вы ещё ни на кого не подписаны"
          description="Подпишитесь на авторов, чтобы видеть их путешествия здесь."
          variant="empty"
          action={{ label: 'Найти путешествия', onPress: () => router.push('/search') }}
        />
      );
    }
    return (
      <>
        {renderSearchBar()}
        <View style={styles.header}>
          <Text style={styles.subtitle}>
            {subscriptions.length}{' '}
            {subscriptions.length === 1 ? 'автор' : subscriptions.length < 5 ? 'автора' : 'авторов'}
          </Text>
        </View>
        {filteredAuthors.map((author) => (
          <AuthorCard
            key={author.profile.user ?? author.profile.id}
            author={author}
            onUnsubscribe={handleUnsubscribe}
            onMessage={handleMessage}
            onOpenTravel={handleOpenTravel}
            onOpenProfile={handleOpenProfile}
          />
        ))}
        {filteredAuthors.length === 0 && search.trim() && (
          <View style={styles.noResults}>
            <Text style={[styles.noResultsText, { color: colors.textMuted }]}>Ничего не найдено</Text>
          </View>
        )}
      </>
    );
  };

  const renderSubscribersTab = () => {
    if (subscribers.length === 0) {
      return (
        <EmptyState
          icon="users" title="У вас пока нет подписчиков"
          description="Публикуйте путешествия, чтобы привлечь подписчиков."
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
            {subscribers.length === 1 ? 'подписчик' : subscribers.length < 5 ? 'подписчика' : 'подписчиков'}
          </Text>
        </View>
        {filteredSubscribers.map((profile) => (
          <SubscriberCard
            key={profile.user ?? profile.id}
            profile={profile}
            onMessage={handleMessage}
            onOpenProfile={handleOpenProfile}
          />
        ))}
        {filteredSubscribers.length === 0 && search.trim() && (
          <View style={styles.noResults}>
            <Text style={[styles.noResultsText, { color: colors.textMuted }]}>Ничего не найдено</Text>
          </View>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <InstantSEO
        headKey="subscriptions" title="Подписки | Metravel"
        description="Ваши подписки и подписчики"
        canonical={buildCanonicalUrl('/subscriptions')} robots="noindex, nofollow"
      />
      <ScrollView style={webTouchScrollStyle} contentContainerStyle={styles.scrollContent}>
        {headerBlock}
        {renderTabBar()}
        {activeTab === 'subscriptions' ? renderSubscriptionsTab() : renderSubscribersTab()}
      </ScrollView>
    </SafeAreaView>
  );
}

const createPageStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingBottom: 32 },
    header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
    headerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
    headerTitleBlock: { flex: 1 },
    title: { fontSize: 20, fontWeight: '700', color: colors.text },
    subtitle: { marginTop: 4, fontSize: 13, color: colors.textMuted },
    loadingWrap: { padding: 16, alignItems: 'center', justifyContent: 'center', flex: 1 },
    tabBar: {
      flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
      borderRadius: DESIGN_TOKENS.radii.md, backgroundColor: colors.mutedBackground, padding: 4,
    },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: DESIGN_TOKENS.radii.sm },
    tabActive: {
      backgroundColor: colors.surface,
      ...(Platform.OS === 'web' ? WEB_CARD_SHADOW_STYLE : Platform.OS === 'android' ? { elevation: 1 } : {}),
    },
    tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
    tabTextActive: { color: colors.primary },
    searchContainer: {
      flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8,
      paddingHorizontal: DESIGN_TOKENS.spacing.md, paddingVertical: DESIGN_TOKENS.spacing.xs,
      borderWidth: 1, borderRadius: DESIGN_TOKENS.radii.lg, gap: DESIGN_TOKENS.spacing.xs,
    },
    searchInput: {
      flex: 1, fontSize: 14, paddingVertical: DESIGN_TOKENS.spacing.xs,
      ...(Platform.OS === 'web' ? WEB_TEXT_OUTLINE_NONE_STYLE : {}),
    },
    noResults: { paddingVertical: DESIGN_TOKENS.spacing.xl, alignItems: 'center' },
    noResultsText: { fontSize: 14, fontStyle: 'italic' },
    backToProfileButton: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 12, paddingVertical: 10, borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.surface, minHeight: 40,
    },
    backToProfileButtonText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  });
