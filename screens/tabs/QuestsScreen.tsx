import React, { useMemo, useState, useEffect, useCallback, useRef, Suspense } from 'react';
import {
    View, Pressable, Platform,
    Dimensions,
    ViewStyle,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useDockReservePx } from '@/components/layout/bottomChromeInset';
import safeLazy from '@/components/layout/safeLazy';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { jsonLdScript } from '@/components/seo/jsonLdScript';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { METRICS } from '@/constants/layout';
import { buildCanonicalUrl, buildOgImageUrl, QUESTS_OG_IMAGE_PATH } from '@/utils/seo';
import { createQuestCatalogSearch } from '@/utils/questCatalogSearch';
import { rIC } from '@/utils/rIC';
import { useIsFocused } from 'expo-router';
import { useBreakpoints } from '@/hooks/useResponsive';
import { useQuestCatalogResponsiveModel } from '@/hooks/useQuestCatalogResponsiveModel';
import { useTheme, useThemedColors } from '@/hooks/useTheme';
import { useQuestsList } from '@/hooks/useQuestsApi';
import { useHydrationReady } from '@/hooks/useHydrationReady';
import { useQuestReturnVisit } from '@/hooks/useQuestReturnVisit';
import { useQuestReviewPrompt } from '@/hooks/useQuestReviewPrompt';
import QuestsContentPanel from './QuestsContentPanel';
import { releaseQuestCatalogRestoredClass } from '@/utils/questCatalogSelection';
import { useQuestPersonalSlices } from './useQuestPersonalSlices';
import { getQuestFaqItems } from './QuestsSeoIntroFaq';
import type { QuestMeta } from './questsShared';
import { createQuestCatalogStructuredData } from '@/utils/discoverySeo';
import { useQuestDiscovery } from '@/components/quests/runtime/QuestDiscoveryContext';
import { getStyles } from './QuestsScreen.styles';
import {
    STORAGE_SELECTED_CITY,
    DEFAULT_NEARBY_RADIUS_KM,
    ALL_QUESTS_ID,
    NEARBY_ID,
    KIDS_FILTER_ID,
    BIKE_FILTER_ID,
    REVIEWED_FILTER_ID,
    COMPLETED_FILTER_ID,
    COMPLETED_BY_OTHERS_FILTER_ID,
    UNCOMPLETED_FILTER_ID,
    filterReviewedQuests,
    buildQuestCityCatalog,
    filterBikeQuests,
    filterKidsQuests,
    filterNearbyQuests,
    filterQuestsByMapSearchArea,
    parseThemeSelectionId,
    toThemeSelectionId,
    loadExpoLocation,
    type QuestMapArea,
} from './QuestsScreen.helpers';
import { canRankQuestsByPopularity, sortQuestsByPopularity } from '@/utils/questPopularity';
import { filterQuestsByTheme, getActiveQuestThemes, getQuestThemeById } from '@/utils/questThemes';
import { canRankQuestsByRating, sortQuestsByRating } from '@/utils/questRatingOrder';
import type { QuestSortOrder } from './questsShared';
import { useQuestCatalogHandoff } from './useQuestCatalogHandoff';
import { useQuestCatalogSelection, type QuestCatalogRouteSelection } from './useQuestCatalogSelection';
import { useQuestCountrySelection } from './useQuestCountrySelection';
import { useQuestCatalogSearchAnalytics } from './useQuestCatalogSearchAnalytics';
import { useQuestCatalogSearchQuery } from './useQuestCatalogSearchQuery';
import { translate as i18nT } from '@/i18n'

const { spacing, radii } = DESIGN_TOKENS;

// #1826: пустой каталог — одна и та же ссылка. Новый `[]` на каждом пересчёте
// ломал бы мемоизацию карточек ровно так же, как снятые отсюда спреды-копии.
const EMPTY_QUESTS: (QuestMeta & { _distanceKm?: number })[] = [];

// #2389: режим карты (точки, центр, сама карта) грузится по переключению на карту.
const QuestsMapSection = React.lazy(() => import('./QuestsMapSection'));
// #2389: the static snapshot uses the mobile breakpoint, so the sidebar never
// renders before hydration: on desktop it fills the reserved slot after it, on
// mobile it opens in the filter drawer on demand. Its chunk therefore stays out
// of the catalog chunk; a desktop viewport starts the import while the route
// chunk evaluates, in parallel with hydration.
const loadQuestsSidebar = () => import('./QuestsSidebar');
const QuestsSidebar = React.lazy(loadQuestsSidebar);
if (Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth >= METRICS.breakpoints.tablet) {
    void loadQuestsSidebar();
}
// #2360: optional banner stays out of the catalog chunk; safeLazy renders
// nothing if its chunk fails, instead of throwing the catalog into the boundary.
const QuestReviewPromptBanner = safeLazy(
  () => import('@/components/quests/QuestReviewPromptBanner'),
  'QuestReviewPromptBanner',
);

/** `/quests/<city>` (#2654): the catalog with the URL's slice, its own SEO and copy below the grid. */
export type QuestsCatalogRoute = QuestCatalogRouteSelection & { seo: React.ReactNode; footer?: React.ReactNode };

export default function QuestsScreen({ route = null }: { route?: QuestsCatalogRoute | null } = {}) {
    // #1484: заход в каталог после ранее завершённого квеста — это и есть
    // возврат, который меряет петля. Событие уходит один раз на прохождение.
    useQuestReturnVisit();
    // #1795 — просьба об отзыве по последнему пройденному квесту: один раз на
    // квест и не сразу после финиша (там форма и так на экране финала).
    const { prompt: reviewPrompt, dismiss: dismissReviewPrompt } = useQuestReviewPrompt();

    const isFocused = useIsFocused();
    const { selectedCityId, setSelectedCityId, select, selectionRestored, getGeneration, canApplyHandoff } =
        useQuestCatalogSelection(isFocused, () => {
            setSearchQuery('');
            setGeoRequesting(false);
            setGeoMessage(null);
            setPendingMapAreaCenter(null);
            setActiveMapAreaCenter(null);
            setFilterDrawerOpen(false);
        }, route);
    const selectionGeneration = getGeneration();
    const { searchQuery, setSearchQuery, searchTerm } = useQuestCatalogSearchQuery();
    const [nearbyRequestVersion, setNearbyRequestVersion] = useState(0);
    const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
    const [geoRequesting, setGeoRequesting] = useState(false);
    const [geoMessage, setGeoMessage] = useState<string | null>(null);
    const nearbyRadiusKm = DEFAULT_NEARBY_RADIUS_KM;
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [sortOrder, setSortOrder] = useState<QuestSortOrder>('default');
    const [pendingMapAreaCenter, setPendingMapAreaCenter] = useState<QuestMapArea | null>(null);
    const [activeMapAreaCenter, setActiveMapAreaCenter] = useState<QuestMapArea | null>(null);
    const mapLocationAttemptedRef = useRef(false);

    // API data
    const { quests: ALL_QUESTS, loading: questsLoading, error: questsError } = useQuestsList();
    // A server-rendered catalogue publishes its JSON-LD in the body: expo-router
    // Head never reaches the SSR HTML, so via Head crawlers would get none (#2817).
    const jsonLdInBody = Boolean(useQuestDiscovery());
    // A server-seeded catalogue still waits for hydration: the grid sizes its
    // cards from a measured width, so the first frame keeps the static skeleton
    // (no reflow of seeded cards — CLS 0.14 on /quests@1440 under SSR).
    const hydrationReady = useHydrationReady();
    const dataLoaded = hydrationReady && !questsLoading;
    const reviewedQuests = useMemo(() => filterReviewedQuests(ALL_QUESTS), [ALL_QUESTS]);
    // Личные срезы «Пройденные»/«Не пройденные» (#1791) — один связный концерн
    // со своей авторизационной границей, поэтому он живёт отдельным хуком.
    const personalSlices = useQuestPersonalSlices(ALL_QUESTS);
    const cityCatalog = useMemo(
        () => buildQuestCityCatalog<QuestMeta>(ALL_QUESTS),
        [ALL_QUESTS],
    );
    const catalogSearch = useMemo(
        () => createQuestCatalogSearch(ALL_QUESTS, cityCatalog.canonicalCityIdById),
        [ALL_QUESTS, cityCatalog],
    );
    const CITIES = cityCatalog.cities;
    const cityQuests = cityCatalog.questsByCityId;
    const {
        countryGroups: citiesByCountry,
        activeCountryCode,
        selectedCountry,
        collapsedCountryCodes,
        areAllCountryGroupsCollapsed,
        toggleCountryGroup: handleToggleCountryGroup,
        toggleAllCountryGroups: handleToggleAllCountryGroups,
    } = useQuestCountrySelection(selectedCityId, CITIES, cityQuests);
    // Выбранная тематическая подборка (#2377) по реестру, без окна сезона:
    // сохранённый выбор темы вне её сезона остаётся валидным срезом.
    const selectedTheme = useMemo(
        () => getQuestThemeById(parseThemeSelectionId(selectedCityId)),
        [selectedCityId],
    );

    const colors = useThemedColors();
    const { activeSeasonalTheme } = useTheme();
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
    //
    // #1826: читать её на КАЖДОМ рендере было мало: сама подписка на высоту
    // снята, но любой посторонний рендер (символ в поиске) подхватывал свежее
    // число, `getStyles` отдавал новый объект — и мемоизация карточек отбивалась
    // впустую ровно в тот кадр, ради которого затевалась. Ступень привязана к
    // ширине: настоящий ресайз окна и поворот меняют и её, клавиатура — нет.
    const height = useMemo(() => (width > 0 ? Dimensions.get('window').height : 0), [width]);
    const dockPx = useDockReservePx();
    const s = useMemo(() => getStyles(colors, width, height, dockPx), [colors, width, height, dockPx]);

    // #2389: on mobile web the sidebar opens in the filter drawer; warming its
    // chunk while idle keeps the first open from showing an empty panel.
    useEffect(() => (Platform.OS === 'web' ? rIC(() => { void loadQuestsSidebar(); }, 2000) : undefined), []);

    // ── Persistent city selection ──
    // #2320: восстановленный выбор отрисован — класс первого кадра больше не нужен.
    // Эффект идёт после коммита, в котором вводка уже снята React-ом (срез
    // сужает каталог) или уже стоит (срез «Все квесты») — снятие класса ничего
    // не двигает.
    useEffect(() => {
        if (selectionRestored && Platform.OS === 'web') releaseQuestCatalogRestoredClass();
    }, [selectionRestored]);

    const handleSelectCity = useCallback(async (id: string) => {
        if (id === NEARBY_ID && geoRequesting) return;
        const savingSelection = select(id, id === NEARBY_ID ? ALL_QUESTS_ID : id);
        setGeoRequesting(false);
        if (id === NEARBY_ID) {
            setNearbyRequestVersion((current) => current + 1);
        }
        setGeoMessage(null);
        setPendingMapAreaCenter(null);
        setActiveMapAreaCenter(null);
        if (isMobile) setFilterDrawerOpen(false);
        await savingSelection;
    }, [geoRequesting, isMobile, select]);

    // Срез, переданный из профиля (#1794): применяем как обычный выбор.
    useQuestCatalogHandoff({ enabled: isFocused && !route, onApply: handleSelectCity, getGeneration, canApply: canApplyHandoff });

    const handleShowKidsQuests = useCallback(() => {
        void handleSelectCity(KIDS_FILTER_ID);
    }, [handleSelectCity]);

    const handleShowBikeQuests = useCallback(() => {
        void handleSelectCity(BIKE_FILTER_ID);
    }, [handleSelectCity]);

    const handleShowTheme = useCallback((selectionId: string) => {
        void handleSelectCity(selectionId);
    }, [handleSelectCity]);

    const requestNearbyQuests = useCallback(() => {
        if (geoRequesting) return;
        void handleSelectCity(NEARBY_ID);
    }, [geoRequesting, handleSelectCity]);

    const handleResetFilters = useCallback(async () => {
        await handleSelectCity(ALL_QUESTS_ID);
    }, [handleSelectCity]);

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
        // URL navigation can commit a newer selection earlier in this effect
        // pass. Never normalize the previous render over that newer intent.
        if (getGeneration() !== selectionGeneration) return;
        const canonicalCityId = selectedCityId ? cityCatalog.canonicalCityIdById[selectedCityId] : null;
        if (canonicalCityId && canonicalCityId !== selectedCityId) {
            void select(canonicalCityId);
            return;
        }
        const validIds = new Set(CITIES.map((c) => c.id));
        const isValid = personalSlices.isSelectionValid(selectedCityId)
            || selectedCityId === ALL_QUESTS_ID
            || selectedCityId === NEARBY_ID
            || selectedCityId === KIDS_FILTER_ID
            || selectedCityId === BIKE_FILTER_ID
            || (selectedCityId === REVIEWED_FILTER_ID && reviewedQuests.length > 0)
            || Boolean(selectedCountry)
            || Boolean(selectedTheme)
            || (selectedCityId ? validIds.has(selectedCityId) : false);
        if (isValid) return;
        void select(ALL_QUESTS_ID);
    }, [CITIES, cityCatalog.canonicalCityIdById, dataLoaded, questsError, selectedCityId, selectionGeneration, getGeneration, select, selectedCountry, selectedTheme, reviewedQuests.length, personalSlices]);

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
            // #2389: сам запрос позиции и тексты отказа — отдельным чанком,
            // он грузится только по «Рядом» или открытию карты.
            let failure: string | null = null;
            try {
                // Оба чанка — параллельно: expo-location не ждёт загрузки модуля запроса.
                const [{ requestQuestCatalogLocation }] = await Promise.all([
                    import('./questCatalogLocation'),
                    loadExpoLocation(),
                ]);
                const result = await requestQuestCatalogLocation(() => cancelled);
                if (!result || cancelled) return;
                if ('coords' in result) {
                    setUserLoc(result.coords);
                    setGeoMessage(null);
                    return;
                }
                failure = result.failure;
            } catch (error) {
                // Сюда доходит только сбой загрузки самого чанка: игрок узнаёт
                // ту же причину, что и при сбое позиции, а не молчаливый сброс.
                failure = i18nT('quests:screens.tabs.QuestsScreen.ne_udalos_opredelit_mestopolozhenie_proverte_34451827');
                console.warn('Error requesting nearby location', error);
            } finally {
                if (!cancelled && isNearbySelection) setGeoRequesting(false);
            }
            if (cancelled || !isNearbySelection) return;
            setSelectedCityId(ALL_QUESTS_ID);
            setGeoMessage(failure);
            await AsyncStorage.setItem(STORAGE_SELECTED_CITY, ALL_QUESTS_ID).catch(() => {});
        })();
        return () => { cancelled = true; };
    }, [selectedCityId, setSelectedCityId, viewMode, nearbyRequestVersion]);

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
    // Тематические подборки (#2377): активные темы реестра (сезонные — в своём
    // окне дат), у которых есть хотя бы один квест. Пустая тема не рендерится.
    // Ручной выбор оформления сайта сразу открывает одноимённую подборку (#2409).
    const themeSlices = useMemo(
        () => getActiveQuestThemes(new Date(), activeSeasonalTheme)
            .map((theme) => ({ theme, selectionId: toThemeSelectionId(theme.id), quests: filterQuestsByTheme(ALL_QUESTS, theme) }))
            .filter((slice) => slice.quests.length > 0),
        [ALL_QUESTS, activeSeasonalTheme],
    );
    const themeEntries = useMemo(
        () => themeSlices.map(({ theme, selectionId }) => ({ id: theme.id, selectionId, label: theme.label, icon: theme.icon })),
        [themeSlices],
    );

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
        for (const slice of themeSlices) counts[slice.selectionId] = slice.quests.length;
        counts[REVIEWED_FILTER_ID] = reviewedQuests.length;
        Object.assign(counts, personalSlices.counts);
        return counts;
    }, [CITIES, nearbyCount, cityQuests, kidsQuests.length, bikeQuests.length, themeSlices, reviewedQuests.length, personalSlices]);

    const questsAll: (QuestMeta & { _distanceKm?: number })[] = useMemo(() => {
        if (!dataLoaded) return EMPTY_QUESTS;
        // Свободный поиск перекрывает город/«Рядом»: ищем по всему каталогу.
        if (searchTerm) {
            return ALL_QUESTS.filter((q) => catalogSearch(q, searchTerm));
        }
        if (!selectedCityId) return EMPTY_QUESTS;
        if (activeMapAreaCenter) {
            // «Искать в этой области» — отдельный фильтр, не «Рядом со мной».
            return filterQuestsByMapSearchArea(ALL_QUESTS, activeMapAreaCenter, nearbyRadiusKm);
        }
        if (selectedCityId === ALL_QUESTS_ID) {
            return ALL_QUESTS;
        }
        if (selectedCityId === KIDS_FILTER_ID) {
            return kidsQuests;
        }
        if (selectedCityId === BIKE_FILTER_ID) {
            return bikeQuests;
        }
        if (selectedCityId === REVIEWED_FILTER_ID) {
            return reviewedQuests;
        }
        if (selectedTheme) {
            // Сохранённый выбор темы вне её сезона всё равно отдаёт свои квесты:
            // окно дат прячет чип, а не ломает восстановленный срез.
            return themeSlices.find((slice) => slice.theme === selectedTheme)?.quests
                ?? filterQuestsByTheme(ALL_QUESTS, selectedTheme);
        }
        const personalSlice = personalSlices.sliceFor(selectedCityId);
        if (personalSlice) return personalSlice;
        if (selectedCityId === NEARBY_ID) {
            return filterNearbyQuests(ALL_QUESTS, userLoc, nearbyRadiusKm);
        }
        if (selectedCountry) return selectedCountry.quests;
        return cityQuests[selectedCityId] || EMPTY_QUESTS;
    }, [
        selectedCityId,
        selectedCountry,
        userLoc,
        nearbyRadiusKm,
        ALL_QUESTS,
        dataLoaded,
        activeMapAreaCenter,
        searchTerm,
        catalogSearch,
        cityQuests,
        kidsQuests,
        bikeQuests,
        reviewedQuests,
        selectedTheme,
        themeSlices,
        personalSlices,
    ]);

    useQuestCatalogSearchAnalytics({
        query: searchQuery,
        appliedSearchTerm: searchTerm,
        resultsCount: questsAll.length,
        ready: dataLoaded && !questsError,
        focused: isFocused,
    });

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
    //
    // Порядок каталога — ОДНО состояние с тремя значениями, а не набор
    // независимых тумблеров: «популярные» и «по рейтингу» взаимно исключают
    // друг друга, и двумя булевыми флагами это выражалось бы состоянием
    // «включены оба», которого не существует.
    //
    // Каждый вариант доступен только там, где данные делают порядок осмысленным
    // (см. `canRankQuestsByPopularity` и `canRankQuestsByRating`): пустая
    // сортировка хуже отсутствующей.
    const availableSortOrders = useMemo<QuestSortOrder[]>(() => {
        if (distanceOrdered) return [];
        const orders: QuestSortOrder[] = [];
        if (canRankQuestsByPopularity(questsAll)) orders.push('popular');
        if (canRankQuestsByRating(questsAll)) orders.push('rating');
        return orders;
    }, [distanceOrdered, questsAll]);

    // Выбранный порядок мог стать недоступным после смены фильтра или города —
    // тогда каталог молча возвращается к порядку по умолчанию, а не остаётся
    // отсортированным по исчезнувшей кнопке.
    const activeSortOrder: QuestSortOrder =
        sortOrder !== 'default' && availableSortOrders.includes(sortOrder) ? sortOrder : 'default';

    const visibleQuests = useMemo(() => {
        if (activeSortOrder === 'popular') return sortQuestsByPopularity(questsAll);
        if (activeSortOrder === 'rating') return sortQuestsByRating(questsAll);
        return questsAll;
    }, [activeSortOrder, questsAll]);
    // #1826: инлайн-стрелка делала любую мемоизацию панели пустой.
    const handleOpenFilterDrawer = useCallback(() => setFilterDrawerOpen(true), []);

    // Повторное нажатие по выбранному варианту возвращает порядок по умолчанию:
    // так сохраняется поведение прежнего тумблера «Популярные», к которому
    // посетитель уже привык.
    const handleSelectSortOrder = useCallback((order: QuestSortOrder) => {
        setSortOrder((current) => (current === order ? 'default' : order));
    }, []);

    const catalogModel = useQuestCatalogResponsiveModel(questsAll.length);
    const questCardWidth = catalogModel.cardWidth;

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
        void select(ALL_QUESTS_ID);
        setGeoMessage(null);
        setPendingMapAreaCenter(null);
    }, [pendingMapAreaCenter, select]);

    // Срез без своего города центрирует карту по своим квестам, а не по игроку.
    const centerMapOnQuests = selectedCityId === KIDS_FILTER_ID
        || selectedCityId === BIKE_FILTER_ID
        || selectedCityId === REVIEWED_FILTER_ID
        || personalSlices.isPersonalSliceId(selectedCityId)
        || Boolean(selectedCountry)
        || Boolean(selectedTheme);
    const mapSlot = useMemo(() => (viewMode === 'map' ? (
        <QuestsMapSection
            styles={s}
            colors={colors}
            dataLoaded={dataLoaded}
            quests={questsAll}
            cities={CITIES}
            selectedCityId={selectedCityId}
            searchTerm={searchTerm}
            centerOnQuests={centerMapOnQuests}
            userLoc={userLoc}
            activeMapAreaCenter={activeMapAreaCenter}
            showMapAreaSearch={!route && Boolean(pendingMapAreaCenter)}
            onSearchMapArea={handleSearchMapArea}
            onUserLocationChange={handleMapUserLocationChange}
            onMapMove={handleMapMove}
        />
    ) : null), [viewMode, s, colors, dataLoaded, questsAll, CITIES, selectedCityId, searchTerm, centerMapOnQuests, userLoc, activeMapAreaCenter, pendingMapAreaCenter, route, handleSearchMapArea, handleMapUserLocationChange, handleMapMove]);

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
                    : selectedCountry?.name ?? CITIES.find((c) => c.id === selectedCityId)?.name ?? null;

    const titleText = useMemo(() => {
        if (activeMapAreaCenter) {
            return i18nT('quests:screens.tabs.QuestsScreen.kvesty_oblast_na_karte_value1_value2_metrave_0008ee0f', { value1: questsAll.length, value2: i18nT('quests:screens.tabs.QuestsScreen.questNoun', { count: questsAll.length }) });
        }
        if (!selectedCityId) return i18nT('quests:screens.tabs.QuestsScreen.kvesty_metravel_1ee1a636');
        if (selectedCityId === NEARBY_ID) {
            if (!userLoc) {
                return i18nT('quests:screens.tabs.QuestsScreen.geolokatsiya_otklyuchena_c6dfaf4a');
            }
            const title = nearbyCount && nearbyCount > 0
                ? i18nT('quests:screens.tabs.QuestsScreen.value1_poblizosti_5f29a880', { value1: nearbyCount })
                : i18nT('quests:screens.tabs.QuestsScreen.ryadom_nichego_ne_naydeno_ac852a3a');
            return title;
        }
        if (selectedCityId === KIDS_FILTER_ID) {
            return i18nT('quests:screens.tabs.QuestsScreen.kvesty_dlya_detey_value1_value2_metravel_3ce19948', { value1: kidsQuests.length, value2: i18nT('quests:screens.tabs.QuestsScreen.questNoun', { count: kidsQuests.length }) });
        }
        if (selectedCityId === BIKE_FILTER_ID) {
            return i18nT('quests:screens.tabs.QuestsScreen.veloTitle', { value1: bikeQuests.length, value2: i18nT('quests:screens.tabs.QuestsScreen.questNoun', { count: bikeQuests.length }) });
        }
        if (selectedTheme) {
            return i18nT('quests:screens.tabs.QuestsScreen.themeTitle', { value1: selectedTheme.label, value2: questsAll.length, value3: i18nT('quests:screens.tabs.QuestsScreen.questNoun', { count: questsAll.length }) });
        }
        if (selectedCityId === REVIEWED_FILTER_ID) {
            return i18nT('quests:screens.tabs.QuestsScreen.reviewedSeoTitle');
        }
        if (selectedCityId === COMPLETED_FILTER_ID) {
            return i18nT('quests:screens.tabs.QuestsScreen.completedSeoTitle');
        }
        if (selectedCityId === COMPLETED_BY_OTHERS_FILTER_ID) {
            return i18nT('quests:screens.tabs.QuestsScreen.completedByOthersSeoTitle');
        }
        if (selectedCityId === UNCOMPLETED_FILTER_ID) {
            return i18nT('quests:screens.tabs.QuestsScreen.uncompletedSeoTitle');
        }
        // #1618: the unfiltered catalog (selectedCityId === ALL_QUESTS_ID, the
        // initial state) must match the static `/quests` <title> from
        // utils/seoRoutes/staticRoutes.js byte-for-byte, or raw HTML and the hydrated
        // document.title/og:title permanently disagree for the bare route.
        return selectedCityName
            ? i18nT('quests:screens.tabs.QuestsScreen.kvesty_value1_metravel_f8aef4dd', { value1: selectedCityName })
            : i18nT('quests:screens.tabs.QuestsScreen.catalogTitleDefault');
    }, [selectedCityId, selectedCityName, selectedTheme, nearbyCount, userLoc, activeMapAreaCenter, questsAll.length, kidsQuests.length, bikeQuests.length]);

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
        if (selectedTheme) {
            return i18nT('quests:screens.tabs.QuestsScreen.themeDescription', { value1: selectedTheme.label });
        }
        if (selectedCountry) return i18nT('quests:screens.tabs.QuestsScreen.countryDescription', { value1: selectedCountry.name });
        if (selectedCityName) return i18nT('quests:screens.tabs.QuestsScreen.oflayn_kvesty_v_gorode_value1_progulki_po_to_c1bef6e1', { value1: selectedCityName });
        return i18nT('quests:screens.tabs.QuestsScreen.issleduyte_goroda_i_parki_s_oflayn_kvestami__76e12a53');
    }, [selectedCityId, selectedCityName, selectedCountry, selectedTheme, userLoc, activeMapAreaCenter]);
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
                {jsonLdScript(questsStructuredData, { key: 'quests-structured-data' })}
                {jsonLdScript(questsFaqStructuredData, { key: 'quests-faq-structured-data' })}
            </>
        ),
        [questsStructuredData, questsFaqStructuredData]
    );

    // ── Render (Two-column layout) ──
    const reviewPromptSlot = useMemo(() => {
        if (!reviewPrompt) return null;
        const promptedQuest = ALL_QUESTS.find((quest) => quest.id === reviewPrompt.questId);
        return (
            <Suspense fallback={null}>
                <QuestReviewPromptBanner
                    questId={reviewPrompt.questId}
                    cityId={reviewPrompt.cityId ?? promptedQuest?.cityId}
                    questTitle={promptedQuest?.title}
                    onDismiss={dismissReviewPrompt}
                />
            </Suspense>
        );
    }, [ALL_QUESTS, dismissReviewPrompt, reviewPrompt]);

    // Один набор пропсов на мобильный drawer и десктопную колонку (#2087).
    const sidebarProps: React.ComponentProps<typeof QuestsSidebar> = {
        styles: s,
        colors,
        viewMode,
        selectedCityId,
        activeCountryCode,
        nearbyRequesting: geoRequesting,
        nearbyId: NEARBY_ID,
        kidsFilterId: KIDS_FILTER_ID,
        bikeFilterId: BIKE_FILTER_ID,
        themes: themeEntries,
        showCompletedFilter: personalSlices.showCompletedFilter,
        showCompletedByOthersFilter: personalSlices.showCompletedByOthersFilter,
        showUncompletedFilter: personalSlices.showUncompletedFilter,
        areAllCountryGroupsCollapsed,
        collapsedCountryCodes,
        citiesByCountry,
        cityQuestCountById,
        spacingMd: spacing.md,
        onSelectCity: handleSelectCity,
        onSetViewMode: handleSetViewMode,
        onToggleCountryGroup: handleToggleCountryGroup,
        onToggleAllCountryGroups: handleToggleAllCountryGroups,
    };

    return (
        <View style={s.root as ViewStyle} testID="quests-root">
            {isFocused && route ? route.seo : null}
            {isFocused && !route && (
                <InstantSEO
                    headKey="quests-index"
                    title={titleText}
                    description={descText}
                    canonical={buildCanonicalUrl('/quests')}
                    ogType="website"
                    image={buildOgImageUrl(QUESTS_OG_IMAGE_PATH)}
                    additionalTags={jsonLdInBody ? undefined : questsSeoTags}
                />
            )}
            {isFocused && !route && jsonLdInBody ? questsSeoTags : null}

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
                        <Suspense fallback={null}>
                            <QuestsSidebar
                                {...sidebarProps}
                                onCloseDrawer={() => setFilterDrawerOpen(false)}
                            />
                        </Suspense>
                    </View>
                </>
            )}

            {/* Reserve the desktop sidebar before hydration. The server snapshot
                intentionally uses the mobile breakpoint; the CSS media query on
                this slot still allocates its final width before the first paint. */}
            <View style={s.desktopSidebarSlot as ViewStyle} testID="quests-desktop-sidebar-slot">
                {!isMobile && (
                    <Suspense fallback={null}>
                        <QuestsSidebar {...sidebarProps} testID="quests-desktop-sidebar" />
                    </Suspense>
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
                appliedSearchTerm={searchTerm}
                onSearchChange={setSearchQuery}
                questsAll={visibleQuests}
                questCardWidth={questCardWidth}
                availableSortOrders={availableSortOrders}
                activeSortOrder={activeSortOrder}
                onSelectSortOrder={handleSelectSortOrder}
                mapSlot={mapSlot}
                userLoc={userLoc}
                isMapAreaActive={Boolean(activeMapAreaCenter)}
                geoMessage={geoMessage}
                geoRequesting={geoRequesting}
                radiiLg={radii.lg}
                isMobile={isMobile}
                filtersActive={filtersActive}
                onResetFilters={handleResetFilters}
                onShowKids={handleShowKidsQuests}
                onShowBike={handleShowBikeQuests}
                themeChips={themeEntries}
                onShowTheme={handleShowTheme}
                onShowNearby={requestNearbyQuests}
                onOpenFilterDrawer={handleOpenFilterDrawer}
                onToggleViewMode={handleToggleViewMode}
                footerSlot={route?.footer}
            />
        </View>
    );
}
