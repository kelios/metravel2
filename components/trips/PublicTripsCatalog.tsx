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

import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
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
  const [introExpanded, setIntroExpanded] = useState(false);
  const hasActiveFilters = hasActivePublicTripFilters(filters);
  const hasActiveSearch = searchQuery.trim().length > 0;
  const { data, isLoading, isError } = usePublicTrips(filters);
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
  const compactIntro = contentWidth < 620;
  const compactControls = contentWidth < 760;
  const showFullIntro = !compactIntro || introExpanded;
  const cols = columnsFor(contentWidth);
  const cardWidth = cols === 1 ? undefined : (contentWidth - GUTTER * (cols - 1)) / cols;
  const showControls =
    !isLoading &&
    !isError &&
    ((filterOptionTrips.length > 0) || hasActiveFilters || hasActiveSearch);

  const openTrip = (trip: PublicTrip) => router.push(`/trips/${trip.id}`);
  const goBack = () => {
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
      return;
    }
    router.push('/');
  };
  const resetFilters = () => setFilters({});
  const resetSearchAndFilters = () => {
    setSearchQuery('');
    setFilters({});
  };

  const organizeAction = compactIntro ? (
    <IconButton
      icon={<Feather name="plus" size={18} color={colors.text} />}
      label={i18nT('trips:components.trips.PublicTripsCatalog.organizovat_moyu_poezdku_3ee4dcf9')}
      onPress={() => router.push('/trips/plan/create')}
      size="md"
      style={styles.organizeIconBtn}
      testID="public-trips-organize"
    />
  ) : (
    <Button
      label={i18nT('trips:components.trips.PublicTripsCatalog.organizovat_moyu_poezdku_3ee4dcf9')}
      onPress={() => router.push('/trips/plan/create')}
      icon={<Feather name="plus" size={16} color={colors.textOnPrimary} />}
      size="md"
      style={styles.organizeBtn}
      testID="public-trips-organize"
    />
  );

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
        <View style={styles.breadcrumbBar} testID="public-trips-breadcrumbs">
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel={i18nT('trips:components.trips.PublicTripsCatalog.nazad_b4ee6b82')}
            style={styles.backCrumb}
            testID="public-trips-back"
          >
            <Feather name="arrow-left" size={15} color={colors.primaryText} />
            <Text style={styles.backCrumbText}>{i18nT('trips:components.trips.PublicTripsCatalog.nazad_b4ee6b82')}</Text>
          </Pressable>
          <View style={styles.crumbTrail}>
            <Pressable
              onPress={() => router.push('/')}
              accessibilityRole="button"
              accessibilityLabel={i18nT('trips:components.trips.PublicTripsCatalog.pereyti_na_glavnuyu_d0724ffd')}
              style={styles.crumbItem}
            >
              <Feather name="home" size={13} color={colors.textMuted} />
              <Text style={styles.crumbText}>{i18nT('trips:components.trips.PublicTripsCatalog.glavnaya_ed2e490e')}</Text>
            </Pressable>
            <Feather name="chevron-right" size={14} color={colors.textMuted} />
            <Text style={styles.crumbCurrent} numberOfLines={1}>
              {i18nT('trips:components.trips.PublicTripsCatalog.poehali_so_mnoy_8297a10d')}</Text>
          </View>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.h1}>{i18nT('trips:components.trips.PublicTripsCatalog.poehali_so_mnoy_8297a10d')}</Text>
          {organizeAction}
        </View>

        <SafetyNotice
          text={i18nT('trips:components.trips.PublicTripsCatalog.metravel_ne_organizuet_poezdki_eto_ploschadk_ef41d388')}
          style={styles.notice}
        />

        {showFullIntro ? (
          <Text style={styles.subtitle}>
            {i18nT('trips:components.trips.PublicTripsCatalog.publichnye_poezdki_ot_drugih_puteshestvennik_facc5972')}</Text>
        ) : null}

        {compactIntro ? (
          <Pressable
            onPress={() => setIntroExpanded((v) => !v)}
            style={styles.introToggle}
            accessibilityRole="button"
            accessibilityLabel={introExpanded ? i18nT('trips:components.trips.PublicTripsCatalog.skryt_vvodnuyu_informatsiyu_14678353') : i18nT('trips:components.trips.PublicTripsCatalog.pokazat_informatsiyu_o_poezdkah_81e78d07')}
            testID="public-trips-intro-toggle"
          >
            <Feather name={introExpanded ? 'chevron-up' : 'info'} size={15} color={colors.primaryText} />
            <Text style={styles.introToggleText}>
              {introExpanded ? i18nT('trips:components.trips.PublicTripsCatalog.skryt_3d16fdf4') : i18nT('trips:components.trips.PublicTripsCatalog.o_poezdkah_f75b4cd6')}
            </Text>
          </Pressable>
        ) : null}

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

        {isLoading ? (
          <View style={styles.center} testID="public-trips-loading">
            <ActivityIndicator color={colors.primaryDark} />
          </View>
        ) : isError ? (
          <Text style={styles.empty}>{i18nT('trips:components.trips.PublicTripsCatalog.ne_udalos_zagruzit_katalog_poezdok_8ff8ecbf')}</Text>
        ) : trips.length === 0 ? (
          <View style={styles.emptyBox} testID="public-trips-empty">
            <Text style={styles.empty}>
              {hasActiveFilters || hasActiveSearch
                ? i18nT('trips:components.trips.PublicTripsCatalog.nichego_ne_naydeno_sbroste_poisk_ili_filtry_06382c80')
                : i18nT('trips:components.trips.PublicTripsCatalog.poka_net_otkrytyh_poezdok_zaglyanite_pozzhe_fdb683cb')}
            </Text>
            {hasActiveFilters || hasActiveSearch ? (
              <Button
                label={i18nT('trips:components.trips.PublicTripsCatalog.sbrosit_09d93db0')}
                variant="secondary"
                size="sm"
                onPress={resetSearchAndFilters}
                testID="public-trips-reset-empty"
              />
            ) : null}
          </View>
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
    breadcrumbBar: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      flexWrap: 'wrap',
    },
    backCrumb: {
      minHeight: 32,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
      ...Platform.select({ web: { cursor: 'pointer' as any } }),
    },
    backCrumbText: { fontSize: 13, fontWeight: '700', color: colors.primaryText },
    crumbTrail: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 1,
      minWidth: 0,
    },
    crumbItem: {
      minHeight: 30,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      ...Platform.select({ web: { cursor: 'pointer' as any } }),
    },
    crumbText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
    crumbCurrent: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: 13,
      color: colors.text,
      fontWeight: '700',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    h1: { fontSize: 26, fontWeight: '800', color: colors.text },
    subtitle: { fontSize: 15, lineHeight: 21, color: colors.textSecondary },
    organizeBtn: { flexShrink: 0, marginVertical: 0 },
    organizeIconBtn: { flexShrink: 0, marginHorizontal: 0 },
    introToggle: {
      alignSelf: 'flex-start',
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
      ...Platform.select({ web: { cursor: 'pointer' as any } }),
    },
    introToggleText: { fontSize: 13, fontWeight: '700', color: colors.primaryText },
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
      minHeight: 42,
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
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({ web: { cursor: 'pointer' as any } }),
    },
    center: { paddingVertical: 40, alignItems: 'center' },
    empty: { fontSize: 14, color: colors.textMuted, lineHeight: 20, paddingVertical: 16 },
    emptyBox: { alignItems: 'flex-start', gap: 8 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    fullWidth: { width: '100%' },
  });

export default React.memo(PublicTripsCatalog);
