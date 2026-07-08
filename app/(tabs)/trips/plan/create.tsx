import { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import TripCreateForm from '@/components/trips/planning/TripCreateForm';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
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
  const initialValues = useMemo(() => buildTripPlanPrefill(params), [params]);

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
  });
