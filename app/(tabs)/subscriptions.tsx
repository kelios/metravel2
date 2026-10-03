import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSubscriptionsData, type SubscriptionTab } from '@/hooks/useSubscriptionsData';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import SubscriptionsTabContent from '@/components/subscriptions/SubscriptionsTabContent';
import EmptyState from '@/components/ui/EmptyState';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { useIsScreenHeaderMobile, useScreenHeader } from '@/components/layout/ScreenHeaderContext';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { buildLoginHref } from '@/utils/authNavigation';
import { webTouchScrollStyle } from '@/utils';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl } from '@/utils/seo';
import { translate as i18nT } from '@/i18n'


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
  const header = useScreenHeader({ title: i18nT('shared:app.tabs.subscriptions.podpiski_f7c35e01') });

  // --- Loading / Auth guards ---

  const isHeaderMobile = useIsScreenHeaderMobile();
  const headerBlock = isHeaderMobile ? null : (
    <View style={styles.header}>
      <ScreenHeader header={header} />
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
          density="full"
          icon="users"
          title={i18nT('shared:app.tabs.subscriptions.voydite_v_akkaunt_7e11548a')}
          description={i18nT('shared:app.tabs.subscriptions.voydite_chtoby_podpisyvatsya_na_avtorov_i_vi_d8ff462f')}
          action={{
            label: i18nT('shared:app.tabs.subscriptions.voyti_c82fbbc5'),
            onPress: () => pushRoute(buildLoginHref({ redirect: '/subscriptions', intent: 'subscriptions' })),
          }}
        />
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <InstantSEO
        headKey="subscriptions" title={i18nT('shared:app.tabs.subscriptions.podpiski_metravel_956320db')}
        description={i18nT('shared:app.tabs.subscriptions.vashi_podpiski_i_podpischiki_f4b680c1')}
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
    loadingWrap: { padding: 16, alignItems: 'center', justifyContent: 'center', flex: 1 },
  });
