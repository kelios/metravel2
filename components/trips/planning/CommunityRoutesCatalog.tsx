// components/trips/planning/CommunityRoutesCatalog.tsx
// Каталог опубликованных маршрутов сообщества (FE-community-routes): фильтр по
// транспорту и региону над списком готовых маршрутов от путешественников.
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { CommunityTripsFilters, TripTransport } from '@/api/plannedTrips';
import {
  TRANSPORT_ICON_NAME,
  TRANSPORT_LABEL,
} from '@/components/trips/planning/tripPlanFormatting';
import TripPlanCard from '@/components/trips/planning/TripPlanCard';
import EmptyState from '@/components/ui/EmptyState';
import { useCommunityTrips } from '@/hooks/usePlannedTripsApi';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


interface Props {
  initialTransport?: TripTransport;
}

const TRANSPORT_OPTIONS: TripTransport[] = ['car', 'bike', 'foot', 'public', 'mixed'];

function CommunityRoutesCatalog({ initialTransport }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [transport, setTransport] = useState<TripTransport | null>(
    initialTransport ?? null,
  );
  const [region, setRegion] = useState('');

  const filters = useMemo<CommunityTripsFilters>(() => {
    const next: CommunityTripsFilters = {};
    if (transport) next.transport = transport;
    const trimmedRegion = region.trim();
    if (trimmedRegion) next.region = trimmedRegion;
    return next;
  }, [transport, region]);

  const { data: trips, isLoading, isError } = useCommunityTrips(filters);

  return (
    <View style={styles.wrap} testID="community-routes">
      <Text style={styles.heading}>{i18nT('trips:components.trips.planning.CommunityRoutesCatalog.marshruty_soobschestva_6c6daddb')}</Text>
      <Text style={styles.subtitle}>
        {i18nT('trips:components.trips.planning.CommunityRoutesCatalog.gotovye_marshruty_opublikovannye_puteshestve_a7db6ef1')}</Text>

      <View style={styles.chips}>
        <Pressable
          onPress={() => setTransport(null)}
          style={[styles.chip, transport === null && styles.chipActive]}
          testID="community-filter-transport-all"
        >
          <Text
            numberOfLines={1}
            textBreakStrategy="simple"
            style={[styles.chipText, transport === null && styles.chipTextActive]}
          >
            {i18nT('trips:components.trips.planning.CommunityRoutesCatalog.vse_730ac669')}</Text>
        </Pressable>
        {TRANSPORT_OPTIONS.map((option) => {
          const active = transport === option;
          return (
            <Pressable
              key={option}
              onPress={() => setTransport(option)}
              style={[styles.chip, active && styles.chipActive]}
              testID={`community-filter-transport-${option}`}
            >
              <Feather
                name={TRANSPORT_ICON_NAME[option] as never}
                size={13}
                color={active ? colors.primary : colors.textSecondary}
              />
              <Text
                numberOfLines={1}
                textBreakStrategy="simple"
                style={[styles.chipText, active && styles.chipTextActive]}
              >
                {TRANSPORT_LABEL[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        value={region}
        onChangeText={setRegion}
        placeholder={i18nT('trips:components.trips.planning.CommunityRoutesCatalog.region_po_zhelaniyu_aa0b5cef')}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        testID="community-filter-region"
      />

      {isLoading ? (
        <ActivityIndicator
          color={colors.primaryDark}
          style={styles.loader}
          testID="community-routes-loading"
        />
      ) : isError ? (
        <Text style={styles.error} testID="community-routes-error">
          {i18nT('trips:components.trips.planning.CommunityRoutesCatalog.ne_udalos_zagruzit_marshruty_3a9c6311')}</Text>
      ) : !trips || trips.length === 0 ? (
        <EmptyState
          icon="map"
          variant="empty"
          title={i18nT('trips:components.trips.planning.CommunityRoutesCatalog.poka_pusto_8a0cf737')}
          description={i18nT('trips:components.trips.planning.CommunityRoutesCatalog.poka_net_opublikovannyh_marshrutov_1bd320e1')}
        />
      ) : (
        <View style={styles.list}>
          {trips.map((trip) => (
            <TripPlanCard key={trip.id} trip={trip} />
          ))}
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 12 },
    heading: { fontSize: 18, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 14, color: colors.textSecondary },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceMuted,
    },
    // #672: базовый вес '600' — на Android normal-weight текст в чипе меряется
    // Yoga уже, чем рендерится, и лейбл обрезается. Вес 600 меряется корректно.
    chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    chipTextActive: { color: colors.primaryText, fontWeight: '600' },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      backgroundColor: colors.surface,
      fontSize: 14,
      ...Platform.select({ web: { outlineWidth: 0 as any } }),
    },
    list: { gap: 12 },
    loader: { marginTop: 24 },
    error: { color: colors.danger, fontSize: 13, fontWeight: '600', marginTop: 12 },
  });

export default React.memo(CommunityRoutesCatalog);
