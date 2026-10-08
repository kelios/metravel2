import { searchInputAccessibilityProps } from '@/utils/webProps'
// components/trips/PublicTripsCatalog.tsx
// Каталог публичных поездок «Поехали со мной» (#411): заголовок, дисклеймер,
// фильтры и адаптивная сетка карточек. Featured-поездки идут первыми (#463).
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import EmptyState from '@/components/ui/EmptyState';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { useScreenHeader } from '@/components/layout/ScreenHeaderContext';
import PublicTripCard from '@/components/trips/PublicTripCard';
import PublicTripFilters from '@/components/trips/PublicTripFilters';
import SafetyNotice from '@/components/ui/SafetyNotice';
import type { PublicTrip, PublicTripsFilters } from '@/api/publicTrips';
import { usePublicTrips } from '@/hooks/usePublicTripsApi';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { trackTripCatalogViewed } from '@/utils/tripAnalytics';
import {
  filterPublicTripsBySearch,
  hasActivePublicTripFilters,
  sortPublicTrips,
} from '@/components/trips/publicTripCatalogUtils';
import { translate as i18nT } from '@/i18n'
import { SCREEN_CONTENT_FIRST_PROPS } from '@/utils/screenContentMarker'


const GUTTER = 12;
const MAX_WIDTH = 1100;
const EMPTY_FILTERS: PublicTripsFilters = {};

function columnsFor(width: number): number {
  if (width >= 980) return 3;
  if (width >= 620) return 2;
  return 1;
}

function PublicTripsCatalog() {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [filters, setFilters] = useState<PublicTripsFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const hasActiveFilters = hasActivePublicTripFilters(filters);
  const hasActiveSearch = searchQuery.trim().length > 0;
  // Pending means no confirmed data, including persisted-cache restoration and
  // offline-paused reads. isLoading only covers pending requests already fetching.
  const { data, isPending, isError } = usePublicTrips(filters);
  const { data: allTripsData } = usePublicTrips(EMPTY_FILTERS);

  const trips = useMemo(
    () => sortPublicTrips(filterPublicTripsBySearch(data ?? [], searchQuery)),
    [data, searchQuery],
  );
  const filterOptionTrips = hasActiveFilters ? (allTripsData ?? data ?? []) : (data ?? []);

  useEffect(() => {
    if (data) trackTripCatalogViewed(data.length);
  }, [data]);

  const contentWidth = Math.min(width, MAX_WIDTH) - 32;
  const compactControls = contentWidth < 760;
  const cols = columnsFor(contentWidth);
  const cardWidth = cols === 1 ? undefined : (contentWidth - GUTTER * (cols - 1)) / cols;
  const showControls =
    !isPending &&
    !isError &&
    ((filterOptionTrips.length > 0) || hasActiveFilters || hasActiveSearch);

  const openTrip = (trip: PublicTrip) => router.push(`/trips/${trip.id}`);
  const resetFilters = () => setFilters({});
  const resetSearchAndFilters = () => {
    setSearchQuery('');
    setFilters({});
  };

  const header = useScreenHeader({
    title: i18nT('trips:components.trips.PublicTripsCatalog.poehali_so_mnoy_8297a10d'),
    info: [i18nT('trips:components.trips.PublicTripsCatalog.publichnye_poezdki_ot_drugih_puteshestvennik_facc5972')],
    primaryAction: {
      icon: 'plus',
      label: i18nT('trips:components.trips.PublicTripsCatalog.organizovat_moyu_poezdku_3ee4dcf9'),
      onPress: () => router.push('/trips/plan/create'),
      testID: 'public-trips-organize',
    },
  });

  const controls = (
    <>
      <View
        style={[
          styles.searchBox,
          compactControls ? styles.searchBoxCompact : styles.searchBoxWide,
        ]}
        testID="public-trips-search"
      >
        <Feather name="search" size={17} color={colors.textMuted} />
        <TextInput
            {...searchInputAccessibilityProps()}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={i18nT('trips:components.trips.PublicTripsCatalog.poisk_po_poezdkam_5627fcb8')}
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={i18nT('trips:components.trips.PublicTripsCatalog.poisk_po_poezdkam_5627fcb8')}
          testID="public-trips-search-input"
        />
        {hasActiveSearch ? (
          <Pressable
            onPress={() => setSearchQuery('')}
            style={styles.searchClear}
            accessibilityRole="button"
            accessibilityLabel={i18nT('trips:components.trips.PublicTripsCatalog.ochistit_poisk_3530b329')}
            testID="public-trips-search-clear"
          >
            <Feather name="x" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <PublicTripFilters
        trips={filterOptionTrips}
        value={filters}
        onChange={setFilters}
        hasActive={hasActiveFilters}
        onReset={resetFilters}
      />
    </>
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="public-trips-catalog"
    >
      <View style={styles.inner}>
        <ScreenHeader header={header} />

        <SafetyNotice
          text={i18nT('trips:components.trips.PublicTripsCatalog.metravel_ne_organizuet_poezdki_eto_ploschadk_ef41d388')}
          style={styles.notice}
        />

        {showControls ? (
          compactControls ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.controlsScroller}
              contentContainerStyle={styles.controlsRowMobile}
              testID="public-trips-controls-scroll"
            >
              {controls}
            </ScrollView>
          ) : (
            <View style={styles.controlsRow}>{controls}</View>
          )
        ) : null}

        {isPending ? (
          <View style={styles.center} testID="public-trips-loading">
            <ActivityIndicator color={colors.primaryDark} />
          </View>
        ) : isError ? (
          <Text style={styles.statusText}>{i18nT('trips:components.trips.PublicTripsCatalog.ne_udalos_zagruzit_katalog_poezdok_8ff8ecbf')}</Text>
        ) : trips.length === 0 ? (
          <View {...SCREEN_CONTENT_FIRST_PROPS}>
            <EmptyState
              density="compact"
              variant="search"
              icon={hasActiveFilters || hasActiveSearch ? 'search' : 'compass'}
              title={hasActiveFilters || hasActiveSearch
                ? i18nT('trips:components.trips.PublicTripsCatalog.nichego_ne_naydeno_sbroste_poisk_ili_filtry_06382c80')
                : i18nT('trips:components.trips.PublicTripsCatalog.poka_net_otkrytyh_poezdok_zaglyanite_pozzhe_fdb683cb')}
              action={hasActiveFilters || hasActiveSearch ? {
                label: i18nT('trips:components.trips.PublicTripsCatalog.sbrosit_09d93db0'),
                onPress: resetSearchAndFilters,
                testID: 'public-trips-reset-empty',
              } : undefined}
              testID="public-trips-empty"
            />
          </View>
        ) : (
          <View style={[styles.grid, { gap: GUTTER }]} {...SCREEN_CONTENT_FIRST_PROPS}>
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
    notice: { marginVertical: 2 },
    controlsRow: {
      position: 'relative',
      zIndex: 3,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    controlsScroller: {
      position: 'relative',
      zIndex: 3,
      marginHorizontal: -2,
    },
    controlsRowMobile: {
      position: 'relative',
      zIndex: 3,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingHorizontal: 2,
      paddingBottom: 4,
    },
    searchBox: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
    },
    searchBoxWide: { flex: 1, minWidth: 260 },
    searchBoxCompact: { width: 230 },
    searchInput: {
      flex: 1,
      minWidth: 0,
      fontSize: 15,
      color: colors.text,
      paddingVertical: 9,
      ...Platform.select({ web: { outlineStyle: 'none' } as any }),
    },
    searchClear: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({ web: { cursor: 'pointer' as any } }),
    },
    center: { paddingVertical: 40, alignItems: 'center' },
    statusText: { fontSize: 14, color: colors.textMuted, lineHeight: 20, paddingVertical: 16 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    fullWidth: { width: '100%' },
  });

export default React.memo(PublicTripsCatalog);
