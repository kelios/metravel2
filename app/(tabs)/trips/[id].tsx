import React, { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import PublicTripDetail from '@/components/trips/PublicTripDetail';
import TripsPageSeo from '@/components/trips/TripsPageSeo';
import { useHydrationReady } from '@/hooks/useHydrationReady';
import { useSoftKeyboardInset } from '@/hooks/useSoftKeyboardInset';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

// Мобильный BottomDock — fixed-оверлей, поэтому скролл резервирует его высоту
// (`--mt-dock-h` = 0px на desktop). Иначе кнопка «Отправить заявку» формы
// «Хочу поехать» прячется под доком.
export const TRIP_DETAIL_WEB_BOTTOM_RESERVE =
  'calc(max(var(--mt-dock-h, 0px), var(--mt-keyboard-inset, 0px)) + 24px)' as unknown as number;

export default function TripDetailScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ id?: string }>();
  const hydrationReady = useHydrationReady();
  const tripId = hydrationReady ? Number(params.id) : Number.NaN;
  // Поддерживает --mt-keyboard-inset через visualViewport на mobile web.
  useSoftKeyboardInset();

  return (
    <>
      <TripsPageSeo
        canonicalPath={Number.isFinite(tripId) ? `/trips/${tripId}` : '/trips'}
        fallbackTitle="publicTrip"
      />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.inner}>
          {Number.isFinite(tripId) ? (
            <PublicTripDetail tripId={tripId} />
          ) : (
            <View style={styles.center}>
              <ActivityIndicator />
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: {
      padding: 16,
      paddingBottom: TRIP_DETAIL_WEB_BOTTOM_RESERVE,
      alignItems: 'center',
    },
    inner: { width: '100%', maxWidth: 760 },
    center: { paddingVertical: 48, alignItems: 'center' },
  });
