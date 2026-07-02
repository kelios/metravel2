import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform,
  ScrollView,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSubscriptionsData, type SubscriptionTab } from '@/hooks/useSubscriptionsData';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import SubscriptionsTabContent from '@/components/subscriptions/SubscriptionsTabContent';
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

export default function SubscriptionsScreen() {
  // Android: hardware Back возвращает на предыдущий экран (Профиль), а не
  // сбрасывает Tab-навигатор на главную. Хук гейтит по Platform.OS === 'android'.
  useAndroidBackHandler();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const pushRoute = useCallback((href: string) => { router.push(href as Href); }, [router]);
  useResponsive();
  const colors = useThemedColors();
  const styles = useMemo(() => createPageStyles(colors), [colors]);
  const initialTab: SubscriptionTab = params.tab === 'subscribers' ? 'subscribers' : 'subscriptions';
  const [activeTab, setActiveTab] = useState<SubscriptionTab>(initialTab);

  useEffect(() => {
    setActiveTab(params.tab === 'subscribers' ? 'subscribers' : 'subscriptions');
  }, [params.tab]);

  const {
    isAuthenticated, authReady,
    subscriptions, subscribers, authors,
    subscriptionsLoading, subscribersLoading,
    getFullName, handleUnsubscribe,
  } = useSubscriptionsData({ includeAuthorTravels: true });

  const handleMessage = useCallback((userId: number) => { pushRoute(`/messages?userId=${encodeURIComponent(userId)}`); }, [pushRoute]);
  const handleOpenTravel = useCallback((url: string) => { pushRoute(url); }, [pushRoute]);
  const handleOpenProfile = useCallback((userId: number) => { pushRoute(`/user/${userId}`); }, [pushRoute]);
  const handleFindTravels = useCallback(() => { pushRoute('/search'); }, [pushRoute]);
  const handleBackToProfile = useCallback(() => { router.back(); }, [router]);

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
          accessibilityLabel="Назад"
          {...Platform.select({ web: { cursor: 'pointer' } })}
        >
          <Feather name="arrow-left" size={16} color={colors.primary} />
          <Text style={styles.backToProfileButtonText}>Назад</Text>
        </Pressable>
      </View>
    </View>
  );

  if (!authReady) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
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
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
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


  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <InstantSEO
        headKey="subscriptions" title="Подписки | Metravel"
        description="Ваши подписки и подписчики"
        canonical={buildCanonicalUrl('/subscriptions')} robots="noindex, nofollow"
      />
      <ScrollView
        style={webTouchScrollStyle}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {headerBlock}
        <SubscriptionsTabContent
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          subscriptions={subscriptions}
          subscribers={subscribers}
          authors={authors}
          subscriptionsLoading={subscriptionsLoading}
          subscribersLoading={subscribersLoading}
          getFullName={getFullName}
          handleUnsubscribe={handleUnsubscribe}
          onMessage={handleMessage}
          onOpenTravel={handleOpenTravel}
          onOpenProfile={handleOpenProfile}
          onFindTravels={handleFindTravels}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const createPageStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: {
      paddingTop: 8,
      paddingBottom: Platform.OS === 'web' ? 120 : 32,
    },
    header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
    headerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
    headerTitleBlock: { flex: 1 },
    title: { fontSize: 20, fontWeight: '700', color: colors.text },
    subtitle: { marginTop: 4, fontSize: 13, color: colors.textMuted },
    loadingWrap: { padding: 16, alignItems: 'center', justifyContent: 'center', flex: 1 },
    backToProfileButton: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 12, paddingVertical: 10, borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.surface, minHeight: 40,
    },
    backToProfileButtonText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  });
