// src/screens/tabs/QuestsScreen.tsx
// Redesigned: Two-column layout like search page
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
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
import { getQuestAgeSearchTerms } from '@/utils/questAudience';
import { useIsFocused } from 'expo-router';
import { useBreakpoints } from '@/hooks/useResponsive';
import { useQuestCatalogResponsiveModel } from '@/hooks/useQuestCatalogResponsiveModel';
import { useThemedColors } from '@/hooks/useTheme';
import { useQuestsList } from '@/hooks/useQuestsApi';
import { useQuestReturnVisit } from '@/hooks/useQuestReturnVisit';
import { useQuestReviewPrompt } from '@/hooks/useQuestReviewPrompt';
import QuestReviewPromptBanner from '@/components/quests/QuestReviewPromptBanner';
import QuestsContentPanel from './QuestsContentPanel';
import { useQuestPersonalSlices } from './useQuestPersonalSlices';
import QuestsSidebar from './QuestsSidebar';
import { getQuestFaqItems } from './QuestsSeoIntroFaq';
import type { QuestMeta } from './questsShared';
import { createQuestCatalogStructuredData } from '@/utils/discoverySeo';
import { getStyles } from './QuestsScreen.styles';
import {
    getQuestCountryName,
    STORAGE_SELECTED_CITY,
    DEFAULT_NEARBY_RADIUS_KM,
    ALL_QUESTS_ID,
    NEARBY_ID,
    KIDS_FILTER_ID,
    BIKE_FILTER_ID,
    REVIEWED_FILTER_ID,
    COMPLETED_FILTER_ID,
    UNCOMPLETED_FILTER_ID,
    filterReviewedQuests,
    buildQuestCityCatalog,
    filterBikeQuests,
    filterKidsQuests,
    filterNearbyQuests,
    filterQuestsByMapSearchArea,
    getAverageQuestMapPointCenter,
    loadExpoLocation,
    resolveQuestMapCenter,
    resolveStoredQuestCatalogSelection,
    type QuestCatalogCity,
    type QuestMapArea,
    type MapPoint,
} from './QuestsScreen.helpers';
import { canRankQuestsByPopularity, sortQuestsByPopularity } from '@/utils/questPopularity';
import { useQuestCatalogHandoff } from './useQuestCatalogHandoff';
import { createCollator, translate as i18nT } from '@/i18n'


const { spacing, radii } = DESIGN_TOKENS;

const LazyQuestMap = React.lazy(() => import('@/components/MapPage/Map.web'));

// ───────────── Main screen (Redesigned) ─────────────

export default function QuestsScreen() {
    // #1484: заход в каталог после ранее завершённого квеста — это и есть
    // возврат, который меряет петля. Событие уходит один раз на прохождение.
    useQuestReturnVisit();
    // #1795 — просьба об отзыве по последнему пройденному квесту: один раз на
    // квест и не сразу после финиша (там форма и так на экране финала).
    const { prompt: reviewPrompt, dismiss: dismissReviewPrompt } = useQuestReviewPrompt();

    const [selectedCityId, setSelectedCityId] = useState<string | null>(ALL_QUESTS_ID);
    // Свободный текстовый поиск по всему каталогу (название/город/страна/теги).
    // Пока строка непустая — перекрывает выбор города и «Рядом», ищем по ВСЕМ квестам.
    const [searchQuery, setSearchQuery] = useState('');
    const [nearbyRequestVersion, setNearbyRequestVersion] = useState(0);
    const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
    const [geoRequesting, setGeoRequesting] = useState(false);
    const [geoMessage, setGeoMessage] = useState<string | null>(null);
    const nearbyRadiusKm = DEFAULT_NEARBY_RADIUS_KM;
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [popularSortEnabled, setPopularSortEnabled] = useState(false);
    const [pendingMapAreaCenter, setPendingMapAreaCenter] = useState<QuestMapArea | null>(null);
    const [activeMapAreaCenter, setActiveMapAreaCenter] = useState<QuestMapArea | null>(null);
    const [collapsedCountryCodes, setCollapsedCountryCodes] = useState<Record<string, boolean>>({});
    const mapLocationAttemptedRef = useRef(false);
    const selectionChangedRef = useRef(false);

    // API data
    const { quests: ALL_QUESTS, loading: questsLoading, error: questsError } = useQuestsList();
    const dataLoaded = !questsLoading;
    const reviewedQuests = useMemo(() => filterReviewedQuests(ALL_QUESTS), [ALL_QUESTS]);
    // Личные срезы «Пройденные»/«Не пройденные» (#1791) — один связный концерн
    // со своей авторизационной границей, поэтому он живёт отдельным хуком.
    const personalSlices = useQuestPersonalSlices(ALL_QUESTS);
    const cityCatalog = useMemo(
        () => buildQuestCityCatalog<QuestMeta>(ALL_QUESTS),
        [ALL_QUESTS],
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
    const width = bpWidth;
    const isMobile = bpIsMobile;
    // Высота нужна только для размеров карты на native/desktop и берётся
    // НЕреактивным снапшотом: в стилях мобильного веба она не используется
    // (карта = 100dvh через CSS), поэтому отсутствие подписки на высоту ничего
    // не ломает, но убирает keyboard/address-bar-джиттер при вводе.
    const height = width > 0 ? Dimensions.get('window').height : 0;
    const s = useMemo(() => getStyles(colors, width, height), [colors, width, height]);

    // ── Persistent city selection ──
    useEffect(() => {
        (async () => {
            try {
                const saved = await AsyncStorage.getItem(STORAGE_SELECTED_CITY);
                const restored = resolveStoredQuestCatalogSelection(saved);
                if (selectionChangedRef.current) return;
                setSelectedCityId(restored);
                if (saved !== restored) {
                    await AsyncStorage.setItem(STORAGE_SELECTED_CITY, restored);
                }
            } catch {
                if (!selectionChangedRef.current) setSelectedCityId(ALL_QUESTS_ID);
            }
        })();
    }, []);

    const handleSelectCity = useCallback(async (id: string) => {
        if (id === NEARBY_ID && geoRequesting) return;
        selectionChangedRef.current = true;
        setSelectedCityId(id);
        setGeoRequesting(false);
        if (id === NEARBY_ID) {
            setNearbyRequestVersion((current) => current + 1);
        }
        setGeoMessage(null);
        setPendingMapAreaCenter(null);
        setActiveMapAreaCenter(null);
        if (isMobile) setFilterDrawerOpen(false);
        try {
            // Геофильтр контекстный: после нового запуска безопаснее снова
            // открыть весь каталог, а не запрашивать location без явного тапа.
            const persistedId = id === NEARBY_ID ? ALL_QUESTS_ID : id;
            await AsyncStorage.setItem(STORAGE_SELECTED_CITY, persistedId);
        } catch (error) {
            const { devError } = await import('@/utils/logger');
            devError('Error saving selected city:', error);
        }
    }, [geoRequesting, isMobile]);

    // Срез, переданный из профиля (#1794): применяем как обычный выбор.
    useQuestCatalogHandoff({ enabled: isFocused, onApply: handleSelectCity });

    const handleShowKidsQuests = useCallback(() => {
        void handleSelectCity(KIDS_FILTER_ID);
    }, [handleSelectCity]);

    const handleShowBikeQuests = useCallback(() => {
        void handleSelectCity(BIKE_FILTER_ID);
    }, [handleSelectCity]);

    const requestNearbyQuests = useCallback(() => {
        if (geoRequesting) return;
        void handleSelectCity(NEARBY_ID);
    }, [geoRequesting, handleSelectCity]);

    const handleResetFilters = useCallback(async () => {
        selectionChangedRef.current = true;
        setSelectedCityId(ALL_QUESTS_ID);
        setGeoRequesting(false);
        setGeoMessage(null);
        setPendingMapAreaCenter(null);
        setActiveMapAreaCenter(null);
        if (isMobile) setFilterDrawerOpen(false);
        try {
            await AsyncStorage.setItem(STORAGE_SELECTED_CITY, ALL_QUESTS_ID);
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

    // Без сохранённого/валидного выбора показываем явное состояние «Все
    // квесты». Оно не должно визуально маскироваться под геофильтр «Рядом».
    useEffect(() => {
        if (!dataLoaded || questsError) return;
        const canonicalCityId = selectedCityId ? cityCatalog.canonicalCityIdById[selectedCityId] : null;
        if (canonicalCityId && canonicalCityId !== selectedCityId) {
            setSelectedCityId(canonicalCityId);
            void AsyncStorage.setItem(STORAGE_SELECTED_CITY, canonicalCityId);
            return;
        }
        const validIds = new Set(CITIES.map((c) => c.id));
        const isValid = personalSlices.isSelectionValid(selectedCityId)
            || selectedCityId === ALL_QUESTS_ID
            || selectedCityId === NEARBY_ID
            || selectedCityId === KIDS_FILTER_ID
            || selectedCityId === BIKE_FILTER_ID
            || (selectedCityId === REVIEWED_FILTER_ID && reviewedQuests.length > 0)
            || (selectedCityId ? validIds.has(selectedCityId) : false);
        if (isValid) return;
        setSelectedCityId(ALL_QUESTS_ID);
        void AsyncStorage.setItem(STORAGE_SELECTED_CITY, ALL_QUESTS_ID);
    }, [CITIES, cityCatalog.canonicalCityIdById, dataLoaded, questsError, selectedCityId, reviewedQuests.length, personalSlices]);

    // Один владелец location-запроса: выбор «Рядом» и открытие карты не должны
    // запускать параллельные permission/current-position вызовы.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const isNearbySelection = selectedCityId === NEARBY_ID;
            if (viewMode !== 'map') mapLocationAttemptedRef.current = false;
            if (!isNearbySelection && viewMode !== 'map') {
                setGeoRequesting(false);
                return;
            }
            if (!isNearbySelection && mapLocationAttemptedRef.current) {
                setGeoRequesting(false);
                return;
            }
            if (viewMode === 'map') mapLocationAttemptedRef.current = true;
            if (isNearbySelection) setGeoRequesting(true);
            try {
                const Location = await loadExpoLocation();
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted' || cancelled) {
                    if (!cancelled && isNearbySelection) {
                        setSelectedCityId(ALL_QUESTS_ID);
                        setGeoMessage(i18nT('quests:screens.tabs.QuestsScreen.geolokatsiya_zapreschena_pokazyvaem_ves_kata_b7ae192f'));
                        await AsyncStorage.setItem(STORAGE_SELECTED_CITY, ALL_QUESTS_ID).catch(() => {});
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
                if (!cancelled && isNearbySelection) {
                    setSelectedCityId(ALL_QUESTS_ID);
                    setGeoMessage(i18nT('quests:screens.tabs.QuestsScreen.ne_udalos_opredelit_mestopolozhenie_proverte_34451827'));
                    await AsyncStorage.setItem(STORAGE_SELECTED_CITY, ALL_QUESTS_ID).catch(() => {});
                }
                console.warn('Error requesting nearby location', error);
            } finally {
                if (!cancelled && isNearbySelection) setGeoRequesting(false);
            }
        })();
        return () => { cancelled = true; };
    }, [selectedCityId, viewMode, nearbyRequestVersion]);

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

    const nearbyCount = useMemo(() => {
        if (!userLoc || !ALL_QUESTS.length) return null;
        return filterNearbyQuests(ALL_QUESTS, userLoc, nearbyRadiusKm).length;
    }, [userLoc, nearbyRadiusKm, ALL_QUESTS]);

    // Каталог собран из самих квестов, поэтому у каждого города счётчик заведомо
    // больше нуля — отдельный отсев «городов без квестов» больше не нужен.
    const cityQuestCountById = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const city of CITIES) {
            counts[city.id] = cityQuests[city.id]?.length || 0;
        }
        if (nearbyCount != null) counts[NEARBY_ID] = nearbyCount;
        counts[KIDS_FILTER_ID] = kidsQuests.length;
        counts[BIKE_FILTER_ID] = bikeQuests.length;
        counts[REVIEWED_FILTER_ID] = reviewedQuests.length;
        Object.assign(counts, personalSlices.counts);
        return counts;
    }, [CITIES, nearbyCount, cityQuests, kidsQuests.length, bikeQuests.length, reviewedQuests.length, personalSlices]);

    // Group cities by country
    const citiesByCountry = useMemo(() => {
        const collator = createCollator();
        const groups: Record<string, QuestCatalogCity[]> = {};
        for (const city of CITIES) {
            const code = city.countryCode || 'OTHER';
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
    }, [CITIES]);

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
        if (activeMapAreaCenter) {
            // «Искать в этой области» — отдельный фильтр, не «Рядом со мной».
            return filterQuestsByMapSearchArea(ALL_QUESTS, activeMapAreaCenter, nearbyRadiusKm);
        }
        if (selectedCityId === ALL_QUESTS_ID) {
            return ALL_QUESTS.map((q) => ({ ...q }));
        }
        if (selectedCityId === KIDS_FILTER_ID) {
            return kidsQuests.map((q) => ({ ...q }));
        }
        if (selectedCityId === BIKE_FILTER_ID) {
            return bikeQuests.map((q) => ({ ...q }));
        }
        if (selectedCityId === REVIEWED_FILTER_ID) {
            return reviewedQuests.map((q) => ({ ...q }));
        }
        const personalSlice = personalSlices.sliceFor(selectedCityId);
        if (personalSlice) return personalSlice.map((q) => ({ ...q }));
        if (selectedCityId === NEARBY_ID) {
            return filterNearbyQuests(ALL_QUESTS, userLoc, nearbyRadiusKm);
        }
        return (cityQuests[selectedCityId] || []).map((q) => ({ ...q }));
    }, [
        selectedCityId,
        userLoc,
        nearbyRadiusKm,
        ALL_QUESTS,
        dataLoaded,
        activeMapAreaCenter,
        searchTerm,
        cityQuests,
        kidsQuests,
        bikeQuests,
        reviewedQuests,
        personalSlices,
    ]);

    // «Популярные» — тот же порядок, которым бэкенд отвечает на `?sort=popular`
    // и по которому отобрано промо главной (#1798): прохождения → просмотры →
    // id. Правило одно на всех (`utils/questPopularity`), иначе витрина и
    // каталог показывали бы разные «популярные». Каталог уже выкачан целиком,
    // поэтому сортируем на месте, без второго запроса.
    //
    // Списки, упорядоченные по расстоянию («Рядом» с координатой, область
    // карты), переключатель не трогает: там смысл порядка задаёт близость.
    // Свободный поиск перекрывает и «Рядом», и область карты (см. `questsAll`
    // выше) — его выдача идёт в порядке каталога, поэтому сортировать её можно.
    const distanceOrdered = !searchTerm && (
        Boolean(activeMapAreaCenter)
        || (selectedCityId === NEARBY_ID && Boolean(userLoc))
    );
    const popularSortAvailable = !distanceOrdered && canRankQuestsByPopularity(questsAll);
    const popularSortActive = popularSortEnabled && popularSortAvailable;
    const visibleQuests = useMemo(
        () => (popularSortActive ? sortQuestsByPopularity(questsAll) : questsAll),
        [popularSortActive, questsAll],
    );
    const handleTogglePopularSort = useCallback(() => {
        setPopularSortEnabled((current) => !current);
    }, []);

    const catalogModel = useQuestCatalogResponsiveModel(questsAll.length);
    const questCardWidth = catalogModel.cardWidth;

    const mapPoints = useMemo<MapPoint[]>(() => {
        if (!dataLoaded) return [];
        if (!searchTerm && !selectedCityId) return [];
        const source = questsAll;

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
    }, [dataLoaded, selectedCityId, questsAll, searchTerm]);

    const mapCenter = useMemo(() => {
        const virtualFilterCenter = selectedCityId === KIDS_FILTER_ID
            || selectedCityId === BIKE_FILTER_ID
            || selectedCityId === REVIEWED_FILTER_ID
            || personalSlices.isPersonalSliceId(selectedCityId)
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
    }, [CITIES, mapPoints, searchTerm, selectedCityId, userLoc, activeMapAreaCenter, personalSlices]);

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
        selectionChangedRef.current = true;
        setActiveMapAreaCenter(pendingMapAreaCenter);
        setSelectedCityId(ALL_QUESTS_ID);
        setGeoMessage(null);
        setPendingMapAreaCenter(null);
        void AsyncStorage.setItem(STORAGE_SELECTED_CITY, ALL_QUESTS_ID);
    }, [pendingMapAreaCenter]);

    // Фильтр «сужает» каталог: выбран конкретный город, явный «Рядом» с радиусом
    // или область карты. В этих случаях показываем быстрый сброс к «Все квесты».
    const filtersActive = Boolean(
        (selectedCityId && selectedCityId !== ALL_QUESTS_ID)
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
        if (activeMapAreaCenter) {
            return i18nT('quests:screens.tabs.QuestsScreen.kvesty_oblast_na_karte_value1_value2_metrave_0008ee0f', { value1: questsAll.length, value2: i18nT('quests:screens.tabs.QuestsScreen.questNoun', { count: questsAll.length }) });
        }
        if (!selectedCityId) return i18nT('quests:screens.tabs.QuestsScreen.kvesty_metravel_1ee1a636');
        if (selectedCityId === NEARBY_ID) {
            if (!userLoc) {
                return i18nT('quests:screens.tabs.QuestsScreen.kvesty_ryadom_value1_metravel_684d20db', { value1: i18nT('quests:screens.tabs.QuestsScreen.geolokatsiya_otklyuchena_c6dfaf4a') });
            }
            const suffix = nearbyCount && nearbyCount > 0
                ? i18nT('quests:screens.tabs.QuestsScreen.value1_poblizosti_5f29a880', { value1: nearbyCount })
                : i18nT('quests:screens.tabs.QuestsScreen.ryadom_nichego_ne_naydeno_ac852a3a');
            return i18nT('quests:screens.tabs.QuestsScreen.kvesty_ryadom_value1_metravel_684d20db', { value1: suffix });
        }
        if (selectedCityId === KIDS_FILTER_ID) {
            return i18nT('quests:screens.tabs.QuestsScreen.kvesty_dlya_detey_value1_value2_metravel_3ce19948', { value1: kidsQuests.length, value2: i18nT('quests:screens.tabs.QuestsScreen.questNoun', { count: kidsQuests.length }) });
        }
        if (selectedCityId === BIKE_FILTER_ID) {
            return i18nT('quests:screens.tabs.QuestsScreen.veloTitle', { value1: bikeQuests.length, value2: i18nT('quests:screens.tabs.QuestsScreen.questNoun', { count: bikeQuests.length }) });
        }
        if (selectedCityId === REVIEWED_FILTER_ID) {
            return i18nT('quests:screens.tabs.QuestsScreen.reviewedSeoTitle');
        }
        if (selectedCityId === COMPLETED_FILTER_ID) {
            return i18nT('quests:screens.tabs.QuestsScreen.completedSeoTitle');
        }
        if (selectedCityId === UNCOMPLETED_FILTER_ID) {
            return i18nT('quests:screens.tabs.QuestsScreen.uncompletedSeoTitle');
        }
        // #1618: the unfiltered catalog (selectedCityId === ALL_QUESTS_ID, the
        // initial state) must match scripts/generate-seo-pages.js's static
        // `/quests` <title> byte-for-byte, or raw HTML and the hydrated
        // document.title/og:title permanently disagree for the bare route.
        return selectedCityName
            ? i18nT('quests:screens.tabs.QuestsScreen.kvesty_value1_metravel_f8aef4dd', { value1: selectedCityName })
            : i18nT('quests:screens.tabs.QuestsScreen.catalogTitleDefault');
    }, [selectedCityId, selectedCityName, nearbyCount, userLoc, activeMapAreaCenter, questsAll.length, kidsQuests.length, bikeQuests.length]);

    const descText = useMemo(() => {
        if (activeMapAreaCenter) {
            return i18nT('quests:screens.tabs.QuestsScreen.oflayn_kvesty_v_vybrannoy_oblasti_karty_pere_8dffb3a7');
        }
        if (selectedCityId === NEARBY_ID) {
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
    const reviewPromptSlot = useMemo(() => {
        if (!reviewPrompt) return null;
        const promptedQuest = ALL_QUESTS.find((quest) => quest.id === reviewPrompt.questId);
        return (
            <QuestReviewPromptBanner
                questId={reviewPrompt.questId}
                cityId={reviewPrompt.cityId ?? promptedQuest?.cityId}
                questTitle={promptedQuest?.title}
                onDismiss={dismissReviewPrompt}
            />
        );
    }, [ALL_QUESTS, dismissReviewPrompt, reviewPrompt]);

    return (
        <View style={s.root as ViewStyle} testID="quests-root">
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
                            nearbyRequesting={geoRequesting}
                            nearbyId={NEARBY_ID}
                            kidsFilterId={KIDS_FILTER_ID}
                            bikeFilterId={BIKE_FILTER_ID}
                            showCompletedFilter={personalSlices.showCompletedFilter}
                            showUncompletedFilter={personalSlices.showUncompletedFilter}
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

            {/* Reserve the desktop sidebar before hydration. The server snapshot
                intentionally uses the mobile breakpoint; the CSS media query on
                this slot still allocates its final width before the first paint. */}
            <View style={s.desktopSidebarSlot as ViewStyle} testID="quests-desktop-sidebar-slot">
                {!isMobile && (
                    <QuestsSidebar
                        styles={s}
                        colors={colors}
                        testID="quests-desktop-sidebar"
                        viewMode={viewMode}
                        selectedCityId={selectedCityId}
                        nearbyRequesting={geoRequesting}
                        nearbyId={NEARBY_ID}
                        kidsFilterId={KIDS_FILTER_ID}
                        bikeFilterId={BIKE_FILTER_ID}
                        showCompletedFilter={personalSlices.showCompletedFilter}
                        showUncompletedFilter={personalSlices.showUncompletedFilter}
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
            </View>

            <QuestsContentPanel
                noticeSlot={reviewPromptSlot}
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
                questsAll={visibleQuests}
                questCardWidth={questCardWidth}
                popularSortAvailable={popularSortAvailable}
                popularSortActive={popularSortActive}
                onTogglePopularSort={handleTogglePopularSort}
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
