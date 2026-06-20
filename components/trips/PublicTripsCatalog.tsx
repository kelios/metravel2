// components/trips/PublicTripsCatalog.tsx
// Каталог публичных поездок «Поехали со мной» (#411): заголовок, дисклеймер,
// фильтры и адаптивная сетка карточек. Featured-поездки идут первыми (#463).
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';

import PublicTripCard from '@/components/trips/PublicTripCard';
import PublicTripFilters from '@/components/trips/PublicTripFilters';
import SafetyNotice from '@/components/ui/SafetyNotice';
import type { PublicTrip, PublicTripsFilters } from '@/api/publicTrips';
import { usePublicTrips } from '@/hooks/usePublicTripsApi';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { trackTripCatalogViewed } from '@/utils/tripAnalytics';

const GUTTER = 12;
const MAX_WIDTH = 1100;

function columnsFor(width: number): number {
  if (width >= 980) return 3;
  if (width >= 620) return 2;
  return 1;
}

/** Featured вперёд, затем по дате старта. */
function sortTrips(trips: PublicTrip[]): PublicTrip[] {
  return [...trips].sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return a.startDate.localeCompare(b.startDate);
  });
}

function PublicTripsCatalog() {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [filters, setFilters] = useState<PublicTripsFilters>({});
  const { data, isLoading, isError } = usePublicTrips(filters);

  const trips = useMemo(() => sortTrips(data ?? []), [data]);

  useEffect(() => {
    if (data) trackTripCatalogViewed(data.length);
  }, [data]);

  const contentWidth = Math.min(width, MAX_WIDTH) - 32;
  const cols = columnsFor(contentWidth);
  const cardWidth = cols === 1 ? undefined : (contentWidth - GUTTER * (cols - 1)) / cols;

  const openTrip = (trip: PublicTrip) => router.push(`/trips/${trip.id}`);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="public-trips-catalog"
    >
      <View style={styles.inner}>
        <Text style={styles.h1}>Поехали со мной</Text>
        <Text style={styles.subtitle}>
          Публичные поездки от других путешественников. Нашли компанию по душе —
          подайте заявку «Хочу поехать».
        </Text>

        <SafetyNotice
          text="MeTravel не организует поездки — это площадка для поиска попутчиков. Будьте внимательны при договорённостях и обмене контактами."
          style={styles.notice}
        />

        {!isLoading && !isError && (data?.length ?? 0) > 0 ? (
          <PublicTripFilters trips={data ?? []} value={filters} onChange={setFilters} />
        ) : null}

        {isLoading ? (
          <View style={styles.center} testID="public-trips-loading">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : isError ? (
          <Text style={styles.empty}>Не удалось загрузить каталог поездок.</Text>
        ) : trips.length === 0 ? (
          <Text style={styles.empty} testID="public-trips-empty">
            Под выбранные фильтры поездок нет. Сбросьте фильтры или загляните позже.
          </Text>
        ) : (
          <View style={[styles.grid, { gap: GUTTER }]}>
            {trips.map((trip) => (
              <View key={trip.id} style={cardWidth ? { width: cardWidth } : styles.fullWidth}>
                <PublicTripCard trip={trip} onPress={openTrip} width={cardWidth} />
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, alignItems: 'center' },
    inner: { width: '100%', maxWidth: MAX_WIDTH, gap: 12 },
    h1: { fontSize: 26, fontWeight: '800', color: colors.text },
    subtitle: { fontSize: 15, lineHeight: 21, color: colors.textSecondary },
    notice: { marginVertical: 2 },
    center: { paddingVertical: 40, alignItems: 'center' },
    empty: { fontSize: 14, color: colors.textMuted, lineHeight: 20, paddingVertical: 16 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    fullWidth: { width: '100%' },
  });

export default React.memo(PublicTripsCatalog);
