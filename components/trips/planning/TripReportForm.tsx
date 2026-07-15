// components/trips/planning/TripReportForm.tsx
// Пост-отчёт о поездке (Sprint 14, FE-trip-report): организатор завершает поездку,
// описывает её и при желании публикует маршрут в каталог сообщества. Бэкенд
// /complete/ хранит только summary, visited_place_ids и publish_to_catalog —
// фото/GPX требуют asset-id, которых фронт пока не умеет создавать, поэтому форма
// их не собирает (отправляем photoUrls: [] и gpxUrl: null). Если отчёт уже
// опубликован — показываем read-only карточку вместо формы.
import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { fetchPlacesCatalog } from '@/api/places';
import Button from '@/components/ui/Button';
import type { PlannedTrip, SubmitReportInput } from '@/api/plannedTrips';
import { useSubmitTripReport } from '@/hooks/usePlannedTripsApi';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import type { CatalogPlace } from '@/utils/placesCatalog';
import { translate as i18nT } from '@/i18n'
import { formatDate } from '@/i18n/format'


interface Props {
  trip: PlannedTrip;
}

const SUMMARY_MIN = 10;
const PLACE_SEARCH_MIN = 2;
const PLACE_SEARCH_LIMIT = 8;

type SelectedPlace = {
  id: number;
  title: string;
  meta: string;
};

const formatPublishedAt = (value: string | null): string | null => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return formatDate(d);
};

const parsePlaceId = (value: string): number | null => {
  const id = Number(value);
  return Number.isInteger(id) && Number.isFinite(id) ? id : null;
};

const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error != null &&
  'name' in error &&
  (error as { name?: unknown }).name === 'AbortError';

const formatPlaceMeta = (place: CatalogPlace): string =>
  [place.country, place.category].filter(Boolean).join(' · ');

const toSelectedPlace = (place: CatalogPlace): SelectedPlace | null => {
  const id = parsePlaceId(place.id);
  if (id == null) return null;
  return {
    id,
    title: place.title,
    meta: formatPlaceMeta(place),
  };
};

const buildInitialVisitedPlaces = (trip: PlannedTrip): SelectedPlace[] => {
  const byId = new Map<number, SelectedPlace>();
  trip.route.forEach((point) => {
    if (point.placeId == null || byId.has(point.placeId)) return;
    byId.set(point.placeId, {
      id: point.placeId,
      title: point.name,
      meta: i18nT('trips:components.trips.planning.TripReportForm.iz_marshruta_poezdki_6b47c647'),
    });
  });
  return [...byId.values()];
};

function TripReportForm({ trip }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const submit = useSubmitTripReport();

  const [summary, setSummary] = useState('');
  const [placeQuery, setPlaceQuery] = useState('');
  const deferredPlaceQuery = useDeferredValue(placeQuery);
  const [placeResults, setPlaceResults] = useState<SelectedPlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [selectedPlaces, setSelectedPlaces] = useState<SelectedPlace[]>(() =>
    buildInitialVisitedPlaces(trip),
  );
  const [publishToCommunity, setPublishToCommunity] = useState(false);
  const [touched, setTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedPlaceIds = useMemo(
    () => new Set(selectedPlaces.map((place) => place.id)),
    [selectedPlaces],
  );

  useEffect(() => {
    const query = deferredPlaceQuery.trim();
    if (query.length < PLACE_SEARCH_MIN) {
      setPlaceResults([]);
      setPlacesLoading(false);
      setPlacesError(null);
      return;
    }

    const controller = new AbortController();
    setPlacesLoading(true);
    setPlacesError(null);

    fetchPlacesCatalog(
      { page: 1, perPage: PLACE_SEARCH_LIMIT, q: query },
      controller.signal,
    )
      .then((page) => {
        setPlaceResults(
          page.places
            .map(toSelectedPlace)
            .filter((place): place is SelectedPlace => place != null),
        );
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        setPlaceResults([]);
        setPlacesError(i18nT('trips:components.trips.planning.TripReportForm.ne_udalos_zagruzit_mesta_7fc2f242'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setPlacesLoading(false);
      });

    return () => controller.abort();
  }, [deferredPlaceQuery]);

  const addPlace = useCallback((place: SelectedPlace) => {
    setSelectedPlaces((current) =>
      current.some((item) => item.id === place.id) ? current : [...current, place],
    );
    setPlaceQuery('');
    setPlaceResults([]);
  }, []);

  const removePlace = useCallback((id: number) => {
    setSelectedPlaces((current) => current.filter((place) => place.id !== id));
  }, []);

  if (!trip.isOwner) return null;

  if (trip.report?.published) {
    const report = trip.report;
    const publishedAt = formatPublishedAt(report.publishedAt);
    return (
      <View style={styles.wrap} testID="trip-report-form">
        <View style={styles.publishedHead}>
          <Feather name="check-circle" size={18} color={colors.primaryDark} />
          <Text style={styles.heading}>{i18nT('trips:components.trips.planning.TripReportForm.otchet_opublikovan_100bebe9')}</Text>
        </View>
        {report.summary ? (
          <Text style={styles.summaryText}>{report.summary}</Text>
        ) : null}
        {trip.publishedToCommunity ? (
          <Text style={styles.note}>{i18nT('trips:components.trips.planning.TripReportForm.marshrut_dobavlen_v_katalog_soobschestva_f666e7fa')}</Text>
        ) : null}
        {publishedAt ? (
          <Text style={styles.hint}>{i18nT('trips:components.trips.planning.TripReportForm.opublikovano_012a83fe')}{publishedAt}</Text>
        ) : null}
      </View>
    );
  }

  const trimmedSummary = summary.trim();
  const summaryTooShort = trimmedSummary.length < SUMMARY_MIN;
  const disabled = summaryTooShort || submit.isPending;

  const handleSubmit = () => {
    setTouched(true);
    setSubmitError(null);
    if (summaryTooShort) return;
    const input: SubmitReportInput = {
      tripId: trip.id,
      summary: trimmedSummary,
      photoUrls: [],
      gpxUrl: null,
      visitedPlaceIds: selectedPlaces.map((place) => place.id),
      publishToCommunity,
    };
    submit.mutate(input, {
      onError: () =>
        setSubmitError(i18nT('trips:components.trips.planning.TripReportForm.ne_udalos_sohranit_otchet_poprobuyte_esche_r_3e5c63e5')),
    });
  };

  return (
    <View style={styles.wrap} testID="trip-report-form">
      <Text style={styles.heading}>{i18nT('trips:components.trips.planning.TripReportForm.otchet_o_poezdke_78b8bc4f')}</Text>

      <Text style={styles.label}>{i18nT('trips:components.trips.planning.TripReportForm.kak_vse_proshlo_203d70b5')}</Text>
      <TextInput
        value={summary}
        onChangeText={setSummary}
        placeholder={i18nT('trips:components.trips.planning.TripReportForm.rasskazhite_kak_proshla_poezdka_chto_zapomni_9974174e')}
        placeholderTextColor={colors.textMuted}
        multiline
        style={styles.textArea}
        testID="trip-report-summary"
      />
      {touched && summaryTooShort ? (
        <Text style={styles.error}>
          {i18nT('trips:components.trips.planning.TripReportForm.opishite_poezdku_ne_koroche_fcdd6901')}{SUMMARY_MIN} {i18nT('trips:components.trips.planning.TripReportForm.simvolov_f0f55dc2')}</Text>
      ) : null}

      <Text style={styles.label}>{i18nT('trips:components.trips.planning.TripReportForm.poseschennye_mesta_metravel_c389926f')}</Text>
      {selectedPlaces.length > 0 ? (
        <View style={styles.selectedPlaces} testID="trip-report-selected-places">
          {selectedPlaces.map((place) => (
            <Pressable
              key={place.id}
              onPress={() => removePlace(place.id)}
              style={styles.selectedPlaceChip}
              accessibilityRole="button"
              accessibilityLabel={i18nT('trips:components.trips.planning.TripReportForm.ubrat_mesto_value1_d09e3102', { value1: place.title })}
              testID={`trip-report-selected-place-${place.id}`}
            >
              <Text style={styles.selectedPlaceText} numberOfLines={1}>
                {place.title}
              </Text>
              <Feather name="x" size={14} color={colors.textSecondary} />
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.hint}>{i18nT('trips:components.trips.planning.TripReportForm.dobavte_mesta_kotorye_realno_posetili_v_etoy_c911cba7')}</Text>
      )}
      <TextInput
        value={placeQuery}
        onChangeText={setPlaceQuery}
        placeholder={i18nT('trips:components.trips.planning.TripReportForm.nayti_mesto_po_nazvaniyu_ili_adresu_9c08a100')}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="sentences"
        style={styles.input}
        testID="trip-report-place-search"
      />
      {placeQuery.trim().length > 0 ? (
        <View style={styles.placeResults} testID="trip-report-place-results">
          {placeQuery.trim().length < PLACE_SEARCH_MIN ? (
            <Text style={styles.hint}>{i18nT('trips:components.trips.planning.TripReportForm.vvedite_minimum_f0e4805a')}{PLACE_SEARCH_MIN} {i18nT('trips:components.trips.planning.TripReportForm.simvola_1599ea15')}</Text>
          ) : placesLoading ? (
            <Text style={styles.hint}>{i18nT('trips:components.trips.planning.TripReportForm.ischem_mesta_d6e33a69')}</Text>
          ) : placesError ? (
            <Text style={styles.error}>{placesError}</Text>
          ) : placeResults.length === 0 ? (
            <Text style={styles.hint}>{i18nT('trips:components.trips.planning.TripReportForm.mesta_ne_naydeny_24356913')}</Text>
          ) : (
            placeResults.map((place) => {
              const selected = selectedPlaceIds.has(place.id);
              return (
                <Pressable
                  key={place.id}
                  onPress={() => addPlace(place)}
                  disabled={selected}
                  style={[styles.placeOption, selected && styles.placeOptionSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: selected }}
                  testID={`trip-report-place-option-${place.id}`}
                >
                  <Feather
                    name={selected ? 'check-circle' : 'plus-circle'}
                    size={16}
                    color={selected ? colors.primaryDark : colors.textSecondary}
                  />
                  <View style={styles.placeOptionText}>
                    <Text style={styles.placeOptionTitle} numberOfLines={1}>
                      {place.title}
                    </Text>
                    {place.meta ? (
                      <Text style={styles.placeOptionMeta} numberOfLines={1}>
                        {place.meta}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}

      <Pressable
        onPress={() => setPublishToCommunity((prev) => !prev)}
        style={[styles.toggle, publishToCommunity && styles.toggleActive]}
        testID="trip-report-publish-toggle"
      >
        {publishToCommunity ? (
          <Feather name="check" size={16} color={colors.primaryDark} />
        ) : null}
        <Text style={[styles.toggleText, publishToCommunity && styles.toggleTextActive]}>
          {i18nT('trips:components.trips.planning.TripReportForm.opublikovat_marshrut_v_katalog_soobschestva_24060767')}</Text>
      </Pressable>

      {submitError ? (
        <Text style={styles.error} testID="trip-report-error">
          {submitError}
        </Text>
      ) : null}

      <Button
        label={i18nT('trips:components.trips.planning.TripReportForm.zavershit_poezdku_i_opublikovat_otchet_acc78409')}
        onPress={handleSubmit}
        loading={submit.isPending}
        disabled={disabled}
        fullWidth
        testID="trip-report-submit"
      />
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: 10 },
    publishedHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    heading: { fontSize: 18, fontWeight: '700', color: colors.text },
    label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 4 },
    summaryText: { fontSize: 14, color: colors.text, lineHeight: 20 },
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
    textArea: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      backgroundColor: colors.surface,
      fontSize: 14,
      minHeight: 96,
      textAlignVertical: 'top',
      ...Platform.select({ web: { outlineWidth: 0 as any } }),
    },
    selectedPlaces: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    selectedPlaceChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: '100%',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.surfaceMuted,
    },
    selectedPlaceText: {
      flexShrink: 1,
      fontSize: 13,
      color: colors.text,
      fontWeight: '600',
    },
    placeResults: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    placeOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      ...Platform.select({ web: { cursor: 'pointer' as any } }),
    },
    placeOptionSelected: {
      backgroundColor: colors.surfaceMuted,
    },
    placeOptionText: { flex: 1, minWidth: 0 },
    placeOptionTitle: { fontSize: 14, color: colors.text, fontWeight: '600' },
    placeOptionMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      marginTop: 4,
    },
    toggleActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceMuted,
    },
    toggleText: { flex: 1, fontSize: 14, color: colors.textSecondary },
    toggleTextActive: { color: colors.primaryText, fontWeight: '600' },
    note: { fontSize: 13, color: colors.text, fontWeight: '600' },
    hint: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
    error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  });

export default React.memo(TripReportForm);
