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
  const showFullIntro = !compactIntro || introExpanded;
  const cols = columnsFor(contentWidth);
  const cardWidth = cols === 1 ? undefined : (contentWidth - GUTTER * (cols - 1)) / cols;
  const showControls =
    !isLoading &&
    !isError &&
    ((filterOptionTrips.length > 0) || hasActiveFilters || hasActiveSearch);

  const openTrip = (trip: PublicTrip) => router.push(`/trips/${trip.id}`);
  const resetFilters = () => setFilters({});
  const resetSearchAndFilters = () => {
    setSearchQuery('');
    setFilters({});
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="public-trips-catalog"
    >
      <View style={styles.inner}>
        <Text style={styles.h1}>Поехали со мной</Text>
        {showFullIntro ? (
          <Text style={styles.subtitle}>
            Публичные поездки от других путешественников. Нашли компанию по душе —
            подайте заявку «Хочу поехать». Или организуйте свою и найдите попутчиков.
          </Text>
        ) : null}

        <View style={compactIntro ? styles.mobileActions : styles.desktopActions}>
          <Button
            label={compactIntro ? 'Организовать поездку' : 'Организовать свою поездку'}
            onPress={() => router.push('/trips/plan/create')}
            icon={<Feather name="plus" size={16} color={colors.textOnPrimary} />}
            size={compactIntro ? 'sm' : 'md'}
            style={styles.organizeBtn}
            testID="public-trips-organize"
          />
          {compactIntro ? (
            <Pressable
              onPress={() => setIntroExpanded((v) => !v)}
              style={styles.introToggle}
              accessibilityRole="button"
              accessibilityLabel={introExpanded ? 'Скрыть вводную информацию' : 'Показать информацию о безопасности'}
              testID="public-trips-intro-toggle"
            >
              <Feather name={introExpanded ? 'chevron-up' : 'info'} size={15} color={colors.primaryDark} />
              <Text style={styles.introToggleText}>
                {introExpanded ? 'Скрыть' : 'О поездках'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {showFullIntro ? (
          <SafetyNotice
            text="MeTravel не организует поездки — это площадка для поиска попутчиков. Будьте внимательны при договорённостях и обмене контактами."
            style={styles.notice}
          />
        ) : null}

        {showControls ? (
          <View style={styles.searchBox} testID="public-trips-search">
            <Feather name="search" size={17} color={colors.textMuted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Поиск по поездкам"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Поиск по поездкам"
              testID="public-trips-search-input"
            />
            {hasActiveSearch ? (
              <Pressable
                onPress={() => setSearchQuery('')}
                style={styles.searchClear}
                accessibilityRole="button"
                accessibilityLabel="Очистить поиск"
                testID="public-trips-search-clear"
              >
                <Feather name="x" size={16} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {showControls ? (
          <PublicTripFilters
            trips={filterOptionTrips}
            value={filters}
            onChange={setFilters}
            hasActive={hasActiveFilters}
            onReset={resetFilters}
          />
        ) : null}

        {isLoading ? (
          <View style={styles.center} testID="public-trips-loading">
            <ActivityIndicator color={colors.primaryDark} />
          </View>
        ) : isError ? (
          <Text style={styles.empty}>Не удалось загрузить каталог поездок.</Text>
        ) : trips.length === 0 ? (
          <View style={styles.emptyBox} testID="public-trips-empty">
            <Text style={styles.empty}>
              {hasActiveFilters || hasActiveSearch
                ? 'Ничего не найдено. Сбросьте поиск или фильтры.'
                : 'Пока нет открытых поездок. Загляните позже.'}
            </Text>
            {hasActiveFilters || hasActiveSearch ? (
              <Button
                label="Сбросить"
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
    h1: { fontSize: 26, fontWeight: '800', color: colors.text },
    subtitle: { fontSize: 15, lineHeight: 21, color: colors.textSecondary },
    organizeBtn: { alignSelf: 'flex-start', marginVertical: 2 },
    desktopActions: { alignItems: 'flex-start' },
    mobileActions: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    introToggle: {
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
    introToggleText: { fontSize: 13, fontWeight: '700', color: colors.primaryDark },
    notice: { marginVertical: 2 },
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
