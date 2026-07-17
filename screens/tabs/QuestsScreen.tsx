// src/screens/tabs/QuestsScreen.tsx
// Redesigned: Two-column layout like search page
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
    View, Pressable, Platform,
    Dimensions,
    ViewStyle,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { buildCanonicalUrl, buildOgImageUrl, QUESTS_OG_IMAGE_PATH } from '@/utils/seo';
import { stringifyJsonLd } from '@/utils/jsonLd';
import { haversineKm } from '@/utils/geo';
import { getQuestAgeSearchTerms } from '@/utils/questAudience';
import { useIsFocused } from 'expo-router';
import { useBreakpoints } from '@/hooks/useResponsive';
import { useQuestCatalogResponsiveModel } from '@/hooks/useQuestCatalogResponsiveModel';
import { useThemedColors } from '@/hooks/useTheme';
import { useQuestsList, useQuestCities } from '@/hooks/useQuestsApi';
import QuestsContentPanel from './QuestsContentPanel';
import QuestsSidebar from './QuestsSidebar';
import { getQuestFaqItems } from './QuestsSeoIntroFaq';
import type { City, NearbyCity, QuestMeta } from './questsShared';
import { createQuestCatalogStructuredData } from '@/utils/discoverySeo';
import { getStyles } from './QuestsScreen.styles';
import {
    getQuestCountryName,
    STORAGE_SELECTED_CITY,
    DEFAULT_NEARBY_RADIUS_KM,
    NEARBY_ID,
    KIDS_FILTER_ID,
    BIKE_FILTER_ID,
    buildQuestCityCatalog,
    filterBikeQuests,
    filterKidsQuests,
    filterQuestsByMapSearchArea,
    getAverageQuestMapPointCenter,
    loadExpoLocation,
    resolveQuestMapCenter,
    type QuestMapArea,
    type MapPoint,
} from './QuestsScreen.helpers';
import { createCollator, translate as i18nT } from '@/i18n'


const { spacing, radii } = DESIGN_TOKENS;

const LazyQuestMap = React.lazy(() => import('@/components/MapPage/Map.web'));

// ───────────── Main screen (Redesigned) ─────────────

export default function QuestsScreen() {
    const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
    // Свободный текстовый поиск по всему каталогу (название/город/страна/теги).
    // Пока строка непустая — перекрывает выбор города и «Рядом», ищем по ВСЕМ квестам.
    const [searchQuery, setSearchQuery] = useState('');
    // true только когда пользователь сам выбрал «Рядом» — тогда включаем
    // геолокацию и фильтрацию по радиусу. По умолчанию «Рядом» = все квесты.
    const [nearbyExplicit, setNearbyExplicit] = useState(false);
    const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
    const [geoRequesting, setGeoRequesting] = useState(false);
    const [geoMessage, setGeoMessage] = useState<string | null>(null);
    const nearbyRadiusKm = DEFAULT_NEARBY_RADIUS_KM;
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [pendingMapAreaCenter, setPendingMapAreaCenter] = useState<QuestMapArea | null>(null);
    const [activeMapAreaCenter, setActiveMapAreaCenter] = useState<QuestMapArea | null>(null);
    const [collapsedCountryCodes, setCollapsedCountryCodes] = useState<Record<string, boolean>>({});

    // API data
    const { quests: ALL_QUESTS, loading: questsLoading } = useQuestsList();
    const { cities: apiCities, loading: citiesLoading } = useQuestCities();
    const dataLoaded = !questsLoading && !citiesLoading;
    const cityCountryMetaById = useMemo(() => {
        const meta: Record<string, { countryCode?: string }> = {};
        for (const quest of ALL_QUESTS) {
            if (!quest.cityId || meta[quest.cityId]?.countryCode) continue;
            meta[quest.cityId] = {
                countryCode: quest.countryCode,
            };
        }
        return meta;
    }, [ALL_QUESTS]);

    const rawCities = useMemo<City[]>(() => apiCities.map(c => ({
        id: c.id,
        name: c.name,
        lat: c.lat,
        lng: c.lng,
        countryCode: cityCountryMetaById[c.id]?.countryCode || c.countryCode,
    })), [apiCities, cityCountryMetaById]);
    const cityCatalog = useMemo(
        () => buildQuestCityCatalog<City, QuestMeta>(rawCities, ALL_QUESTS),
        [ALL_QUESTS, rawCities],
    );
    const CITIES = cityCatalog.cities;
    const cityQuests = cityCatalog.questsByCityId;

    const isFocused = useIsFocused();
    const colors = useThemedColors();
    // Ширинно-ориентированная подписка (без ре-рендера на изменение высоты).
    // На мобильном вебе открытие клавиатуры/схлопывание адресной строки меняет
    // высоту вьюпорта покадрово; подписка на высоту (useResponsive) дёргала бы
    // ре-рендер всего экрана во время набора и рвала ввод в поле поиска.
    const { width: bpWidth, isMobile: bpIsMobile } = useBreakpoints();
    const [layoutHydrated, setLayoutHydrated] = useState(Platform.OS !== 'web');
    useEffect(() => {
        setLayoutHydrated(true);
    }, []);
    const width = layoutHydrated ? bpWidth : 0;
    const isMobile = layoutHydrated ? bpIsMobile : true;
    // Высота нужна только для размеров карты на native/desktop и берётся
    // НЕреактивным снапшотом: в стилях мобильного веба она не используется
    // (карта = 100dvh через CSS), поэтому отсутствие подписки на высоту ничего
    // не ломает, но убирает keyboard/address-bar-джиттер при вводе.
    const height = layoutHydrated ? Dimensions.get('window').height : 0;
    const s = useMemo(() => getStyles(colors, width, height), [colors, width, height]);

    // ── Persistent city selection ──
    useEffect(() => {
        (async () => {
            try {
                const saved = await AsyncStorage.getItem(STORAGE_SELECTED_CITY);
                setSelectedCityId(saved || null);
            } catch {
                setSelectedCityId(null);
            }
        })();
    }, []);

    const handleSelectCity = useCallback(async (id: string) => {
        setSelectedCityId(id);
        setNearbyExplicit(id === NEARBY_ID);
        setGeoMessage(null);
        setPendingMapAreaCenter(null);
        setActiveMapAreaCenter(null);
        if (isMobile) setFilterDrawerOpen(false);
        try {
            await AsyncStorage.setItem(STORAGE_SELECTED_CITY, id);
        } catch (error) {
            const { devError } = await import('@/utils/logger');
            devError('Error saving selected city:', error);
        }
    }, [isMobile]);

    const handleShowKidsQuests = useCallback(() => {
        void handleSelectCity(KIDS_FILTER_ID);
    }, [handleSelectCity]);

    const handleShowBikeQuests = useCallback(() => {
        void handleSelectCity(BIKE_FILTER_ID);
    }, [handleSelectCity]);

    const requestNearbyQuests = useCallback(async () => {
        if (geoRequesting) return;
        setGeoRequesting(true);
        setGeoMessage(null);
        setSelectedCityId(NEARBY_ID);
        setNearbyExplicit(true);
        setPendingMapAreaCenter(null);
        setActiveMapAreaCenter(null);
        if (isMobile) setFilterDrawerOpen(false);

        try {
            await AsyncStorage.setItem(STORAGE_SELECTED_CITY, NEARBY_ID);
        } catch {
            // Selection persistence is useful but not required for the current click.
        }

        try {
            const Location = await loadExpoLocation();
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setGeoMessage(i18nT('quests:screens.tabs.QuestsScreen.razreshite_dostup_k_geolokatsii_chtoby_pokaz_46647348'));
                return;
            }
            const pos = await Location.getCurrentPositionAsync({
                accuracy: Location.LocationAccuracy.Balanced,
            });
            setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        } catch {
            setGeoMessage(i18nT('quests:screens.tabs.QuestsScreen.ne_udalos_opredelit_mestopolozhenie_proverte_34451827'));
        } finally {
            setGeoRequesting(false);
        }
    }, [geoRequesting, isMobile]);

    // Быстрый сброс к «Все квесты»: мягкий дефолт «Рядом» без геолокации
    // (nearbyExplicit=false) показывает весь каталог — см. баг F-09.
    const handleResetFilters = useCallback(async () => {
        setSelectedCityId(NEARBY_ID);
        setNearbyExplicit(false);
        setGeoMessage(null);
        setPendingMapAreaCenter(null);
        setActiveMapAreaCenter(null);
        if (isMobile) setFilterDrawerOpen(false);
        try {
            await AsyncStorage.setItem(STORAGE_SELECTED_CITY, NEARBY_ID);
        } catch (error) {
            const { devError } = await import('@/utils/logger');
            devError('Error saving selected city:', error);
        }
    }, [isMobile]);

    const handleSetViewMode = useCallback((mode: 'list' | 'map') => {
        setViewMode(mode);
        if (isMobile) setFilterDrawerOpen(false);
    }, [isMobile]);

    // Функциональный тогл: не зависит от замкнутого viewMode, поэтому не залипает
    // на устаревшем значении при повторных тапах на Android (F-10).
    const handleToggleViewMode = useCallback(() => {
        setViewMode((current) => (current === 'map' ? 'list' : 'map'));
        if (isMobile) setFilterDrawerOpen(false);
    }, [isMobile]);

    // Без сохранённого/валидного выбора показываем «Все квесты» (мягкий дефолт
    // «Рядом» без геолокации = весь каталог), а не ближайший по гео единственный
    // город (иначе по умолчанию виден лишь 1 город из многих — баг F-09).
    // Гео-фильтрация по радиусу включается только при ЯВНОМ выборе «Рядом».
    useEffect(() => {
        if (!dataLoaded || !CITIES.length) return;
        const canonicalCityId = selectedCityId ? cityCatalog.canonicalCityIdById[selectedCityId] : null;
        if (canonicalCityId && canonicalCityId !== selectedCityId) {
            setSelectedCityId(canonicalCityId);
            void AsyncStorage.setItem(STORAGE_SELECTED_CITY, canonicalCityId);
            return;
        }
        const validIds = new Set(CITIES.map((c) => c.id));
        const isValid = selectedCityId === NEARBY_ID
            || selectedCityId === KIDS_FILTER_ID
            || selectedCityId === BIKE_FILTER_ID
            || (selectedCityId ? validIds.has(selectedCityId) : false);
        if (isValid) return;
        setSelectedCityId(NEARBY_ID);
    }, [CITIES, cityCatalog.canonicalCityIdById, dataLoaded, selectedCityId]);

    // Geolocation only when Nearby is explicitly chosen, or on the map view.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!(selectedCityId === NEARBY_ID && nearbyExplicit) && viewMode !== 'map') return;
            try {
                const Location = await loadExpoLocation();
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted' || cancelled) {
                    if (!cancelled && selectedCityId === NEARBY_ID && nearbyExplicit) {
                        setGeoMessage(i18nT('quests:screens.tabs.QuestsScreen.geolokatsiya_zapreschena_pokazyvaem_ves_kata_b7ae192f'));
                    }
                    return;
                }
                const pos = await Location.getCurrentPositionAsync({
                    accuracy: Location.LocationAccuracy.Balanced,
                });
                if (!cancelled) {
                    setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    setGeoMessage(null);
                }
            } catch (error) {
                if (!cancelled && selectedCityId === NEARBY_ID && nearbyExplicit) {
                    setGeoMessage(i18nT('quests:screens.tabs.QuestsScreen.ne_udalos_opredelit_mestopolozhenie_proverte_34451827'));
                }
                console.warn('Error requesting nearby location', error);
            }
        })();
        return () => { cancelled = true; };
    }, [selectedCityId, viewMode, nearbyExplicit]);

    useEffect(() => {
        if (Platform.OS !== 'web' || !filterDrawerOpen) return undefined;
        const html = document.documentElement;
        const body = document.body;
        const previousHtmlOverflow = html.style.overflow;
        const previousBodyOverflow = body.style.overflow;
        const previousBodyTouchAction = body.style.touchAction;

        html.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
        body.style.touchAction = 'none';

        return () => {
            html.style.overflow = previousHtmlOverflow;
            body.style.overflow = previousBodyOverflow;
            body.style.touchAction = previousBodyTouchAction;
        };
    }, [filterDrawerOpen]);

    // ── Derived data ──
    const kidsQuests = useMemo(() => filterKidsQuests(ALL_QUESTS), [ALL_QUESTS]);
    // Детские квесты — часть каталога своего города. Фильтр «Для детей»
    // даёт дополнительный срез, но не заменяет городскую группировку.
    // Велоквесты (тег `bike`) — такой же дополнительный срез каталога.
    const bikeQuests = useMemo(() => filterBikeQuests(ALL_QUESTS), [ALL_QUESTS]);

    const citiesWithNearby: (City | NearbyCity)[] = useMemo(
        () => [{ id: NEARBY_ID, name: i18nT('quests:screens.tabs.QuestsScreen.ryadom_a27f6fda'), country: 'BY', isNearby: true } as NearbyCity, ...CITIES],
        [CITIES],
    );

    const filteredCities = useMemo(() => {
        return citiesWithNearby;
    }, [citiesWithNearby]);

    const nearbyCount = useMemo(() => {
        if (!userLoc || !ALL_QUESTS.length) return 0;
        return ALL_QUESTS.reduce((acc, q) => {
            const d = haversineKm(userLoc.lat, userLoc.lng, q.lat, q.lng);
            return acc + (d <= nearbyRadiusKm ? 1 : 0);
        }, 0);
    }, [userLoc, nearbyRadiusKm, ALL_QUESTS]);

    const cityQuestCountById = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const city of citiesWithNearby) {
            counts[city.id] = city.id === NEARBY_ID ? nearbyCount : (cityQuests[city.id]?.length || 0);
        }
        counts[KIDS_FILTER_ID] = kidsQuests.length;
        counts[BIKE_FILTER_ID] = bikeQuests.length;
        return counts;
    }, [citiesWithNearby, nearbyCount, cityQuests, kidsQuests.length, bikeQuests.length]);

    // Filter to show only cities with quests (plus Nearby always visible)
    const visibleCities = useMemo(() => {
        return filteredCities.filter((c) => c.id === NEARBY_ID || cityQuestCountById[c.id] > 0);
    }, [filteredCities, cityQuestCountById]);

    // Group cities by country
    const citiesByCountry = useMemo(() => {
        const collator = createCollator();
        const groups: Record<string, (City | NearbyCity)[]> = {};
        for (const city of visibleCities) {
            if (city.id === NEARBY_ID) continue; // Nearby handled separately
            const code = (city as City).countryCode || 'OTHER';
            (groups[code] ||= []).push(city);
        }
        // Sort countries: BY first, then alphabetically, OTHER last
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            if (a === 'BY') return -1;
            if (b === 'BY') return 1;
            if (a === 'OTHER') return 1;
            if (b === 'OTHER') return -1;
            return collator.compare(getQuestCountryName(a), getQuestCountryName(b));
        });
        return sortedKeys.map(code => ({
            code,
            name: code === 'OTHER' ? '' : getQuestCountryName(code),
            cities: groups[code].slice().sort((a, b) => collator.compare(a.name, b.name)),
        }));
    }, [visibleCities]);

    useEffect(() => {
        setCollapsedCountryCodes((prev) => {
            const next: Record<string, boolean> = {};
            for (const group of citiesByCountry) {
                next[group.code] = prev[group.code] ?? false;
            }
            return next;
        });
    }, [citiesByCountry]);

    const handleToggleCountryGroup = useCallback((code: string) => {
        setCollapsedCountryCodes((prev) => ({
            ...prev,
            [code]: !prev[code],
        }));
    }, []);

    const areAllCountryGroupsCollapsed = useMemo(
        () => citiesByCountry.length > 0 && citiesByCountry.every((group) => collapsedCountryCodes[group.code]),
        [citiesByCountry, collapsedCountryCodes],
    );

    const handleToggleAllCountryGroups = useCallback(() => {
        const nextValue = !areAllCountryGroupsCollapsed;
        setCollapsedCountryCodes(() => {
            const next: Record<string, boolean> = {};
            for (const group of citiesByCountry) {
                next[group.code] = nextValue;
            }
            return next;
        });
    }, [areAllCountryGroupsCollapsed, citiesByCountry]);

    const searchTerm = searchQuery.trim().toLowerCase();

    const questsAll: (QuestMeta & { _distanceKm?: number })[] = useMemo(() => {
        if (!dataLoaded) return [];
        // Свободный поиск перекрывает город/«Рядом»: ищем по всему каталогу.
        if (searchTerm) {
            return ALL_QUESTS
                .filter((q) => {
                    const haystack = [
                        q.title,
                        q.cityName,
                        q.countryName,
                        ...(q.tags || []),
                        ...(getQuestAgeSearchTerms(q.tags)),
                    ]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase();
                    return haystack.includes(searchTerm);
                })
                .map((q) => ({ ...q }));
        }
        if (!selectedCityId) return [];
        if (selectedCityId === KIDS_FILTER_ID) {
            return kidsQuests.map((q) => ({ ...q }));
        }
        if (selectedCityId === BIKE_FILTER_ID) {
            return bikeQuests.map((q) => ({ ...q }));
        }
        if (selectedCityId === NEARBY_ID) {
            if (activeMapAreaCenter) {
                // «Искать в этой области» должен фиксировать именно видимый viewport,
                // а не повторно резать уже показанную карту маленьким nearby-радиусом.
                return filterQuestsByMapSearchArea(ALL_QUESTS, activeMapAreaCenter, nearbyRadiusKm);
            }
            // Радиусную фильтрацию применяем только при явном выборе «Рядом»;
            // мягкий дефолт «Рядом» показывает весь каталог.
            if (!userLoc || !nearbyExplicit) {
                return ALL_QUESTS.map((q) => ({ ...q }));
            }
            return ALL_QUESTS
                .map((q) => ({ ...q, _distanceKm: haversineKm(userLoc.lat, userLoc.lng, q.lat, q.lng) }))
                .filter((q) => (q._distanceKm ?? Infinity) <= nearbyRadiusKm)
                .sort((a, b) => a._distanceKm! - b._distanceKm!);
        }
        return (cityQuests[selectedCityId] || []).map((q) => ({ ...q }));
    }, [
        selectedCityId,
        userLoc,
        nearbyRadiusKm,
        ALL_QUESTS,
        dataLoaded,
        nearbyExplicit,
        activeMapAreaCenter,
        searchTerm,
        cityQuests,
        kidsQuests,
        bikeQuests,
    ]);

    const catalogModel = useQuestCatalogResponsiveModel(questsAll.length);
    const questCardWidth = catalogModel.cardWidth;

    const mapPoints = useMemo<MapPoint[]>(() => {
        if (!dataLoaded) return [];
        if (!searchTerm && !selectedCityId) return [];
        const source = searchTerm
            ? questsAll
            : selectedCityId === NEARBY_ID
                ? (userLoc || activeMapAreaCenter ? questsAll : ALL_QUESTS)
                : questsAll;

        return source
            .filter((q) => Number.isFinite(q.lat) && Number.isFinite(q.lng) && !!q.id)
            .map((q) => {
                const citySegmentRaw = q.cityId || selectedCityId || '';
                const citySegment = encodeURIComponent(String(citySegmentRaw || 'city'));
                const questSegment = encodeURIComponent(String(q.id));
                const questUrl = buildCanonicalUrl(`/quests/${citySegment}/${questSegment}`);

                const coverUri = typeof q.cover === 'string' ? q.cover : '';
                return {
                    id: q.id,
                    coord: `${q.lat},${q.lng}`,
                    address: q.title,
                    travelImageThumbUrl: coverUri,
                    categoryName: i18nT('quests:screens.tabs.QuestsScreen.kvest_1033726e'),
                    articleUrl: questUrl,
                    urlTravel: questUrl,
                    questMeta: {
                        id: q.id,
                        title: q.title,
                        cityId: q.cityId ?? String(citySegmentRaw || ''),
                        cityName: q.cityName,
                        countryName: q.countryName,
                        points: q.points,
                        durationMin: q.durationMin,
                        difficulty: q.difficulty,
                        tags: q.tags,
                        petFriendly: q.petFriendly,
                        cover: coverUri || undefined,
                    },
                };
            });
    }, [dataLoaded, selectedCityId, userLoc, activeMapAreaCenter, questsAll, ALL_QUESTS, searchTerm]);

    const mapCenter = useMemo(() => {
        const virtualFilterCenter = selectedCityId === KIDS_FILTER_ID || selectedCityId === BIKE_FILTER_ID
            ? getAverageQuestMapPointCenter(mapPoints)
            : null;
        const selectedCity = virtualFilterCenter
            ? { lat: virtualFilterCenter.latitude, lng: virtualFilterCenter.longitude }
            : CITIES.find((c) => c.id === selectedCityId);
        return resolveQuestMapCenter({
            searchTerm,
            mapPoints,
            activeMapAreaCenter,
            userLoc,
            selectedCity,
        });
    }, [CITIES, mapPoints, searchTerm, selectedCityId, userLoc, activeMapAreaCenter]);

    const handleMapUserLocationChange = useCallback((loc: { latitude: number; longitude: number } | null) => {
        if (!loc) return;
        if (!Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) return;
        setUserLoc((prev) => {
            if (prev && Math.abs(prev.lat - loc.latitude) < 0.00001 && Math.abs(prev.lng - loc.longitude) < 0.00001) {
                return prev;
            }
            return { lat: loc.latitude, lng: loc.longitude };
        });
    }, []);

    const handleMapMove = useCallback((center: QuestMapArea) => {
        if (!center || !Number.isFinite(center.latitude) || !Number.isFinite(center.longitude)) return;
        setPendingMapAreaCenter({
            latitude: center.latitude,
            longitude: center.longitude,
            bbox: center.bbox,
            zoom: center.zoom,
        });
    }, []);

    const handleSearchMapArea = useCallback(() => {
        if (!pendingMapAreaCenter) return;
        setActiveMapAreaCenter(pendingMapAreaCenter);
        setSelectedCityId(NEARBY_ID);
        setNearbyExplicit(false);
        setGeoMessage(null);
        setPendingMapAreaCenter(null);
    }, [pendingMapAreaCenter]);

    // Фильтр «сужает» каталог: выбран конкретный город, явный «Рядом» с радиусом
    // или область карты. В этих случаях показываем быстрый сброс к «Все квесты».
    const filtersActive = Boolean(
        (selectedCityId && selectedCityId !== NEARBY_ID)
        || (selectedCityId === NEARBY_ID && nearbyExplicit)
        || activeMapAreaCenter,
    );

    // ── SEO ──
    const selectedCityName =
        selectedCityId === NEARBY_ID
            ? i18nT('quests:screens.tabs.QuestsScreen.ryadom_a27f6fda')
            : selectedCityId === KIDS_FILTER_ID
                ? i18nT('quests:screens.tabs.QuestsScreen.dlya_detey_709e9049')
                : selectedCityId === BIKE_FILTER_ID
                    ? i18nT('quests:screens.tabs.QuestsScreen.veloFilterName')
                    : CITIES.find((c) => c.id === selectedCityId)?.name ?? null;

    const titleText = useMemo(() => {
        if (!selectedCityId) return i18nT('quests:screens.tabs.QuestsScreen.kvesty_metravel_1ee1a636');
        if (selectedCityId === NEARBY_ID) {
            if (activeMapAreaCenter) {
                return i18nT('quests:screens.tabs.QuestsScreen.kvesty_oblast_na_karte_value1_value2_metrave_0008ee0f', { value1: questsAll.length, value2: i18nT('quests:screens.tabs.QuestsScreen.questNoun', { count: questsAll.length }) });
            }
            if (!userLoc) {
                return i18nT('quests:screens.tabs.QuestsScreen.kvesty_vse_goroda_metravel_d59d9d53');
            }
            const suffix = userLoc
                ? nearbyCount > 0 ? i18nT('quests:screens.tabs.QuestsScreen.value1_poblizosti_5f29a880', { value1: nearbyCount }) : i18nT('quests:screens.tabs.QuestsScreen.ryadom_nichego_ne_naydeno_ac852a3a')
                : i18nT('quests:screens.tabs.QuestsScreen.geolokatsiya_otklyuchena_c6dfaf4a');
            return i18nT('quests:screens.tabs.QuestsScreen.kvesty_ryadom_value1_metravel_684d20db', { value1: suffix });
        }
        if (selectedCityId === KIDS_FILTER_ID) {
            return i18nT('quests:screens.tabs.QuestsScreen.kvesty_dlya_detey_value1_value2_metravel_3ce19948', { value1: kidsQuests.length, value2: i18nT('quests:screens.tabs.QuestsScreen.questNoun', { count: kidsQuests.length }) });
        }
        if (selectedCityId === BIKE_FILTER_ID) {
            return i18nT('quests:screens.tabs.QuestsScreen.veloTitle', { value1: bikeQuests.length, value2: i18nT('quests:screens.tabs.QuestsScreen.questNoun', { count: bikeQuests.length }) });
        }
        return selectedCityName
            ? i18nT('quests:screens.tabs.QuestsScreen.kvesty_value1_metravel_f8aef4dd', { value1: selectedCityName })
            : i18nT('quests:screens.tabs.QuestsScreen.vse_kvesty_metravel_32e5b095');
    }, [selectedCityId, selectedCityName, nearbyCount, userLoc, activeMapAreaCenter, questsAll.length, kidsQuests.length, bikeQuests.length]);

    const descText = useMemo(() => {
        if (selectedCityId === NEARBY_ID) {
            if (activeMapAreaCenter) {
                return i18nT('quests:screens.tabs.QuestsScreen.oflayn_kvesty_v_vybrannoy_oblasti_karty_pere_8dffb3a7');
            }
            if (!userLoc) {
                return i18nT('quests:screens.tabs.QuestsScreen.katalog_oflayn_kvestov_vo_vseh_dostupnyh_gor_e333bc7d');
            }
            return i18nT('quests:screens.tabs.QuestsScreen.oflayn_kvesty_ryadom_s_vami_i_vashe_tekusche_26c07bc1');
        }
        if (selectedCityId === KIDS_FILTER_ID) {
            return i18nT('quests:screens.tabs.QuestsScreen.gorodskie_kvesty_dlya_detey_progulki_s_zadan_e9f23cbe');
        }
        if (selectedCityId === BIKE_FILTER_ID) {
            return i18nT('quests:screens.tabs.QuestsScreen.veloDescription');
        }
        if (selectedCityName) return i18nT('quests:screens.tabs.QuestsScreen.oflayn_kvesty_v_gorode_value1_progulki_po_to_c1bef6e1', { value1: selectedCityName });
        return i18nT('quests:screens.tabs.QuestsScreen.issleduyte_goroda_i_parki_s_oflayn_kvestami__76e12a53');
    }, [selectedCityId, selectedCityName, userLoc, activeMapAreaCenter]);
    const questsStructuredData = createQuestCatalogStructuredData({
        canonical: buildCanonicalUrl('/quests'),
        title: titleText,
        description: descText,
        quests: ALL_QUESTS,
    });
    const questsFaqStructuredData = useMemo(() => ({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: getQuestFaqItems().map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
    }), []);
    const questsSeoTags = useMemo(
        () => (
            <>
                <script
                    key="quests-structured-data"
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: stringifyJsonLd(questsStructuredData) }}
                />
                <script
                    key="quests-faq-structured-data"
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: stringifyJsonLd(questsFaqStructuredData) }}
                />
            </>
        ),
        [questsStructuredData, questsFaqStructuredData]
    );

    // ── Render (Two-column layout) ──
    return (
        <View style={s.root as ViewStyle}>
            {isFocused && (
                <InstantSEO
                    headKey="quests-index"
                    title={titleText}
                    description={descText}
                    canonical={buildCanonicalUrl('/quests')}
                    ogType="website"
                    image={buildOgImageUrl(QUESTS_OG_IMAGE_PATH)}
                    additionalTags={questsSeoTags}
                />
            )}

            {/* Hidden h1 for SEO */}
            {Platform.OS === 'web' && (
                <h1 style={{
                    position: 'absolute' as const, width: 1, height: 1, padding: 0, margin: -1,
                    overflow: 'hidden' as const, clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', borderWidth: 0,
                } as any}>{titleText.replace(/\s*\|\s*MeTravel\s*$/, '')}</h1>
            )}

            {/* Mobile: Filter drawer overlay */}
            {isMobile && filterDrawerOpen && (
                <>
                    <Pressable
                        style={s.sidebarOverlay as ViewStyle}
                        onPress={() => setFilterDrawerOpen(false)}
                        accessibilityRole="button"
                        accessibilityLabel={i18nT('quests:screens.tabs.QuestsScreen.zakryt_menyu_fbe0ff41')}
                    />
                    <View style={s.sidebarMobile as ViewStyle}>
                        <QuestsSidebar
                            styles={s}
                            colors={colors}
                            viewMode={viewMode}
                            selectedCityId={selectedCityId}
                            nearbyId={NEARBY_ID}
                            kidsFilterId={KIDS_FILTER_ID}
                            bikeFilterId={BIKE_FILTER_ID}
                            areAllCountryGroupsCollapsed={areAllCountryGroupsCollapsed}
                            collapsedCountryCodes={collapsedCountryCodes}
                            citiesByCountry={citiesByCountry}
                            cityQuestCountById={cityQuestCountById}
                            spacingMd={spacing.md}
                            onSelectCity={handleSelectCity}
                            onSetViewMode={handleSetViewMode}
                            onToggleCountryGroup={handleToggleCountryGroup}
                            onToggleAllCountryGroups={handleToggleAllCountryGroups}
                            onCloseDrawer={() => setFilterDrawerOpen(false)}
                        />
                    </View>
                </>
            )}

            {/* Desktop: Sidebar always visible */}
            {!isMobile && (
                <QuestsSidebar
                    styles={s}
                    colors={colors}
                    viewMode={viewMode}
                    selectedCityId={selectedCityId}
                    nearbyId={NEARBY_ID}
                    kidsFilterId={KIDS_FILTER_ID}
                    bikeFilterId={BIKE_FILTER_ID}
                    areAllCountryGroupsCollapsed={areAllCountryGroupsCollapsed}
                    collapsedCountryCodes={collapsedCountryCodes}
                    citiesByCountry={citiesByCountry}
                    cityQuestCountById={cityQuestCountById}
                    spacingMd={spacing.md}
                    onSelectCity={handleSelectCity}
                    onSetViewMode={handleSetViewMode}
                    onToggleCountryGroup={handleToggleCountryGroup}
                    onToggleAllCountryGroups={handleToggleAllCountryGroups}
                />
            )}

            <QuestsContentPanel
                styles={s}
                colors={colors}
                dataLoaded={dataLoaded}
                viewMode={viewMode}
                selectedCityId={selectedCityId}
                selectedCityName={selectedCityName}
                nearbyId={NEARBY_ID}
                kidsFilterId={KIDS_FILTER_ID}
                bikeFilterId={BIKE_FILTER_ID}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                questsAll={questsAll}
                questCardWidth={questCardWidth}
                mapPoints={mapPoints}
                mapCenter={mapCenter}
                userLoc={userLoc}
                isMapAreaActive={Boolean(activeMapAreaCenter)}
                geoMessage={geoMessage}
                geoRequesting={geoRequesting}
                showMapAreaSearch={Boolean(pendingMapAreaCenter)}
                radiiLg={radii.lg}
                LazyQuestMap={LazyQuestMap}
                isMobile={isMobile}
                filtersActive={filtersActive}
                onResetFilters={handleResetFilters}
                onShowKids={handleShowKidsQuests}
                onShowBike={handleShowBikeQuests}
                onShowNearby={requestNearbyQuests}
                onOpenFilterDrawer={() => setFilterDrawerOpen(true)}
                onToggleViewMode={handleToggleViewMode}
                onMapUserLocationChange={handleMapUserLocationChange}
                onMapMove={handleMapMove}
                onSearchMapArea={handleSearchMapArea}
            />
        </View>
    );
}
