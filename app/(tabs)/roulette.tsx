import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions, Pressable, FlatList, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';

import InstantSEO from '@/components/seo/InstantSEO';
import ModernFilters from '@/components/listTravel/ModernFilters';
import SearchAndFilterBar from '@/components/listTravel/SearchAndFilterBar';
import RenderTravelItem from '@/components/listTravel/RenderTravelItem';
import UIButton from '@/components/ui/Button';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useListTravelFilters } from '@/components/listTravel/hooks/useListTravelFilters';
import { useRandomTravelData } from '@/components/listTravel/hooks/useListTravelData';
import { normalizeApiResponse, deduplicateTravels } from '@/components/listTravel/utils/listTravelHelpers';
import { fetchAllCountries, fetchAllFiltersOptimized } from '@/src/api/miscOptimized';
import type { Travel } from '@/src/types/types';
import type { FilterOptions } from '@/components/listTravel/utils/listTravelTypes';

const palette = DESIGN_TOKENS.colors;

function shuffleTravels(items: Travel[]): Travel[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function RouletteScreen() {
  const pathname = usePathname();
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const isMobile = width <= 768;

  const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';
  const canonical = useMemo(() => `${SITE}${pathname || '/roulette'}`, [SITE, pathname]);

  const title = 'Случайный маршрут | Metravel';
  const description = 'Не знаешь, куда поехать? Подбери фильтры — и мы случайно предложим три маршрута под твои пожелания.';

  // Фоновые изображения (карта и компас) из корневого assets/travel
  // Относительный путь: from app/(tabs)/roulette.tsx -> ../../assets/travel/
  const mapBackground = require('../../assets/travel/roulette-map-bg.jpg');
  const compassBackground = require('../../assets/travel/roulette-compass-bg.jpg');

  const { data: rawOptions, isLoading: filtersLoading } = useQuery({
    queryKey: ['filter-options'],
    queryFn: fetchAllFiltersOptimized,
    staleTime: 10 * 60 * 1000,
  });

  const options: FilterOptions | undefined = useMemo(() => {
    if (!rawOptions) return undefined;
    const transformed: FilterOptions = {
      countries: rawOptions.countries || [],
    } as FilterOptions;

    const stringArrayFields = [
      'categories',
      'categoryTravelAddress',
      'transports',
      'companions',
      'complexity',
      'month',
      'over_nights_stay',
    ] as const;

    stringArrayFields.forEach((field) => {
      const value = (rawOptions as any)[field];
      if (Array.isArray(value)) {
        (transformed as any)[field] = value.map((item: any) => {
          if (item && typeof item === 'object' && 'id' in item && 'name' in item) {
            return item;
          }
          return {
            id: String(item),
            name: String(item),
          };
        });
      }
    });

    return transformed;
  }, [rawOptions]);

  const [defaultCountries, setDefaultCountries] = useState<number[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadDefaultCountries = async () => {
      try {
        const all = await fetchAllCountries();
        if (!Array.isArray(all)) return;
        let belarusId: number | null = null;
        let polandId: number | null = null;
        all.forEach((country: any) => {
          const name = String(country?.name || country?.title || '').toLowerCase();
          const idRaw = country?.id ?? country?.pk;
          const id = typeof idRaw === 'number' ? idRaw : Number(String(idRaw).trim());
          if (!Number.isFinite(id)) return;
          if (!belarusId && (name.includes('беларус') || name.includes('belarus'))) {
            belarusId = id;
          }
          if (!polandId && (name.includes('польш') || name.includes('poland'))) {
            polandId = id;
          }
        });
        const result: number[] = [];
        if (belarusId != null) result.push(belarusId);
        if (polandId != null && polandId !== belarusId) result.push(polandId);
        if (!cancelled && result.length > 0) {
          setDefaultCountries(result);
        }
      } catch (e) {
        if (!cancelled) {
          setDefaultCountries(null);
        }
      }
    };
    loadDefaultCountries();
    return () => {
      cancelled = true;
    };
  }, []);

  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const {
    filter,
    queryParams,
    resetFilters,
    onSelect,
    applyFilter,
  } = useListTravelFilters({
    options,
    isMeTravel: false,
    isExport: false,
    isTravelBy: false,
    userId: null,
  });

  const filterGroups = useMemo(() => [
    {
      key: 'countries',
      title: 'Страны',
      options: (options?.countries || []).map((country: any) => ({
        id: String(country.country_id ?? country.id),
        name: country.title_ru || country.name,
      })),
      multiSelect: true,
      icon: 'globe',
    },
    {
      key: 'categories',
      title: 'Категории',
      options: (options?.categories || []).map((cat: any) => ({
        id: String(cat.id),
        name: cat.name,
        count: undefined,
      })),
      multiSelect: true,
      icon: 'tag',
    },
    {
      key: 'transports',
      title: 'Транспорт',
      options: (options?.transports || []).map((t: any) => ({
        id: String(t.id),
        name: t.name,
      })),
      multiSelect: true,
      icon: 'truck',
    },
    {
      key: 'categoryTravelAddress',
      title: 'Объекты',
      options: (options?.categoryTravelAddress || []).map((obj: any) => ({
        id: String(obj.id),
        name: obj.name,
      })),
      multiSelect: true,
      icon: 'map-pin',
    },
    {
      key: 'companions',
      title: 'Спутники',
      options: (options?.companions || []).map((c: any) => ({
        id: String(c.id),
        name: c.name,
      })),
      multiSelect: true,
      icon: 'users',
    },
    {
      key: 'complexity',
      title: 'Сложность',
      options: (options?.complexity || []).map((item: any) => ({
        id: String(item.id),
        name: item.name,
      })),
      multiSelect: true,
      icon: 'activity',
    },
    {
      key: 'month',
      title: 'Месяц',
      options: (options?.month || []).map((item: any) => ({
        id: String(item.id),
        name: item.name,
      })),
      multiSelect: true,
      icon: 'calendar',
    },
    {
      key: 'over_nights_stay',
      title: 'Ночлег',
      options: (options?.over_nights_stay || []).map((item: any) => ({
        id: String(item.id),
        name: item.name,
      })),
      multiSelect: true,
      icon: 'moon',
    },
  ], [options]);

  const rouletteQueryParams = useMemo(() => {
    const base = { ...queryParams };
    if (!base.countries || !Array.isArray(base.countries) || base.countries.length === 0) {
      if (defaultCountries && defaultCountries.length > 0) {
        base.countries = defaultCountries;
      }
    }
    return base;
  }, [queryParams, defaultCountries]);

  const activeFiltersCount = useMemo(() => {
    const technicalKeys = new Set(['publish', 'moderation']);
    return Object.keys(rouletteQueryParams).filter((key) => !technicalKeys.has(key)).length;
  }, [rouletteQueryParams]);

  const filtersSummary = useMemo(() => {
    const count = activeFiltersCount;
    const countryIds = (rouletteQueryParams.countries as number[] | undefined) || [];

    if (options && Array.isArray((options as any).countries) && countryIds.length > 0) {
      const list = (options as any).countries as any[];
      const first = list.find((c) => String(c.id) === String(countryIds[0]));
      if (first) {
        if (countryIds.length > 1) {
          return `${first.name} и ещё ${countryIds.length - 1}`;
        }
        return String(first.name);
      }
    }

    if (count > 0) return `Выбрано: ${count}`;
    return 'Без фильтров';
  }, [rouletteQueryParams, options, activeFiltersCount]);

  const {
    data: travels,
    isLoading,
    isFetching,
    isEmpty,
    refetch,
  } = useRandomTravelData({
    queryParams: rouletteQueryParams,
    search,
    isQueryEnabled: true,
  });

  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Travel[]>([]);
  const spinAnim = useRef(new Animated.Value(0)).current;

  const handleSpin = useCallback(async () => {
    setSpinning(true);
    spinAnim.setValue(0);

    let freshTravels: Travel[] = travels || [];

    try {
      const refetchResult = await refetch();
      const pages = (refetchResult.data as any)?.pages || [];
      if (Array.isArray(pages) && pages.length > 0) {
        const normalized = pages.map((page: any) => normalizeApiResponse(page));
        const flattened = normalized.flatMap((page: any) => page.items || []);
        freshTravels = deduplicateTravels(flattened as Travel[]);
      }
    } catch (e) {
      // В случае ошибки используем уже загруженные travels
    }

    if (!freshTravels || freshTravels.length === 0) {
      setResult([]);
      setSpinning(false);
      return;
    }

    const next = shuffleTravels(freshTravels).slice(0, 3);

    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 900,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setResult(next);
      setSpinning(false);
    });
  }, [spinAnim, travels, refetch]);

  const handleClearAll = useCallback(() => {
    setSearch('');
    resetFilters();
    setResult([]);
  }, [resetFilters]);

  const showLoading = isLoading || isFetching || filtersLoading;

  // Анимации карты и маркера маршрута
  const mapScale = useMemo(
    () =>
      spinAnim.interpolate({
        inputRange: [0, 0.4, 1],
        outputRange: [0.6, 1.05, 1],
      }),
    [spinAnim],
  );

  const mapBorderRadius = useMemo(
    () =>
      spinAnim.interpolate({
        inputRange: [0, 0.4, 1],
        outputRange: [40, 20, 16],
      }),
    [spinAnim],
  );

  const routeProgress = useMemo(
    () =>
      spinAnim.interpolate({
        inputRange: [0, 0.3, 1],
        outputRange: [0, 0, 1],
      }),
    [spinAnim],
  );

  return (
    <View style={styles.root}>
      {Platform.OS === 'web' && (
        <Image
          source={mapBackground}
          style={styles.rootBackgroundImage}
          resizeMode="cover"
        />
      )}
      {isFocused && Platform.OS === 'web' && (
        <InstantSEO
          headKey="roulette"
          title={title}
          description={description}
          canonical={canonical}
          image={`${SITE}/og-preview.jpg`}
          ogType="website"
        />
      )}
      <View style={styles.container}>
        {!isMobile && (
          <View style={styles.sidebar}>
            <ModernFilters
              filterGroups={filterGroups}
              selectedFilters={filter as any}
              onFilterChange={(groupKey, optionId) => {
                const currentValues: string[] = ((filter as any)[groupKey] || []).map((v: any) => String(v));
                const normalizedId = String(optionId);
                const newValues = currentValues.includes(normalizedId)
                  ? currentValues.filter((id) => id !== normalizedId)
                  : [...currentValues, normalizedId];
                onSelect(groupKey, newValues);
              }}
              onClearAll={handleClearAll}
              resultsCount={travels.length}
              year={filter.year}
              onYearChange={(value) => onSelect('year', value)}
            />
          </View>
        )}

        <View style={[styles.main, isMobile && styles.mainMobile]}>
          <View style={[styles.heroRow, isMobile && styles.heroRowMobile]}>
            <View style={styles.heroTextBlock}>
              <Text style={styles.heroTitle}>Не знаешь, куда поехать?</Text>
              <Text style={styles.heroSubtitle}>
                {isMobile
                  ? 'Выбери фильтры и нажми «Подобрать» — покажем 3 маршрута.'
                  : 'Подбери фильтры — и мы случайно предложим три маршрута под твои пожелания.'}
              </Text>
            </View>
            {!isMobile && (
              <View style={styles.heroButtonBlock}>
                <UIButton
                  label={spinning ? 'Подбираем маршруты…' : (result.length > 0 ? 'Подобрать ещё варианты' : 'Подобрать маршруты')}
                  onPress={handleSpin}
                  disabled={showLoading || (!travels || travels.length === 0)}
                />
              </View>
            )}
          </View>

          <View style={[styles.topBar, isMobile && styles.topBarMobile]}>
            {isMobile && (
              <View style={styles.mobileTopRow}>
                <View style={styles.mobileFiltersBar}>
                  <Pressable
                    testID="mobile-filters-button"
                    style={styles.mobileFiltersButton}
                    onPress={() => setShowFilters((prev) => !prev)}
                  >
                    <View style={styles.mobileFiltersHeaderRow}>
                      <Feather name="filter" size={14} color={palette.primary} />
                      <Text style={styles.mobileFiltersLabel} numberOfLines={1}>
                        {`Фильтры: ${filtersSummary}`}
                      </Text>
                    </View>
                  </Pressable>
                  {activeFiltersCount > 0 && (
                    <Pressable
                      testID="mobile-reset-filters"
                      style={styles.mobileFiltersResetButton}
                      onPress={handleClearAll}
                    >
                      <Feather name="x-circle" size={16} color={palette.primary} />
                    </Pressable>
                  )}
                </View>

                <View style={styles.mobileSpinButton}>
                  <UIButton
                    label={spinning
                      ? 'Подбираем…'
                      : (result.length > 0 ? 'Ещё' : 'Подобрать')}
                    onPress={handleSpin}
                    disabled={showLoading || (!travels || travels.length === 0)}
                  />
                </View>
              </View>
            )}
          </View>

          <View style={[styles.resultsContainer, isMobile && styles.resultsContainerMobile]}>
            {showLoading && (
              <View style={styles.loaderBox}>
                <ActivityIndicator size="large" color={palette.primary} />
                <Text style={styles.loaderText}>Подбираем маршруты…</Text>
              </View>
            )}

            {!showLoading && isEmpty && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>Ничего не нашли</Text>
                <Text style={styles.emptyText}>
                  Попробуй убрать часть фильтров или измени запрос.
                </Text>
              </View>
            )}

            {!showLoading && !isEmpty && result.length === 0 && travels.length > 0 && (
              <View style={styles.hintBox}>
                <Text style={styles.hintTitle}>Готов к случайному путешествию?</Text>
                <Text style={styles.hintText}>
                  Настрой фильтры слева и нажми «Подобрать маршруты», чтобы получить три идеи поездок.
                </Text>
              </View>
            )}

            {!showLoading && !isEmpty && (
              <View style={styles.cardsContainer}>
                {spinning && (
                  <View style={styles.overlaySpinner}>
                    <View style={styles.spinnerCircle}>
                      <ActivityIndicator size="large" color={palette.primary} />
                      <Text style={styles.spinnerText}>Подбираем маршруты…</Text>
                    </View>
                  </View>
                )}
                {Platform.OS === 'web' && !isMobile ? (
                  <View style={styles.rouletteWrapper}>
                    <View style={styles.rouletteCircle}>
                      {/* Фон-компас внутри круга на web */}
                      <Image
                        source={compassBackground}
                        style={styles.rouletteCompassImage}
                        resizeMode="cover"
                      />

                      {result.slice(0, 3).map((item, index) => (
                        <View
                          key={String(item.id)}
                          style={[
                            styles.rouletteCard,
                            index === 0 && styles.rouletteCardTop,
                            index === 1 && styles.rouletteCardLeft,
                            index === 2 && styles.rouletteCardRight,
                          ]}
                        >
                          <RenderTravelItem
                            item={item}
                            index={index}
                            isMobile={false}
                            isSuperuser={false}
                            isMetravel={false}
                            onDeletePress={undefined}
                            isFirst={index === 0}
                            isSingle
                            selectable={false}
                            isSelected={false}
                            onToggle={undefined}
                          />
                        </View>
                      ))}

                      <Pressable style={styles.rouletteCenter} onPress={handleSpin}>
                        <Text style={styles.rouletteCenterTitle}>Случайный маршрут</Text>
                        <Text style={styles.rouletteCenterSubtitle}>
                          {result.length > 0
                            ? `Выбрано ${result.length} маршрута`
                            : 'Нажми, чтобы подобрать маршруты'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <FlatList
                    data={result}
                    keyExtractor={(item) => String(item.id)}
                    key="cols-1"
                    numColumns={1}
                    contentContainerStyle={[styles.cardsGrid, isMobile && styles.cardsGridMobile]}
                    renderItem={({ item, index }) => (
                      <View style={styles.cardWrapper}>
                        <RenderTravelItem
                          item={item}
                          index={index}
                          isMobile={isMobile}
                          isSuperuser={false}
                          isMetravel={false}
                          onDeletePress={undefined}
                          isFirst={index === 0}
                          selectable={false}
                          isSelected={false}
                          onToggle={undefined}
                        />
                      </View>
                    )}
                  />
                )}
              </View>
            )}
          </View>
        </View>
      </View>

      {isMobile && (
        <Modal
          visible={showFilters}
          animationType="slide"
          onRequestClose={() => setShowFilters(false)}
        >
          <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <ModernFilters
              filterGroups={filterGroups}
              selectedFilters={filter as any}
              onFilterChange={(groupKey, optionId) => {
                const currentValues: string[] = ((filter as any)[groupKey] || []).map((v: any) => String(v));
                const normalizedId = String(optionId);
                const newValues = currentValues.includes(normalizedId)
                  ? currentValues.filter((id) => id !== normalizedId)
                  : [...currentValues, normalizedId];
                onSelect(groupKey, newValues);
              }}
              onClearAll={handleClearAll}
              resultsCount={travels.length}
              year={filter.year}
              onYearChange={(value) => onSelect('year', value)}
              onClose={() => setShowFilters(false)}
              onApply={() => setShowFilters(false)}
            />
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
  },
  rootBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.9,
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  containerMobile: {
    flexDirection: 'column',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 12,
  },
  sidebar: {
    width: 320,
    maxWidth: 360,
    backgroundColor: 'rgba(252,248,240,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(148,128,94,0.22)',
    borderRadius: 18,
    padding: 8,
  },
  main: {
    flex: 1,
    borderRadius: 18,
    // Лёгкий полупрозрачный слой, чтобы текст читался, но карта просвечивала
    backgroundColor: Platform.select({
      web: 'rgba(255, 255, 255, 0.75)',
      default: 'rgba(255, 255, 255, 0.9)',
    }) as string,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
    padding: 16,
  },
  mainMobile: {
    padding: 12,
    borderRadius: 16,
    marginTop: 4,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 16,
  },
  heroRowMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
  },
  heroTextBlock: {
    flex: 1,
    maxWidth: 480,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: palette.textMuted,
  },
  heroButtonBlock: {
    minWidth: 200,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  topBarMobile: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },
  spinButtonWrapper: {
    minWidth: 160,
  },
  spinButtonWrapperMobile: {
    marginTop: 12,
  },
  mobileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mobileFiltersBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mobileFiltersButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(148,128,94,0.35)',
  },
  mobileFiltersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  mobileFiltersLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.text,
  },
  mobileFiltersValue: {
    fontSize: 10,
    color: palette.textMuted,
  },
  mobileFiltersResetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mobileFiltersReset: {
    fontSize: 11,
    color: palette.primary,
    fontWeight: '600',
  },
  mobileSpinButton: {
    marginLeft: 8,
    flexShrink: 1,
  },
  resultsContainer: {
    flex: 1,
    paddingBottom: 32,
  },
  resultsContainerMobile: {
    paddingBottom: 16,
  },
  loaderBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loaderText: {
    marginTop: 12,
    color: palette.textMuted,
    fontSize: 14,
  },
  emptyBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: palette.textMuted,
    textAlign: 'center',
    maxWidth: 360,
  },
  hintBox: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  hintTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 8,
  },
  hintText: {
    fontSize: 14,
    color: palette.textMuted,
    textAlign: 'center',
    maxWidth: 380,
  },
  inlineFiltersMobile: {
    marginTop: 12,
    marginBottom: 4,
  },
  cardsGrid: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  cardsGridMobile: {
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  cardsContainer: {
    flex: 1,
    position: 'relative',
  },
  cardsRow: {
    justifyContent: 'center',
    marginBottom: 16,
  },
  cardWrapper: {
    flex: 1,
    marginHorizontal: 8,
    marginBottom: 12,
  },
  selectedListContainer: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,128,94,0.25)',
    paddingTop: 16,
    gap: 12,
  },
  selectedListTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 4,
  },
  selectedCardWrapper: {
    marginBottom: 12,
  },
  rouletteWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  rouletteCircle: {
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(148,128,94,0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rouletteCard: {
    position: 'absolute',
    width: 340,
    maxWidth: '86%',
  },
  rouletteCardTop: {
    top: -50,
    left: '50%',
    transform: [{ translateX: -170 }, { rotate: '-3deg' }, { scale: 1.1 }],
  },
  rouletteCardLeft: {
    bottom: 70,
    left: -14,
    transform: [{ rotate: '-10deg' }],
  },
  rouletteCardRight: {
    bottom: 70,
    right: -14,
    transform: [{ rotate: '10deg' }],
  },
  rouletteCenter: {
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 2,
    borderColor: 'rgba(148,128,94,0.45)',
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  rouletteCenterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2933',
    textAlign: 'center',
    marginBottom: 4,
  },
  rouletteCenterSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  rouletteButtonDesktop: {
    marginTop: 24,
  },
  rouletteCompassImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.85,
    borderRadius: 260,
  },
  overlaySpinner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248,248,248,0.45)',
    zIndex: 1,
  },
  spinnerCircle: {
    minWidth: 220,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 25,
  },
  spinnerText: {
    fontSize: 14,
    color: palette.textMuted,
  },
  mapCard: {
    width: 220,
    height: 150,
    backgroundColor: '#f7f5f0',
    borderWidth: 1,
    borderColor: '#e0d4b8',
    alignItems: 'stretch',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
    padding: 12,
  },
  mapInner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  mapTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4a4a4a',
  },
  routeLineContainer: {
    flex: 1,
    marginTop: 12,
    borderRadius: 10,
    paddingHorizontal: 4,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  routeLine: {
    height: 3,
    borderRadius: 3,
    backgroundColor: '#2f9e8d',
    transformOrigin: 'left center' as any,
  },
  routeMarker: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#2f9e8d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeMarkerIcon: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    ...(Platform.OS === 'web'
      ? {
          position: 'fixed' as any,
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: 1000,
        }
      : {}),
  },
  modalContent: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 12,
    maxHeight: '80%',
    width: '100%',
    alignSelf: 'stretch',
  },
});
