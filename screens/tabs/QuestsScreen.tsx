// src/screens/tabs/QuestsScreen.tsx
// Redesigned: Two-column layout like search page
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
    View, Pressable, Platform,
    ViewStyle,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { buildCanonicalUrl, buildOgImageUrl, QUESTS_OG_IMAGE_PATH } from '@/utils/seo';
import { stringifyJsonLd } from '@/utils/jsonLd';
import { haversineKm } from '@/utils/geo';
import { useIsFocused } from 'expo-router';
import { useResponsive } from '@/hooks/useResponsive';
import { useQuestCatalogResponsiveModel } from '@/hooks/useQuestCatalogResponsiveModel';
import { useThemedColors } from '@/hooks/useTheme';
import { useQuestsList, useQuestCities } from '@/hooks/useQuestsApi';
import QuestsContentPanel from './QuestsContentPanel';
import QuestsSidebar from './QuestsSidebar';
import type { City, NearbyCity, QuestMeta } from './questsShared';
import { createQuestCatalogStructuredData } from '@/utils/discoverySeo';
import { getStyles } from './QuestsScreen.styles';
import {
    COUNTRY_NAMES,
    STORAGE_SELECTED_CITY,
    STORAGE_NEARBY_RADIUS,
    DEFAULT_NEARBY_RADIUS_KM,
    NEARBY_ID,
    loadExpoLocation,
    type MapPoint,
} from './QuestsScreen.helpers';

const { spacing, radii } = DESIGN_TOKENS;

const LazyQuestMap = React.lazy(() => import('@/components/MapPage/Map.web'));

// ───────────── Main screen (Redesigned) ─────────────

export default function QuestsScreen() {
    const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
    // true только когда пользователь сам выбрал «Рядом» — тогда включаем
    // геолокацию и фильтрацию по радиусу. По умолчанию «Рядом» = все квесты.
    const [nearbyExplicit, setNearbyExplicit] = useState(false);
    const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
    const [geoRequesting, setGeoRequesting] = useState(false);
    const [geoMessage, setGeoMessage] = useState<string | null>(null);
    const [nearbyRadiusKm, setNearbyRadiusKm] = useState<number>(DEFAULT_NEARBY_RADIUS_KM);
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [pendingMapAreaCenter, setPendingMapAreaCenter] = useState<{ latitude: number; longitude: number } | null>(null);
    const [activeMapAreaCenter, setActiveMapAreaCenter] = useState<{ latitude: number; longitude: number } | null>(null);
    const [collapsedCountryCodes, setCollapsedCountryCodes] = useState<Record<string, boolean>>({});

    // API data
    const { quests: ALL_QUESTS, cityQuestsIndex: CITY_QUESTS, loading: questsLoading } = useQuestsList();
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

    const CITIES = useMemo<City[]>(() => apiCities.map(c => ({
        id: c.id,
        name: c.name,
        lat: c.lat,
        lng: c.lng,
        countryCode: cityCountryMetaById[c.id]?.countryCode || c.countryCode,
    })), [apiCities, cityCountryMetaById]);

    const isFocused = useIsFocused();
    const colors = useThemedColors();
    const responsive = useResponsive();
    const [layoutHydrated, setLayoutHydrated] = useState(Platform.OS !== 'web');
    useEffect(() => {
        setLayoutHydrated(true);
    }, []);
    const width = layoutHydrated ? responsive.width : 0;
    const height = layoutHydrated ? responsive.height : 0;
    const isMobile = layoutHydrated ? responsive.isMobile : true;
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
                setGeoMessage('Разрешите доступ к геолокации, чтобы показать квесты рядом с вами.');
                return;
            }
            const pos = await Location.getCurrentPositionAsync({
                accuracy: Location.LocationAccuracy.Balanced,
            });
            setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        } catch {
            setGeoMessage('Не удалось определить местоположение. Проверьте разрешения браузера и попробуйте ещё раз.');
        } finally {
            setGeoRequesting(false);
        }
    }, [geoRequesting, isMobile]);

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

    const handleSetRadius = useCallback(async (km: number) => {
        setNearbyRadiusKm(km);
        try {
            await AsyncStorage.setItem(STORAGE_NEARBY_RADIUS, String(km));
        } catch (error) {
            const { devError } = await import('@/utils/logger');
            devError('Error saving radius:', error);
        }
    }, []);

    // Без сохранённого/валидного выбора показываем «Все квесты» (мягкий дефолт
    // «Рядом» без геолокации = весь каталог), а не ближайший по гео единственный
    // город (иначе по умолчанию виден лишь 1 город из многих — баг F-09).
    // Гео-фильтрация по радиусу включается только при ЯВНОМ выборе «Рядом».
    useEffect(() => {
        if (!dataLoaded || !CITIES.length) return;
        const validIds = new Set(CITIES.map((c) => c.id));
        const isValid = selectedCityId === NEARBY_ID || (selectedCityId ? validIds.has(selectedCityId) : false);
        if (isValid) return;
        setSelectedCityId(NEARBY_ID);
    }, [CITIES, dataLoaded, selectedCityId]);

    // Nearby radius persistence
    useEffect(() => {
        (async () => {
            try {
                const saved = await AsyncStorage.getItem(STORAGE_NEARBY_RADIUS);
                if (saved) setNearbyRadiusKm(Number(saved));
            } catch (error) { console.warn('Error reading nearby radius storage', error); }
        })();
    }, []);

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
                        setGeoMessage('Геолокация запрещена. Показываем весь каталог, пока доступ не разрешён.');
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
                    setGeoMessage('Не удалось определить местоположение. Проверьте разрешения браузера и попробуйте ещё раз.');
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

    useEffect(() => {
        setPendingMapAreaCenter(null);
        setActiveMapAreaCenter(null);
    }, [nearbyRadiusKm]);

    // ── Derived data ──
    const citiesWithNearby: (City | NearbyCity)[] = useMemo(
        () => [{ id: NEARBY_ID, name: 'Рядом', country: 'BY', isNearby: true } as NearbyCity, ...CITIES],
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
            counts[city.id] = city.id === NEARBY_ID ? nearbyCount : (CITY_QUESTS[city.id]?.length || 0);
        }
        return counts;
    }, [citiesWithNearby, nearbyCount, CITY_QUESTS]);

    // Filter to show only cities with quests (plus Nearby always visible)
    const visibleCities = useMemo(() => {
        return filteredCities.filter((c) => c.id === NEARBY_ID || cityQuestCountById[c.id] > 0);
    }, [filteredCities, cityQuestCountById]);

    // Group cities by country
    const citiesByCountry = useMemo(() => {
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
            return (COUNTRY_NAMES[a] || a).localeCompare(COUNTRY_NAMES[b] || b, 'ru');
        });
        return sortedKeys.map(code => ({
            code,
            name: COUNTRY_NAMES[code] || (code === 'OTHER' ? '' : code),
            cities: groups[code].slice().sort((a, b) => a.name.localeCompare(b.name, 'ru')),
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

    const questsAll: (QuestMeta & { _distanceKm?: number })[] = useMemo(() => {
        if (!selectedCityId || !dataLoaded) return [];
        if (selectedCityId === NEARBY_ID) {
            if (activeMapAreaCenter) {
                const radiusKm = Math.max(nearbyRadiusKm, 5);
                return ALL_QUESTS
                    .map((q) => ({ ...q, _distanceKm: haversineKm(activeMapAreaCenter.latitude, activeMapAreaCenter.longitude, q.lat, q.lng) }))
                    .filter((q) => (q._distanceKm ?? Infinity) <= radiusKm)
                    .sort((a, b) => a._distanceKm! - b._distanceKm!);
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
        return (CITY_QUESTS[selectedCityId] || []).map((q) => ({ ...q }));
    }, [selectedCityId, userLoc, nearbyRadiusKm, ALL_QUESTS, CITY_QUESTS, dataLoaded, nearbyExplicit, activeMapAreaCenter]);

    const catalogModel = useQuestCatalogResponsiveModel(questsAll.length);
    const questCardWidth = catalogModel.cardWidth;

    const mapPoints = useMemo<MapPoint[]>(() => {
        if (!dataLoaded || !selectedCityId) return [];
        const source = selectedCityId === NEARBY_ID
            ? (userLoc || activeMapAreaCenter ? questsAll : ALL_QUESTS)
            : questsAll;

        return source
            .filter((q) => Number.isFinite(q.lat) && Number.isFinite(q.lng) && !!q.id)
            .map((q) => {
                const citySegmentRaw = selectedCityId === NEARBY_ID ? (q.cityId || '') : selectedCityId;
                const citySegment = encodeURIComponent(String(citySegmentRaw || 'city'));
                const questSegment = encodeURIComponent(String(q.id));
                const questUrl = buildCanonicalUrl(`/quests/${citySegment}/${questSegment}`);

                const coverUri = typeof q.cover === 'string' ? q.cover : '';
                return {
                    id: q.id,
                    coord: `${q.lat},${q.lng}`,
                    address: q.title,
                    travelImageThumbUrl: coverUri,
                    categoryName: 'Квест',
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
    }, [dataLoaded, selectedCityId, userLoc, activeMapAreaCenter, questsAll, ALL_QUESTS]);

    const mapCenter = useMemo(() => {
        if (activeMapAreaCenter && Number.isFinite(activeMapAreaCenter.latitude) && Number.isFinite(activeMapAreaCenter.longitude)) {
            return activeMapAreaCenter;
        }

        if (userLoc && Number.isFinite(userLoc.lat) && Number.isFinite(userLoc.lng)) {
            return { latitude: userLoc.lat, longitude: userLoc.lng };
        }

        const selectedCity = CITIES.find((c) => c.id === selectedCityId);
        if (selectedCity && Number.isFinite(selectedCity.lat) && Number.isFinite(selectedCity.lng)) {
            return { latitude: Number(selectedCity.lat), longitude: Number(selectedCity.lng) };
        }

        if (mapPoints.length > 0) {
            const sum = mapPoints.reduce(
                (acc, p) => {
                    const [latStr, lngStr] = p.coord.split(',').map((v) => v.trim());
                    const lat = Number(latStr);
                    const lng = Number(lngStr);
                    return {
                        lat: acc.lat + (Number.isFinite(lat) ? lat : 0),
                        lng: acc.lng + (Number.isFinite(lng) ? lng : 0),
                    };
                },
                { lat: 0, lng: 0 },
            );
            return {
                latitude: sum.lat / mapPoints.length,
                longitude: sum.lng / mapPoints.length,
            };
        }

        return { latitude: 53.9, longitude: 27.56 };
    }, [CITIES, mapPoints, selectedCityId, userLoc, activeMapAreaCenter]);

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

    const handleMapMove = useCallback((center: { latitude: number; longitude: number }) => {
        if (!center || !Number.isFinite(center.latitude) || !Number.isFinite(center.longitude)) return;
        setPendingMapAreaCenter(center);
    }, []);

    const handleSearchMapArea = useCallback(() => {
        if (!pendingMapAreaCenter) return;
        setActiveMapAreaCenter(pendingMapAreaCenter);
        setSelectedCityId(NEARBY_ID);
        setNearbyExplicit(false);
        setGeoMessage(null);
        setPendingMapAreaCenter(null);
    }, [pendingMapAreaCenter]);

    // ── SEO ──
    const selectedCityName =
        selectedCityId === NEARBY_ID ? 'Рядом' : CITIES.find((c) => c.id === selectedCityId)?.name ?? null;

    const titleText = useMemo(() => {
        if (!selectedCityId) return 'Квесты | MeTravel';
        if (selectedCityId === NEARBY_ID) {
            if (activeMapAreaCenter) {
                return `Квесты: область на карте — ${questsAll.length} ${questsAll.length === 1 ? 'квест' : 'квестов'} | MeTravel`;
            }
            if (!userLoc) {
                return 'Квесты: все города | MeTravel';
            }
            const suffix = userLoc
                ? nearbyCount > 0 ? ` — ${nearbyCount} поблизости • радиус ${nearbyRadiusKm} км` : ' — рядом ничего не найдено'
                : ' — геолокация отключена';
            return `Квесты: Рядом${suffix} | MeTravel`;
        }
        return selectedCityName
            ? `Квесты: ${selectedCityName} | MeTravel`
            : 'Все квесты | MeTravel';
    }, [selectedCityId, selectedCityName, nearbyCount, nearbyRadiusKm, userLoc, activeMapAreaCenter, questsAll.length]);

    const descText = useMemo(() => {
        if (selectedCityId === NEARBY_ID) {
            if (activeMapAreaCenter) {
                return 'Офлайн-квесты в выбранной области карты. Перемещайте карту и уточняйте поиск по текущему району.';
            }
            if (!userLoc) {
                return 'Каталог офлайн-квестов во всех доступных городах. Разрешите геолокацию, чтобы увидеть приключения рядом с вами.';
            }
            return 'Офлайн-квесты рядом с вами. Выбирайте радиус и исследуйте парки и улицы поблизости.';
        }
        if (selectedCityName) return `Офлайн-квесты в городе ${selectedCityName}. Прогулки по точкам, задания и маршруты.`;
        return 'Исследуйте города и парки с офлайн-квестами — приключения на карте рядом с вами.';
    }, [selectedCityId, selectedCityName, userLoc, activeMapAreaCenter]);
    const questsStructuredData = createQuestCatalogStructuredData({
        canonical: buildCanonicalUrl('/quests'),
        title: titleText,
        description: descText,
        quests: ALL_QUESTS,
    });
    const questsSeoTags = useMemo(
        () => (
            <script
                key="quests-structured-data"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: stringifyJsonLd(questsStructuredData) }}
            />
        ),
        [questsStructuredData]
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
                        accessibilityLabel="Закрыть меню"
                    />
                    <View style={s.sidebarMobile as ViewStyle}>
                        <QuestsSidebar
                            styles={s}
                            colors={colors}
                            viewMode={viewMode}
                            selectedCityId={selectedCityId}
                            nearbyId={NEARBY_ID}
                            nearbyRadiusKm={nearbyRadiusKm}
                            areAllCountryGroupsCollapsed={areAllCountryGroupsCollapsed}
                            collapsedCountryCodes={collapsedCountryCodes}
                            citiesByCountry={citiesByCountry}
                            cityQuestCountById={cityQuestCountById}
                            spacingMd={spacing.md}
                            onSelectCity={handleSelectCity}
                            onSetViewMode={handleSetViewMode}
                            onToggleCountryGroup={handleToggleCountryGroup}
                            onToggleAllCountryGroups={handleToggleAllCountryGroups}
                            onSetRadius={handleSetRadius}
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
                    nearbyRadiusKm={nearbyRadiusKm}
                    areAllCountryGroupsCollapsed={areAllCountryGroupsCollapsed}
                    collapsedCountryCodes={collapsedCountryCodes}
                    citiesByCountry={citiesByCountry}
                    cityQuestCountById={cityQuestCountById}
                    spacingMd={spacing.md}
                    onSelectCity={handleSelectCity}
                    onSetViewMode={handleSetViewMode}
                    onToggleCountryGroup={handleToggleCountryGroup}
                    onToggleAllCountryGroups={handleToggleAllCountryGroups}
                    onSetRadius={handleSetRadius}
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
                nearbyRadiusKm={nearbyRadiusKm}
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
