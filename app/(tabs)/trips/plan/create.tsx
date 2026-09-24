import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import TripCreateForm from '@/components/trips/planning/TripCreateForm';
import TripsPageSeo from '@/components/trips/TripsPageSeo';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/authStore';
import { buildLoginHref } from '@/utils/authNavigation';
import { buildTripPlanPrefill } from '@/utils/tripPlanLinks';
import { asBottomDimension, useScrollBottomPadding } from '@/components/layout/bottomChromeInset';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { translate as i18nT } from '@/i18n'

export default function CreateTripScreen() {
  return (
    <>
      <TripsPageSeo
        canonicalPath="/trips/plan/create"
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
  const initialValues = useMemo(() => buildTripPlanPrefill(params), [params]);

  if (!authReady) {
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
                    redirect: '/trips/plan/create',
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
        <TripCreateForm
          initialValues={initialValues}
          onCreated={(trip) => router.replace(`/trips/plan/${trip.id}`)}
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
    inner: { width: '100%', maxWidth: 640 },
    state: { gap: 14 },
    h1: { fontSize: 26, fontWeight: '800', color: colors.text },
    lead: { fontSize: 15, color: colors.textSecondary, lineHeight: 21 },
    loginLink: { color: colors.primaryText, fontWeight: '700', textDecorationLine: 'underline' },
  });
