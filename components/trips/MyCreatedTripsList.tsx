import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import type { PlannedTrip, TripPlanStatus, TripTransport } from '@/api/plannedTrips';
import TripPlanCard from '@/components/trips/planning/TripPlanCard';
import EmptyState from '@/components/ui/EmptyState';
import { TravelListSkeleton } from '@/components/ui/SkeletonLoader';
import {
  PLAN_STATUS_LABEL,
  TRANSPORT_LABEL,
} from '@/components/trips/planning/tripPlanFormatting';
import { useDeletePlannedTrip, useMyPlannedTrips } from '@/hooks/usePlannedTripsApi';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { confirmAction } from '@/utils/confirmAction';
import { showToastMessage } from '@/utils/toast';
import { translate as i18nT } from '@/i18n'
import { createCollator, getFormatLocale } from '@/i18n/format'


type MyTripFilters = {
  status: TripPlanStatus | null;
  transport: TripTransport | null;
  region: string | null;
};

const EMPTY_FILTERS: MyTripFilters = {
  status: null,
  transport: null,
  region: null,
};

const STATUS_ORDER: TripPlanStatus[] = ['planning', 'active', 'completed'];
const TRANSPORT_ORDER: TripTransport[] = ['car', 'public', 'bike', 'foot', 'mixed'];

type Props = {
  role?: 'organized' | 'participating';
};

function MyCreatedTripsList({ role = 'organized' }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<MyTripFilters>(EMPTY_FILTERS);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useMyPlannedTrips();
  const {
    mutate: deleteTrip,
    isPending: isDeletingTrip,
    variables: deletingTripId,
  } = useDeletePlannedTrip();
  const matchingTrips = useMemo(
    () => (data ?? []).filter((trip) => (role === 'organized' ? trip.isOwner : !trip.isOwner)),
    [data, role],
  );
  const regions = useMemo(
    () =>
      Array.from(
        new Set(matchingTrips.map((trip) => trip.region.trim()).filter(Boolean)),
      ).sort(createCollator().compare),
    [matchingTrips],
  );
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase(getFormatLocale());
  const visibleTrips = useMemo(
    () =>
      matchingTrips.filter((trip) => {
        if (filters.status && trip.status !== filters.status) return false;
        if (filters.transport && trip.transport !== filters.transport) return false;
        if (filters.region && trip.region !== filters.region) return false;
        if (!normalizedSearch) return true;

        return [trip.title, trip.description, trip.region]
          .join(' ')
          .toLocaleLowerCase(getFormatLocale())
          .includes(normalizedSearch);
      }),
    [matchingTrips, filters, normalizedSearch],
  );
  const activeFiltersCount = Object.values(filters).filter(Boolean).length;
  const hasActiveControls = activeFiltersCount > 0 || normalizedSearch.length > 0;
  const openTrip = useCallback(
    (trip: PlannedTrip) => {
      router.push(`/trips/plan/${trip.id}`);
    },
    [router],
  );
  const editTrip = useCallback(
    (trip: PlannedTrip) => {
      router.push(`/trips/plan/${trip.id}?edit=1`);
    },
    [router],
  );
  const handleDeleteTrip = useCallback(
    async (trip: PlannedTrip) => {
      const confirmed = await confirmAction({
        title: i18nT('trips:components.trips.MyCreatedTripsList.udalit_poezdku_79cfdd61'),
        message: i18nT('trips:components.trips.MyCreatedTripsList.udalit_poezdku_value1_deystvie_nelzya_otmeni_0f47f75c', { value1: trip.title }),
        confirmText: i18nT('trips:components.trips.MyCreatedTripsList.udalit_637a3cde'),
        cancelText: i18nT('trips:components.trips.MyCreatedTripsList.otmena_3721efb3'),
      });
      if (!confirmed) return;

      deleteTrip(trip.id, {
        onSuccess: () => {
          void showToastMessage({
            type: 'success',
            text1: i18nT('trips:components.trips.MyCreatedTripsList.poezdka_udalena_c7af41b5'),
            text2: i18nT('trips:components.trips.MyCreatedTripsList.spisok_sozdannyh_poezdok_obnovlen_3dafa714'),
          });
        },
        onError: (error) => {
          void showToastMessage({
            type: 'error',
            text1: i18nT('trips:components.trips.MyCreatedTripsList.ne_udalos_udalit_poezdku_a16f2c61'),
            text2: error instanceof Error ? error.message : i18nT('trips:components.trips.MyCreatedTripsList.poprobuyte_esche_raz_pozzhe_0d60ab7c'),
            visibilityTime: 4000,
          });
        },
      });
    },
    [deleteTrip],
  );
  const updateFilter = useCallback(
    <Key extends keyof MyTripFilters>(key: Key, value: MyTripFilters[Key]) => {
      setFilters((current) => ({
        ...current,
        [key]: current[key] === value ? null : value,
      }));
    },
    [],
  );
  const resetControls = useCallback(() => {
    setSearchQuery('');
    setFilters(EMPTY_FILTERS);
  }, []);

  if (isLoading) {
    return (
      <View style={styles.state} testID="my-created-trips-loading">
        <TravelListSkeleton count={2} />
      </View>
    );
  }

  if (isError) {
    return (
      <View testID="my-created-trips-error">
        <EmptyState
          icon="alert-circle"
          title={i18nT('trips:components.trips.MyCreatedTripsList.ne_udalos_zagruzit_poezdki_27f9c8b0')}
          description={i18nT('trips:components.trips.MyCreatedTripsList.proverte_soedinenie_i_poprobuyte_esche_raz_eea10b13')}
          variant="error"
          action={{ label: i18nT('trips:components.trips.MyCreatedTripsList.povtorit_13fe14ba'), onPress: () => void refetch() }}
          iconSize={46}
        />
      </View>
    );
  }

  if (matchingTrips.length === 0) {
    return (
      <View testID="my-created-trips-empty">
        <EmptyState
          icon={role === 'organized' ? 'map' : 'users'}
          title={role === 'organized' ? i18nT('trips:components.trips.MyCreatedTripsList.vy_esche_ne_organizovali_poezdok_f5309bb6') : i18nT('trips:components.trips.MyCreatedTripsList.vy_poka_ne_uchastvuete_v_poezdkah_ee7c708b')}
          description={
            role === 'organized'
              ? i18nT('trips:components.trips.MyCreatedTripsList.sozdayte_marshrut_priglasite_poputchikov_i_u_cc9abb7f')
              : i18nT('trips:components.trips.MyCreatedTripsList.naydite_poezdku_ili_dozhdites_priglasheniya__68ab12f1')
          }
          variant="empty"
          action={{
            label: role === 'organized' ? i18nT('trips:components.trips.MyCreatedTripsList.organizovat_poezdku_1dccaa27') : i18nT('trips:components.trips.MyCreatedTripsList.nayti_poezdku_4bd445a5'),
            onPress: () => router.push(role === 'organized' ? '/trips/plan/create' : '/trips'),
          }}
          secondaryAction={
            role === 'organized'
              ? { label: i18nT('trips:components.trips.MyCreatedTripsList.nayti_poezdku_4bd445a5'), onPress: () => router.push('/trips') }
              : undefined
          }
          iconSize={46}
        />
      </View>
    );
  }

  const search = (
    <View style={styles.searchBox} testID="my-created-trips-search">
      <Feather name="search" size={18} color={colors.textMuted} />
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={role === 'organized' ? i18nT('trips:components.trips.MyCreatedTripsList.poisk_po_moim_poezdkam_22d7088e') : i18nT('trips:components.trips.MyCreatedTripsList.poisk_sredi_poezdok_b0279567')}
        placeholderTextColor={colors.textMuted}
        style={styles.searchInput}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={i18nT('trips:components.trips.MyCreatedTripsList.poisk_po_moim_poezdkam_22d7088e')}
        testID="my-created-trips-search-input"
      />
      {normalizedSearch ? (
        <Pressable
          onPress={() => setSearchQuery('')}
          accessibilityRole="button"
          accessibilityLabel={i18nT('trips:components.trips.MyCreatedTripsList.ochistit_poisk_3b7ef9e3')}
          style={styles.iconControl}
          testID="my-created-trips-search-clear"
        >
          <Feather name="x" size={17} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );

  const filterPanel = (
    <View style={styles.filterPanel} testID="my-created-trips-filters">
      <FilterGroup
        title={i18nT('trips:components.trips.MyCreatedTripsList.status_d25983af')}
        options={STATUS_ORDER.map((status) => ({
          value: status,
          label: PLAN_STATUS_LABEL[status],
        }))}
        selected={filters.status}
        onSelect={(value) => updateFilter('status', value as TripPlanStatus)}
        colors={colors}
        styles={styles}
      />
      <FilterGroup
        title={i18nT('trips:components.trips.MyCreatedTripsList.transport_8b5762aa')}
        options={TRANSPORT_ORDER.map((transport) => ({
          value: transport,
          label: TRANSPORT_LABEL[transport],
        }))}
        selected={filters.transport}
        onSelect={(value) => updateFilter('transport', value as TripTransport)}
        colors={colors}
        styles={styles}
      />
      {regions.length > 0 ? (
        <FilterGroup
          title={i18nT('trips:components.trips.MyCreatedTripsList.mesto_be05be32')}
          options={regions.map((region) => ({ value: region, label: region }))}
          selected={filters.region}
          onSelect={(value) => updateFilter('region', value)}
          colors={colors}
          styles={styles}
        />
      ) : null}
      {hasActiveControls ? (
        <Pressable
          onPress={resetControls}
          accessibilityRole="button"
          style={styles.resetButton}
          testID="my-created-trips-reset"
        >
          <Feather name="rotate-ccw" size={15} color={colors.primaryDark} />
          <Text style={styles.resetText}>{i18nT('trips:components.trips.MyCreatedTripsList.sbrosit_5f0c9428')}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={styles.catalog} testID="my-created-trips-list">
      {!isDesktop ? (
        <View style={styles.mobileControls}>
          <View style={styles.mobileSearch}>{search}</View>
          <Pressable
            onPress={() => setMobileFiltersOpen((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={i18nT('trips:components.trips.MyCreatedTripsList.filtry_poezdok_644757e4')}
            accessibilityState={{ expanded: mobileFiltersOpen }}
            style={[styles.filterToggle, mobileFiltersOpen && styles.filterToggleActive]}
            testID="my-created-trips-filter-toggle"
          >
            <Feather name="filter" size={19} color={colors.text} />
            {activeFiltersCount > 0 ? (
              <View style={styles.filterCount}>
                <Text style={styles.filterCountText}>{activeFiltersCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      ) : null}

      {!isDesktop && mobileFiltersOpen ? filterPanel : null}

      <View style={styles.catalogBody}>
        {isDesktop ? (
          <View style={styles.sidebar}>
            {search}
            {filterPanel}
          </View>
        ) : null}

        <View style={styles.results}>
          {visibleTrips.length === 0 ? (
            <View style={styles.filteredEmpty} testID="my-created-trips-filtered-empty">
              <Text style={styles.empty}>{i18nT('trips:components.trips.MyCreatedTripsList.po_zadannym_usloviyam_poezdok_ne_naydeno_3fa7da64')}</Text>
              <Pressable
                onPress={resetControls}
                accessibilityRole="button"
                style={styles.resetButton}
              >
                <Feather name="rotate-ccw" size={15} color={colors.primaryDark} />
                <Text style={styles.resetText}>{i18nT('trips:components.trips.MyCreatedTripsList.sbrosit_poisk_i_filtry_47e5797b')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.grid}>
              {visibleTrips.map((trip) => (
                <View key={trip.id} style={isDesktop ? styles.gridItemDesktop : styles.gridItemMobile}>
                  <TripPlanCard
                    trip={trip}
                    onOpenPress={openTrip}
                    onEditPress={role === 'organized' ? editTrip : undefined}
                    onDeletePress={role === 'organized' ? handleDeleteTrip : undefined}
                    isDeleting={isDeletingTrip && String(deletingTripId) === String(trip.id)}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

type FilterGroupProps = {
  title: string;
  options: Array<{ value: string; label: string }>;
  selected: string | null;
  onSelect: (value: string) => void;
  colors: ThemedColors;
  styles: ReturnType<typeof createStyles>;
};

function FilterGroup({ title, options, selected, onSelect, colors, styles }: FilterGroupProps) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterTitle}>{title}</Text>
      <View style={styles.filterOptions}>
        {options.map((option) => {
          const isSelected = selected === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onSelect(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={[styles.filterOption, isSelected && styles.filterOptionSelected]}
              testID={`my-created-trips-filter-${option.value}`}
            >
              <Text
                style={[styles.filterOptionText, isSelected && styles.filterOptionTextSelected]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
              {isSelected ? <Feather name="check" size={15} color={colors.primaryDark} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    catalog: { width: '100%', gap: 12 },
    catalogBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
    sidebar: { width: 260, flexShrink: 0, gap: 12 },
    results: { flex: 1, minWidth: 0 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    gridItemDesktop: { width: '48.8%', minWidth: 0 },
    gridItemMobile: { width: '100%' },
    mobileControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    mobileSearch: { flex: 1, minWidth: 0 },
    searchBox: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      fontSize: 15,
      color: colors.text,
      paddingVertical: 10,
    },
    iconControl: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterToggle: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    filterToggleActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    filterCount: {
      position: 'absolute',
      top: -5,
      right: -5,
      minWidth: 19,
      height: 19,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 4,
    },
    filterCountText: { fontSize: 11, fontWeight: '800', color: colors.textOnPrimary },
    filterPanel: {
      gap: 14,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: colors.surface,
      padding: 14,
    },
    filterGroup: { gap: 8 },
    filterTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
    filterOptions: { gap: 5 },
    filterOption: {
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      borderRadius: 10,
      paddingHorizontal: 10,
      backgroundColor: colors.background,
    },
    filterOptionSelected: { backgroundColor: colors.primarySoft },
    filterOptionText: { flex: 1, minWidth: 0, fontSize: 14, color: colors.textSecondary },
    filterOptionTextSelected: { color: colors.primaryDark, fontWeight: '700' },
    resetButton: {
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    resetText: { fontSize: 13, fontWeight: '700', color: colors.primaryDark },
    filteredEmpty: { gap: 10, alignItems: 'flex-start' },
    state: { width: '100%' },
    empty: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
    error: { fontSize: 14, lineHeight: 20, color: colors.danger, fontWeight: '600' },
  });

export default React.memo(MyCreatedTripsList);
