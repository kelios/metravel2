import { useMemo } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import TripCreateForm from '@/components/trips/planning/TripCreateForm';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/authStore';
import { buildLoginHref } from '@/utils/authNavigation';
import { buildTripPlanPrefill } from '@/utils/tripPlanLinks';
import { LAYOUT } from '@/constants/layout';
import { DESIGN_TOKENS } from '@/constants/designSystem';

// Reserve space for the bottom tab bar / web dock so the last form control
// (the "Запланировать поездку" submit button) is never hidden behind it.
const SCROLL_BOTTOM_RESERVE = Platform.select({
  web: 'calc(var(--mt-dock-h, 0px) + 24px)' as unknown as number,
  default: (LAYOUT?.tabBarHeight ?? 56) + DESIGN_TOKENS.spacing.xl,
});

export default function CreateTripScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
          <Text style={styles.h1}>Войдите в аккаунт</Text>
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
              Войдите
            </Text>
            , чтобы создавать поездки, собирать попутчиков и сохранять маршрут.
          </Text>
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

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: SCROLL_BOTTOM_RESERVE,
      alignItems: 'center',
    },
    inner: { width: '100%', maxWidth: 640 },
    state: { gap: 14 },
    h1: { fontSize: 26, fontWeight: '800', color: colors.text },
    lead: { fontSize: 15, color: colors.textSecondary, lineHeight: 21 },
    loginLink: { color: colors.primaryText, fontWeight: '700', textDecorationLine: 'underline' },
  });
