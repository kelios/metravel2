import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import Button from '@/components/ui/Button';
import TripPlanCard from '@/components/trips/planning/TripPlanCard';
import TripPlanningEmptyState from '@/components/trips/planning/TripPlanningEmptyState';
import { useMyPlannedTrips } from '@/hooks/usePlannedTripsApi';
import { useAuthStore } from '@/stores/authStore';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { buildLoginHref } from '@/utils/authNavigation';

export default function PlannedTripsScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: trips, isLoading, isError } = useMyPlannedTrips();

  const goCreate = () => router.push('/trips/plan/create');

  if (!isAuthenticated) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.inner}>
          <Text style={styles.h1}>Планирование поездок</Text>
          <Text style={styles.lead}>
            <Text
              accessibilityRole="link"
              onPress={() => router.push(buildLoginHref({ redirect: '/trips/plan' }) as never)}
              style={styles.loginLink}
              testID="plan-login-link"
            >
              Войдите
            </Text>
            , чтобы планировать поездки, собирать попутчиков и публиковать маршруты.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <Text style={styles.h1}>Мои поездки</Text>
          <Pressable
            onPress={() => router.push('/trips/community')}
            style={styles.communityLink}
            testID="plan-community-link"
          >
            <Feather name="compass" size={14} color={colors.primaryDark} />
            <Text style={styles.communityLinkText}>Маршруты сообщества</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator style={styles.loader} />
        ) : isError ? (
          <Text style={styles.error}>Не удалось загрузить поездки.</Text>
        ) : trips && trips.length > 0 ? (
          <>
            <Button
              label="Запланировать поездку"
              onPress={goCreate}
              fullWidth
              testID="plan-create-cta"
            />
            <View style={styles.list}>
              {trips.map((trip) => (
                <TripPlanCard key={trip.id} trip={trip} />
              ))}
            </View>
          </>
        ) : (
          <TripPlanningEmptyState onCreate={goCreate} />
        )}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, alignItems: 'center' },
    inner: { width: '100%', maxWidth: 760, gap: 14 },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
    },
    h1: { fontSize: 26, fontWeight: '800', color: colors.text },
    lead: { fontSize: 15, color: colors.textSecondary, lineHeight: 21 },
    loginLink: { color: colors.primaryText, fontWeight: '700', textDecorationLine: 'underline' },
    communityLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    communityLinkText: { fontSize: 14, fontWeight: '600', color: colors.primaryText },
    list: { gap: 10 },
    loader: { marginVertical: 24 },
    error: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  });
