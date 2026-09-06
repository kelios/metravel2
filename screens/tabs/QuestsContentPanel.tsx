import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import type { ListRenderItemInfo, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';

import Map from '@/components/MapPage/Map';
import NavigationIcon from '@/components/layout/NavigationIcon';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import type { MapMovePayload } from '@/components/MapPage/Map/types';

import QuestCard from './QuestCard';
import { COMPLETED_BY_OTHERS_FILTER_ID, COMPLETED_FILTER_ID, REVIEWED_FILTER_ID, UNCOMPLETED_FILTER_ID } from './QuestsScreen.helpers';
import QuestsSeoIntroFaq from './QuestsSeoIntroFaq';
import { pluralizeQuest, type QuestMeta } from './questsShared';
import { translate as i18nT } from '@/i18n'

const useWebLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

type MapPoint = {
    id?: string | number;
    coord: string;
    address: string;
    travelImageThumbUrl: string;
    categoryName: string;
    articleUrl?: string;
    urlTravel?: string;
    questMeta?: {
        id: string;
        cityId: string;
    };
};

type QuestsContentPanelProps = {
    styles: any;
    colors: any;
    dataLoaded: boolean;
    viewMode: 'list' | 'map';
    selectedCityId: string | null;
    selectedCityName: string | null;
    nearbyId: string;
    kidsFilterId?: string;
    bikeFilterId?: string;
    searchQuery: string;
    onSearchChange: (text: string) => void;
    /** @deprecated Radius selection is no longer shown in the quest catalog. */
    nearbyRadiusKm?: number;
    questsAll: (QuestMeta & { _distanceKm?: number })[];
    questCardWidth: number;
    /** Есть ли в текущем срезе достаточно прохождений, чтобы предлагать сортировку. */
    popularSortAvailable?: boolean;
    popularSortActive?: boolean;
    onTogglePopularSort?: () => void;
    mapPoints: MapPoint[];
    mapCenter: { latitude: number; longitude: number };
    userLoc: { lat: number; lng: number } | null;
    isMapAreaActive: boolean;
    geoMessage: string | null;
    geoRequesting: boolean;
    showMapAreaSearch: boolean;
    radiiLg: number;
    LazyQuestMap: any;
    isMobile: boolean;
    filtersActive: boolean;
    onResetFilters: () => void;
    onShowKids?: () => void;
    onShowBike?: () => void;
    onShowNearby: () => void;
    onOpenFilterDrawer: () => void;
    onToggleViewMode: () => void;
    /** @deprecated Radius selection is no longer shown in the quest catalog. */
    onSetRadius?: (km: number) => void;
    onMapUserLocationChange: (loc: { latitude: number; longitude: number } | null) => void;
    onMapMove: (center: MapMovePayload) => void;
    onSearchMapArea: () => void;
    /** Мягкое уведомление над списком (сейчас — просьба об отзыве, #1795). */
    noticeSlot?: React.ReactNode;
};

type QuestListItem = QuestMeta & { _distanceKm?: number };

/** Сколько карточек каталога уходит в кадр за раз и когда подрастает окно. */
const QUEST_GRID_PAGE_SIZE = 24;
const QUEST_GRID_REVEAL_DISTANCE = 800;
const QUEST_GRID_SCROLL_THROTTLE = 32;

export default function QuestsContentPanel({
    styles,
    colors,
    dataLoaded,
    viewMode,
    selectedCityId,
    selectedCityName,
    nearbyId,
    kidsFilterId = '__kids__',
    bikeFilterId = '__bike__',
    searchQuery = '',
    onSearchChange = () => {},
    questsAll,
    questCardWidth,
    popularSortAvailable = false,
    popularSortActive = false,
    onTogglePopularSort = () => {},
    mapPoints,
    mapCenter,
    userLoc,
    isMapAreaActive,
    geoMessage,
    geoRequesting,
    showMapAreaSearch,
    radiiLg,
    LazyQuestMap,
    isMobile,
    filtersActive = false,
    onResetFilters,
    onShowKids = () => {},
    onShowBike = () => {},
    onShowNearby,
    onOpenFilterDrawer,
    onToggleViewMode,
    onMapUserLocationChange,
    onMapMove,
    onSearchMapArea,
    noticeSlot = null,
}: QuestsContentPanelProps) {
    // #1826: на web сетка каталога не виртуализирована — 177 карточек уходили в
    // первый кадр одним `map`. `FlatList` здесь не годится: он списочный, а
    // каталог — сетка с переносом, и её вёрстка менять нельзя. Поэтому окно
    // растёт по мере прокрутки. Ссылки на все квесты в статическом HTML это не
    // задевает: их кладёт отдельный скрытый индекс сборки
    // (`scripts/generate-seo-pages.js:injectQuestLinksIndex`), а не сама сетка.
    const [visibleCount, setVisibleCount] = useState(QUEST_GRID_PAGE_SIZE);

    // Смена набора (город, фильтр, поиск) начинает окно заново — иначе после
    // «все квесты» узкий срез рисовался бы с раздутым окном.
    useEffect(() => {
        setVisibleCount(QUEST_GRID_PAGE_SIZE);
    }, [questsAll]);

    const visibleQuests = useMemo(
        () => (questsAll.length <= visibleCount ? questsAll : questsAll.slice(0, visibleCount)),
        [questsAll, visibleCount],
    );

    const revealMoreQuests = useCallback(() => {
        setVisibleCount((current) => (
            current >= questsAll.length ? current : current + QUEST_GRID_PAGE_SIZE
        ));
    }, [questsAll.length]);

    const handleGridScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
        const distanceToEnd = contentSize.height - (contentOffset.y + layoutMeasurement.height);
        if (distanceToEnd <= QUEST_GRID_REVEAL_DISTANCE) revealMoreQuests();
    }, [revealMoreQuests]);

    const router = useRouter();
    const searchActive = searchQuery.trim().length > 0;

    // The no-JS catalog is intentionally visible in generated HTML. Once the
    // interactive catalog mounts, remove only its explicitly marked SSG nodes
    // so users and assistive technology do not see a duplicate quest listing.
    useWebLayoutEffect(() => {
        if (Platform.OS !== 'web' || typeof document === 'undefined') return;

        const listing = document.querySelector('section[data-ssg-quests-listing="true"]');
        listing?.parentNode?.removeChild(listing);

        const listingStyle = document.querySelector('style[data-ssg-quests-listing-style="true"]');
        listingStyle?.parentNode?.removeChild(listingStyle);
    }, []);

    // SEO intro + FAQ describe the whole /quests catalog. Show them on the default
    // list view (not in map mode, not while searching) so the visible copy matches
    // the crawlable static block generated for /quests.
    const showSeoContent = viewMode === 'list' && !searchActive && !filtersActive;
    const seoIntroSlot = showSeoContent ? (
        <View style={styles.seoContentBlock}>
            <QuestsSeoIntroFaq variant="intro" />
        </View>
    ) : null;
    const seoFaqSlot = showSeoContent ? (
        <View style={styles.seoContentBlock}>
            <QuestsSeoIntroFaq variant="faq" />
        </View>
    ) : null;

    const openQuestFromPoint = (point?: { questMeta?: MapPoint['questMeta'] }) => {
        const meta = point?.questMeta;
        if (!meta?.cityId || !meta?.id) return;
        router.push(`/quests/${meta.cityId}/${meta.id}`);
    };

    const getQuestCityId = useCallback(
        (quest: QuestListItem) => quest.cityId || selectedCityId || '',
        [selectedCityId],
    );

    const renderQuestItem = useCallback(({ item: quest, index }: ListRenderItemInfo<QuestListItem>) => (
        <View style={styles.questVirtualizedItem}>
            <QuestCard
                styles={styles}
                cityId={getQuestCityId(quest)}
                quest={quest}
                nearby={selectedCityId === nearbyId && !!userLoc && !isMapAreaActive}
                cardWidth={questCardWidth}
                index={index}
            />
        </View>
    ), [getQuestCityId, isMapAreaActive, nearbyId, questCardWidth, selectedCityId, styles, userLoc]);

    const questKeyExtractor = useCallback((quest: QuestListItem) => String(quest.id), []);

    const contentHeader = (
        <View style={styles.contentHeader} testID="quests-content-header">
            <View style={styles.contentHeaderTopRow}>
                <View style={styles.contentTitleBlock}>
                    <Text
                        style={styles.contentTitle}
                        numberOfLines={2}
                        accessibilityRole="header"
                        {...({ 'aria-level': 1 } as Record<string, unknown>)}
                        testID="quests-content-title"
                    >
                        {searchActive
                            ? i18nT('quests:screens.tabs.QuestsContentPanel.rezultaty_poiska_5ebb750c')
                            : isMapAreaActive
                                ? i18nT('quests:screens.tabs.QuestsContentPanel.kvesty_v_etoy_oblasti_f59f59da')
                                : selectedCityId === nearbyId
                                    ? i18nT('quests:screens.tabs.QuestsContentPanel.kvesty_poblizosti_02dcd1cf')
                                    : selectedCityId === kidsFilterId
                                        ? i18nT('quests:screens.tabs.QuestsContentPanel.kvesty_dlya_detey_fbda5ab0')
                                        : selectedCityId === bikeFilterId
                                            ? i18nT('quests:screens.tabs.QuestsContentPanel.veloTitle')
                                            : selectedCityId === REVIEWED_FILTER_ID
                                                ? i18nT('quests:screens.tabs.QuestsScreen.reviewedTitle')
                                                : selectedCityId === COMPLETED_FILTER_ID
                                                    ? i18nT('quests:screens.tabs.QuestsContentPanel.completedTitle')
                                                    : selectedCityId === COMPLETED_BY_OTHERS_FILTER_ID
                                                        ? i18nT('quests:screens.tabs.QuestsContentPanel.completedByOthersTitle')
                                                        : selectedCityId === UNCOMPLETED_FILTER_ID
                                                            ? i18nT('quests:screens.tabs.QuestsContentPanel.uncompletedTitle')
                                                            : selectedCityName
                                                                ? i18nT('quests:screens.tabs.QuestsContentPanel.locationTitle', { value1: selectedCityName })
                                                                : i18nT('quests:screens.tabs.QuestsContentPanel.vse_kvesty_1c003efd')}
                    </Text>
                    <View style={styles.contentCountRow}>
                        {dataLoaded && <Text style={styles.contentCount}>{pluralizeQuest(questsAll.length)}</Text>}
                        {dataLoaded && !searchActive && filtersActive && (
                            <Pressable
                                style={styles.resetFiltersChip}
                                onPress={onResetFilters}
                                accessibilityRole="button"
                                accessibilityLabel={i18nT('quests:screens.tabs.QuestsContentPanel.sbrosit_filtry_i_pokazat_vse_kvesty_79d935b0')}
                                hitSlop={8}
                                testID="quests-reset-filters"
                            >
                                <Feather name="x" size={13} color={colors.primary} />
                                <Text style={styles.resetFiltersChipText}>{i18nT('quests:screens.tabs.QuestsContentPanel.vse_kvesty_1c003efd')}</Text>
                            </Pressable>
                        )}
                        {dataLoaded && popularSortAvailable && (
                            <Pressable
                                style={[styles.sortChip, popularSortActive && styles.sortChipActive]}
                                onPress={onTogglePopularSort}
                                accessibilityRole="button"
                                accessibilityLabel={popularSortActive
                                    ? i18nT('quests:screens.tabs.QuestsContentPanel.popularSortA11yOff')
                                    : i18nT('quests:screens.tabs.QuestsContentPanel.popularSortA11yOn')}
                                accessibilityState={{ selected: popularSortActive }}
                                hitSlop={8}
                                testID="quests-sort-popular"
                            >
                                <Feather
                                    name="trending-up"
                                    size={13}
                                    color={popularSortActive ? colors.textOnPrimary : colors.primary}
                                />
                                <Text style={[styles.sortChipText, popularSortActive && styles.sortChipTextActive]}>
                                    {i18nT('quests:screens.tabs.QuestsContentPanel.popularSortLabel')}
                                </Text>
                            </Pressable>
                        )}
                    </View>
                </View>
                {isMobile && (
                    <View style={styles.headerToggleRow} testID="quests-mobile-controls">
                        <Pressable
                            style={[styles.headerIconBtn, viewMode === 'map' && styles.headerIconBtnActive]}
                            onPress={onToggleViewMode}
                            accessibilityRole="button"
                            accessibilityLabel={viewMode === 'map' ? i18nT('quests:screens.tabs.QuestsContentPanel.pokazat_spisok_kvestov_a0806030') : i18nT('quests:screens.tabs.QuestsContentPanel.pokazat_kvesty_na_karte_afca9878')}
                            testID="quests-toggle-view-mode"
                        >
                            <Feather
                                name={viewMode === 'map' ? 'list' : 'map'}
                                size={17}
                                color={viewMode === 'map' ? colors.textOnPrimary : colors.text}
                            />
                        </Pressable>
                        <Pressable
                            style={styles.headerIconBtn}
                            onPress={onOpenFilterDrawer}
                            accessibilityRole="button"
                            accessibilityLabel={i18nT('quests:screens.tabs.QuestsContentPanel.vybrat_gorod_0bc4253e')}
                        >
                            <Feather name="filter" size={17} color={colors.text} />
                        </Pressable>
                        <Pressable
                            style={[styles.headerIconBtn, selectedCityId === kidsFilterId && styles.headerIconBtnActive]}
                            onPress={onShowKids}
                            accessibilityRole="button"
                            accessibilityLabel={i18nT('quests:screens.tabs.QuestsContentPanel.pokazat_kvesty_dlya_detey_dd437d45')}
                            accessibilityState={{ selected: selectedCityId === kidsFilterId }}
                            testID="quests-show-kids"
                        >
                            <Feather
                                name="smile"
                                size={17}
                                color={selectedCityId === kidsFilterId ? colors.textOnPrimary : colors.text}
                            />
                        </Pressable>
                        <Pressable
                            style={[styles.headerIconBtn, selectedCityId === bikeFilterId && styles.headerIconBtnActive]}
                            onPress={onShowBike}
                            accessibilityRole="button"
                            accessibilityLabel={i18nT('quests:screens.tabs.QuestsContentPanel.veloShowA11y')}
                            accessibilityState={{ selected: selectedCityId === bikeFilterId }}
                            testID="quests-show-bike"
                        >
                            <NavigationIcon
                                name="bike"
                                size={17}
                                color={selectedCityId === bikeFilterId ? colors.textOnPrimary : colors.text}
                            />
                        </Pressable>
                        <Pressable
                            style={[
                                styles.headerIconBtn,
                                selectedCityId === nearbyId && styles.headerIconBtnActive,
                                geoRequesting && styles.headerIconBtnDisabled,
                            ]}
                            onPress={onShowNearby}
                            disabled={geoRequesting}
                            accessibilityRole="button"
                            accessibilityLabel={geoRequesting ? i18nT('quests:screens.tabs.QuestsContentPanel.ischem_kvesty_ryadom_so_mnoy_f5a72f30') : i18nT('quests:screens.tabs.QuestsContentPanel.pokazat_kvesty_ryadom_so_mnoy_d7a7ee55')}
                            accessibilityState={{ selected: selectedCityId === nearbyId, disabled: geoRequesting }}
                            testID="quests-show-nearby"
                        >
                            <Feather
                                name="navigation"
                                size={17}
                                color={selectedCityId === nearbyId ? colors.textOnPrimary : colors.text}
                            />
                        </Pressable>
                    </View>
                )}
            </View>

            <View style={styles.searchRow}>
                <Feather name="search" size={16} color={colors.textMuted} />
                <TextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={onSearchChange}
                    placeholder={i18nT('quests:screens.tabs.QuestsContentPanel.poisk_po_nazvaniyu_gorodu_ili_syuzhetu_cb3eef48')}
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="search"
                    autoCorrect={false}
                    clearButtonMode="never"
                    accessibilityLabel={i18nT('quests:screens.tabs.QuestsContentPanel.poisk_kvestov_po_nazvaniyu_gorodu_ili_syuzhe_8ff547ba')}
                    testID="quests-search-input"
                />
                {searchActive && (
                    <Pressable
                        style={styles.searchClearBtn}
                        onPress={() => onSearchChange('')}
                        accessibilityRole="button"
                        accessibilityLabel={i18nT('quests:screens.tabs.QuestsContentPanel.ochistit_poisk_c6fc5f29')}
                        hitSlop={8}
                        testID="quests-search-clear"
                    >
                        <Feather name="x" size={16} color={colors.textMuted} />
                    </Pressable>
                )}
            </View>
        </View>
    );

    // «Пройденные» — единственный срез, который может оказаться пустым при
    // живом фильтре: он показывается любому вошедшему игроку, в том числе тому,
    // кто ещё ничего не прошёл. Пустая сетка без объяснения выглядела бы как
    // сломанный каталог, поэтому здесь явное состояние с выходом обратно.
    const completedEmptyState = !searchActive
        && !isMapAreaActive
        && selectedCityId === COMPLETED_FILTER_ID
        && dataLoaded ? (
            <EmptyState
                icon="check-circle"
                title={i18nT('quests:screens.tabs.QuestsContentPanel.completedEmptyTitle')}
                description={i18nT('quests:screens.tabs.QuestsContentPanel.completedEmptyDescription')}
                variant="empty"
                iconSize={48}
                action={{
                    label: i18nT('quests:screens.tabs.QuestsContentPanel.completedEmptyAction'),
                    onPress: onResetFilters,
                }}
            />
        ) : null;

    const geoMessageBlock = geoMessage ? (
        <View style={styles.nearbyCtaBlock}>
            <Text style={styles.geoMessageText} testID="quests-geo-message">
                {geoMessage}
            </Text>
        </View>
    ) : null;

    const inner = (
        <>
            {contentHeader}

            {noticeSlot}

            <View
                style={[styles.contentBody, viewMode === 'map' && isMobile && styles.contentBodyMap]}
                testID="quests-content-body"
            >
                {geoMessageBlock}

                {viewMode === 'map' ? (
                    <View style={styles.mapSection}>
                        {dataLoaded && selectedCityId === nearbyId && !userLoc && !isMapAreaActive && (
                            <View style={styles.geoBanner} testID="quests-geo-banner">
                                <Feather name="map-pin" size={13} color={colors.warning} />
                                <Text style={styles.geoBannerText}>
                                    {i18nT('quests:screens.tabs.QuestsContentPanel.geolokatsiya_otklyuchena_pokazyvaem_vse_kves_48d7a8ae')}</Text>
                            </View>
                        )}

                        {!dataLoaded && (
                            <View style={styles.mapLoading}>
                                <ActivityIndicator color={colors.primary} />
                            </View>
                        )}

                        {/* Карта-исследование: держим карту живой всегда после загрузки.
                            Ноль квестов = нет маркеров, но карта видна и интерактивна —
                            пользователь двигает область и повторяет «Искать в этой области». */}
                        {dataLoaded && Platform.OS === 'web' && (
                            <View style={styles.mapContainer}>
                                {showMapAreaSearch && (
                                    <Pressable
                                        style={styles.mapSearchAreaBtn}
                                        onPress={onSearchMapArea}
                                        accessibilityRole="button"
                                        accessibilityLabel={i18nT('quests:screens.tabs.QuestsContentPanel.iskat_v_etoy_oblasti_2dbf958f')}
                                        testID="quests-map-search-area"
                                    >
                                        <Feather name="search" size={15} color={colors.textOnPrimary} />
                                        <Text style={styles.mapSearchAreaBtnText}>{i18nT('quests:screens.tabs.QuestsContentPanel.iskat_v_etoy_oblasti_2dbf958f')}</Text>
                                    </Pressable>
                                )}
                                <Suspense fallback={<View style={styles.mapLoading}><ActivityIndicator color={colors.primary} /></View>}>
                                    <LazyQuestMap
                                        travel={{ data: mapPoints as any }}
                                        coordinates={mapCenter}
                                        userLocation={userLoc ? { latitude: userLoc.lat, longitude: userLoc.lng } : null}
                                        pointsOnly
                                        mode="radius"
                                        showRadiusCircle={false}
                                        routePoints={[]}
                                        transportMode="foot"
                                        onMapClick={() => {}}
                                        setRouteDistance={() => {}}
                                        setFullRouteCoords={() => {}}
                                        onUserLocationChange={onMapUserLocationChange}
                                        onMapMove={onMapMove}
                                    />
                                </Suspense>
                            </View>
                        )}

                        {dataLoaded && Platform.OS !== 'web' && (
                            <View style={styles.mapContainer}>
                                {showMapAreaSearch && (
                                    <Pressable
                                        style={styles.mapSearchAreaBtn}
                                        onPress={onSearchMapArea}
                                        accessibilityRole="button"
                                        accessibilityLabel={i18nT('quests:screens.tabs.QuestsContentPanel.iskat_v_etoy_oblasti_2dbf958f')}
                                        testID="quests-map-search-area"
                                    >
                                        <Feather name="search" size={15} color={colors.textOnPrimary} />
                                        <Text style={styles.mapSearchAreaBtnText}>{i18nT('quests:screens.tabs.QuestsContentPanel.iskat_v_etoy_oblasti_2dbf958f')}</Text>
                                    </Pressable>
                                )}
                                <Map
                                    travel={{ data: mapPoints as any }}
                                    coordinates={mapCenter}
                                    userLocation={userLoc ? { latitude: userLoc.lat, longitude: userLoc.lng } : null}
                                    pointsOnly
                                    mode="radius"
                                    showRadiusCircle={false}
                                    routePoints={[]}
                                    transportMode="foot"
                                    onMapClick={() => {}}
                                    onMarkerSelect={openQuestFromPoint}
                                    setRouteDistance={() => {}}
                                    setFullRouteCoords={() => {}}
                                    onUserLocationChange={onMapUserLocationChange}
                                    onMapMove={onMapMove}
                                />
                            </View>
                        )}
                    </View>
                ) : (
                    <>
                        {seoIntroSlot}

                        {searchActive && questsAll.length === 0 && dataLoaded && (
                            <EmptyState
                                icon="search"
                                title={i18nT('quests:screens.tabs.QuestsContentPanel.nichego_ne_naydeno_21857ccf')}
                                description={i18nT('quests:screens.tabs.QuestsContentPanel.poprobuyte_drugoe_nazvanie_ili_gorod_980ce716')}
                                variant="empty"
                                iconSize={48}
                            />
                        )}

                        {!searchActive && isMapAreaActive && questsAll.length === 0 && dataLoaded && (
                            <EmptyState
                                icon="map-pin"
                                title={i18nT('quests:screens.tabs.QuestsContentPanel.ryadom_nichego_ne_naydeno_271dd8e7')}
                                description={i18nT('quests:screens.tabs.QuestsContentPanel.posmotrite_kvesty_v_drugih_gorodah_ili_vyber_720d6ffd')}
                                variant="empty"
                                iconSize={48}
                            />
                        )}

                        {!searchActive && !isMapAreaActive && selectedCityId === nearbyId && userLoc && questsAll.length === 0 && dataLoaded && (
                            <EmptyState
                                icon="map-pin"
                                title={i18nT('quests:screens.tabs.QuestsContentPanel.ryadom_nichego_ne_naydeno_271dd8e7')}
                                description={i18nT('quests:screens.tabs.QuestsContentPanel.posmotrite_kvesty_v_drugih_gorodah_ili_vyber_720d6ffd')}
                                variant="empty"
                                iconSize={48}
                            />
                        )}

                        {!searchActive && !isMapAreaActive && selectedCityId === nearbyId && !userLoc && geoRequesting && dataLoaded && (
                            <View style={styles.mapLoading} testID="quests-nearby-loading">
                                <ActivityIndicator color={colors.primary} />
                            </View>
                        )}

                        {!searchActive && !selectedCityId && dataLoaded && (
                            <EmptyState
                                icon="compass"
                                title={i18nT('quests:screens.tabs.QuestsContentPanel.vyberite_gorod_023bdfab')}
                                description={isMobile ? i18nT('quests:screens.tabs.QuestsContentPanel.nazhmite_gorod_chtoby_vybrat_bdb9cf3e') : i18nT('quests:screens.tabs.QuestsContentPanel.vyberite_gorod_iz_spiska_sleva_3a187f1e')}
                                variant="empty"
                                iconSize={48}
                            />
                        )}

                        {questsAll.length === 0 && completedEmptyState}

                        {!dataLoaded && (
                            <View style={styles.skeletonGrid}>
                                {Array.from({ length: isMobile ? 2 : 4 }).map((_, i) => (
                                    <View key={i} style={styles.skeletonCard}>
                                        <SkeletonLoader width="100%" height={180} borderRadius={radiiLg} />
                                    </View>
                                ))}
                            </View>
                        )}

                        {dataLoaded && questsAll.length > 0 && (
                            <View style={styles.questsGrid}>
                                {visibleQuests.map((quest, index) => (
                                    <QuestCard
                                        key={quest.id}
                                        styles={styles}
                                        cityId={getQuestCityId(quest)}
                                        quest={quest}
                                        nearby={selectedCityId === nearbyId && !!userLoc && !isMapAreaActive}
                                        cardWidth={questCardWidth}
                                        index={index}
                                    />
                                ))}
                            </View>
                        )}

                        {seoFaqSlot}
                    </>
                )}
            </View>
        </>
    );

    // Пустые/загрузочные состояния списка для нативного FlatList. Держим их в
    // ListEmptyComponent, чтобы корневой узел (и шапка с TextInput) не менялся
    // между «есть результаты» и «0 результатов» — иначе поддерево с полем поиска
    // перемонтируется, поле теряет фокус и клавиатура закрывается при наборе.
    const listEmptyContent = (
        <>
            {searchActive && dataLoaded && (
                <EmptyState
                    icon="search"
                    title={i18nT('quests:screens.tabs.QuestsContentPanel.nichego_ne_naydeno_21857ccf')}
                    description={i18nT('quests:screens.tabs.QuestsContentPanel.poprobuyte_drugoe_nazvanie_ili_gorod_980ce716')}
                    variant="empty"
                    iconSize={48}
                />
            )}

            {!searchActive && isMapAreaActive && dataLoaded && (
                <EmptyState
                    icon="map-pin"
                    title={i18nT('quests:screens.tabs.QuestsContentPanel.ryadom_nichego_ne_naydeno_271dd8e7')}
                    description={i18nT('quests:screens.tabs.QuestsContentPanel.posmotrite_kvesty_v_drugih_gorodah_ili_vyber_720d6ffd')}
                    variant="empty"
                    iconSize={48}
                />
            )}

            {!searchActive && !isMapAreaActive && selectedCityId === nearbyId && userLoc && dataLoaded && (
                <EmptyState
                    icon="map-pin"
                    title={i18nT('quests:screens.tabs.QuestsContentPanel.ryadom_nichego_ne_naydeno_271dd8e7')}
                    description={i18nT('quests:screens.tabs.QuestsContentPanel.posmotrite_kvesty_v_drugih_gorodah_ili_vyber_720d6ffd')}
                    variant="empty"
                    iconSize={48}
                />
            )}

            {!searchActive && !isMapAreaActive && selectedCityId === nearbyId && !userLoc && geoRequesting && dataLoaded && (
                <View style={styles.mapLoading} testID="quests-nearby-loading">
                    <ActivityIndicator color={colors.primary} />
                </View>
            )}

            {!searchActive && !selectedCityId && dataLoaded && (
                <EmptyState
                    icon="compass"
                    title={i18nT('quests:screens.tabs.QuestsContentPanel.vyberite_gorod_023bdfab')}
                    description={isMobile ? i18nT('quests:screens.tabs.QuestsContentPanel.nazhmite_gorod_chtoby_vybrat_bdb9cf3e') : i18nT('quests:screens.tabs.QuestsContentPanel.vyberite_gorod_iz_spiska_sleva_3a187f1e')}
                    variant="empty"
                    iconSize={48}
                />
            )}

            {completedEmptyState}

            {!dataLoaded && (
                <View style={styles.skeletonGrid}>
                    {Array.from({ length: isMobile ? 2 : 4 }).map((_, i) => (
                        <View key={i} style={styles.skeletonCard}>
                            <SkeletonLoader width="100%" height={180} borderRadius={radiiLg} />
                        </View>
                    ))}
                </View>
            )}
        </>
    );

    if (Platform.OS !== 'web' && isMobile && viewMode === 'list') {
        return (
            <View style={styles.content} testID="quests-content">
                {contentHeader}
                <FlatList
                    data={dataLoaded ? questsAll : []}
                    keyExtractor={questKeyExtractor}
                    renderItem={renderQuestItem}
                    style={styles.questVirtualizedList}
                    contentContainerStyle={styles.questVirtualizedListContent}
                    ListHeaderComponent={
                        <>
                            {geoMessageBlock}
                            {seoIntroSlot}
                        </>
                    }
                    ListFooterComponent={seoFaqSlot}
                    ListEmptyComponent={listEmptyContent}
                    keyboardShouldPersistTaps="handled"
                    initialNumToRender={4}
                    maxToRenderPerBatch={4}
                    updateCellsBatchingPeriod={50}
                    windowSize={5}
                    removeClippedSubviews={Platform.OS === 'android'}
                    showsVerticalScrollIndicator={false}
                    testID="quests-virtualized-list"
                />
            </View>
        );
    }

    // На native в режиме карты НЕ оборачиваем в ScrollView: WebView-Leaflet
    // (scrollEnabled) внутри вертикального ScrollView перехватывает жест, из-за
    // чего шапка с тоглом «список ↔ карта» становилась недосягаема — переключение
    // обратно на список не срабатывало (F-10). Карта живёт фиксированным блоком,
    // шапка с тоглом всегда сверху и кликабельна.
    if (Platform.OS !== 'web' && isMobile && viewMode === 'map') {
        return <View style={[styles.content, { flex: 1 }]} testID="quests-content">{inner}</View>;
    }

    return (
        <ScrollView
            style={styles.content}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScroll={handleGridScroll}
            scrollEventThrottle={QUEST_GRID_SCROLL_THROTTLE}
            testID="quests-content"
        >
            {inner}
        </ScrollView>
    );
}
