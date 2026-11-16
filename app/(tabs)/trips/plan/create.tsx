import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import TripCreateForm from '@/components/trips/planning/TripCreateForm';
import TripsPageSeo from '@/components/trips/TripsPageSeo';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/authStore';
import { buildLoginHref } from '@/utils/authNavigation';
import { useTripPlannerAnalytics } from '@/hooks/useTripPlannerAnalytics';
import { buildTripPlanPrefill } from '@/utils/tripPlanLinks';
import { clearTripPlanDraft, loadTripPlanDraft, TRIP_PLAN_DRAFT_SOURCE, type TripPlanDraft } from '@/utils/tripPlanDraft';
import { buildTripPlanPrefillFromDraft, buildTripPlanRoutePrefill, draftRoutePoints } from '@/utils/tripPlanDraftIntake';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { useScreenHeader } from '@/components/layout/ScreenHeaderContext';
import { asBottomDimension, useScrollBottomPadding } from '@/components/layout/bottomChromeInset';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { translate as i18nT } from '@/i18n'
import { routeMetadata } from '@/utils/seoRoutes/routeMetadata'
import { getTripsRouteSeo } from '@/components/trips/TripsPageSeo'

// Article clicks reuse the router's existing async root instead of adding a
// journey-runtime root to the entry chunk's global loader metadata.
export { beginTripPlannerEntry } from '@/utils/tripPlannerAnalytics';

export default function CreateTripScreen() {
  return (
    <>
      <TripsPageSeo
        fallbackTitle="create"
      />
      <CreateTripScreenContent />
    </>
  );
}

function CreateTripScreenContent() {
  const colors = useThemedColors();
  const scrollBottomReserve = useScrollBottomPadding(DESIGN_TOKENS.spacing.xl);
  const styles = useMemo(() => createStyles(colors, scrollBottomReserve), [colors, scrollBottomReserve]);
  const router = useRouter();
  const params = useLocalSearchParams();
  const authReady = useAuthStore((s) => s.authReady);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // #3298: вход с черновиком плана ассистента — в адресе только идентификатор, сам план читается из
  // хранилища. Форма берёт начальные значения один раз, поэтому рисуется после чтения черновика.
  const draftId = params.source === TRIP_PLAN_DRAFT_SOURCE && typeof params.draft === 'string' ? params.draft : '';
  const [draft, setDraft] = useState<TripPlanDraft | null | undefined>(draftId ? undefined : null);
  // Черновик вошедшего принимается только им самим, гостевой — всеми; читаем после восстановления сессии,
  // иначе свой черновик выглядел бы чужим и удалялся.
  const viewer = useAuthStore((s) => (s.isAuthenticated && s.userId ? s.userId : null));
  useEffect(() => {
    let active = true;
    if (!draftId) {
      setDraft(null);
      return undefined;
    }
    setDraft(undefined);
    if (!authReady) return undefined;
    void loadTripPlanDraft(draftId, viewer).then((loaded) => {
      if (active) setDraft(loaded);
    });
    return () => {
      active = false;
    };
  }, [authReady, draftId, viewer]);
  const initialValues = useMemo(() => (draft ? buildTripPlanPrefillFromDraft(draft) : buildTripPlanPrefill(params)), [draft, params]);
  // Точки маршрута: черновик плана либо одна точка материала из параметров ссылки (#3416 п.1).
  const routeDraft = useMemo(() => (draft ? draftRoutePoints(draft.points) : buildTripPlanRoutePrefill(params)), [draft, params]);
  const formParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === 'planner_entry') continue;
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string') formParams.set(key, first);
  }
  const formHref = `/trips/plan/create${formParams.size ? `?${formParams.toString()}` : ''}`;
  const plannerEntryId = useTripPlannerAnalytics(formHref, authReady, isAuthenticated, draft !== undefined);
  const loginRedirect = formHref;
  const header = useScreenHeader({
    title: i18nT('trips:components.trips.planning.TripCreateForm.novaya_poezdka_1901be53'),
  });

  if (!authReady || (isAuthenticated && draft === undefined)) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={[styles.inner, styles.state]}>
          <ActivityIndicator color={colors.primaryDark} testID="trip-create-auth-loading" />
        </View>
      </ScrollView>
    );
  }

  if (!isAuthenticated) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={[styles.inner, styles.state]} testID="trip-create-auth-gate">
          <Text style={styles.h1}>{i18nT('trips:app.tabs.trips.plan.create.voydite_v_akkaunt_ec929ad4')}</Text>
          <Text style={styles.lead}>
            <Text
              accessibilityRole="link"
              onPress={() =>
                router.push(
                  buildLoginHref({
                    redirect: loginRedirect,
                    intent: 'plan-trip',
                  }) as never,
                )
              }
              style={styles.loginLink}
              testID="trip-create-login-link"
            >
              {i18nT('trips:app.tabs.trips.plan.create.voydite_2712f737')}</Text>
            {i18nT('trips:app.tabs.trips.plan.create.chtoby_sozdavat_poezdki_sobirat_poputchikov__7e4752ea')}</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.inner}>
        <ScreenHeader header={header} />
        <TripCreateForm
          plannerEntryId={plannerEntryId}
          initialValues={initialValues}
          routeDraft={routeDraft}
          onCreated={(trip, routeSaved) => {
            if (routeSaved) void clearTripPlanDraft(draftId);
            router.replace(`/trips/plan/${trip.id}`);
          }}
        />
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemedColors, scrollBottomReserve: number | string) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: asBottomDimension(scrollBottomReserve),
      alignItems: 'center',
    },
    inner: { width: '100%', maxWidth: 640, gap: 14 },
    state: { gap: 14 },
    h1: { fontSize: 26, fontWeight: '800', color: colors.text },
    lead: { fontSize: 15, color: colors.textSecondary, lineHeight: 21 },
    loginLink: { color: colors.primaryText, fontWeight: '700', textDecorationLine: 'underline' },
  });

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); строки те же, что у экрана
export function generateMetadata() {
  const seo = getTripsRouteSeo('create')
  return routeMetadata({
    title: seo.title,
    description: i18nT('seoStatic:root.default.description'),
    canonical: seo.canonicalPath,
    ogType: 'website',
  })
}
