import { Suspense, useCallback } from 'react';
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
import type { ListRenderItemInfo } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';

import Map from '@/components/MapPage/Map';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import type { MapMovePayload } from '@/components/MapPage/Map/types';

import QuestCard from './QuestCard';
import QuestsSeoIntroFaq from './QuestsSeoIntroFaq';
import { pluralizeQuest, type QuestMeta } from './questsShared';
import { translate as i18nT } from '@/i18n'


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
    searchQuery: string;
    onSearchChange: (text: string) => void;
    /** @deprecated Radius selection is no longer shown in the quest catalog. */
    nearbyRadiusKm?: number;
    questsAll: (QuestMeta & { _distanceKm?: number })[];
    questCardWidth: number;
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
    onShowNearby: () => void;
    onOpenFilterDrawer: () => void;
    onToggleViewMode: () => void;
    /** @deprecated Radius selection is no longer shown in the quest catalog. */
    onSetRadius?: (km: number) => void;
    onMapUserLocationChange: (loc: { latitude: number; longitude: number } | null) => void;
    onMapMove: (center: MapMovePayload) => void;
    onSearchMapArea: () => void;
};

type QuestListItem = QuestMeta & { _distanceKm?: number };

export default function QuestsContentPanel({
    styles,
    colors,
    dataLoaded,
    viewMode,
    selectedCityId,
    selectedCityName,
    nearbyId,
    kidsFilterId = '__kids__',
    searchQuery = '',
    onSearchChange = () => {},
    questsAll,
    questCardWidth,
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
    filtersActive,
    onResetFilters,
    onShowKids = () => {},
    onShowNearby,
    onOpenFilterDrawer,
    onToggleViewMode,
    onMapUserLocationChange,
    onMapMove,
    onSearchMapArea,
}: QuestsContentPanelProps) {
    const router = useRouter();
    const searchActive = searchQuery.trim().length > 0;
    // SEO intro + FAQ describe the whole /quests catalog. Show them on the default
    // list view (not in map mode, not while searching) so the visible copy matches
    // the crawlable static block generated for /quests.
    const showSeoContent = viewMode === 'list' && !searchActive;
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
                nearby={selectedCityId === nearbyId}
                cardWidth={questCardWidth}
                index={index}
            />
        </View>
    ), [getQuestCityId, nearbyId, questCardWidth, selectedCityId, styles]);

    const questKeyExtractor = useCallback((quest: QuestListItem) => String(quest.id), []);

    const contentHeader = (
        <View style={styles.contentHeader}>
            <View style={styles.contentHeaderTopRow}>
                <View style={styles.contentTitleBlock}>
                    <Text style={styles.contentTitle} numberOfLines={2}>
                        {searchActive
                            ? i18nT('quests:screens.tabs.QuestsContentPanel.rezultaty_poiska_5ebb750c')
                            : selectedCityId === nearbyId
                                ? (isMapAreaActive ? i18nT('quests:screens.tabs.QuestsContentPanel.kvesty_v_etoy_oblasti_f59f59da') : userLoc ? i18nT('quests:screens.tabs.QuestsContentPanel.kvesty_poblizosti_02dcd1cf') : i18nT('quests:screens.tabs.QuestsContentPanel.vse_kvesty_1c003efd'))
                                : selectedCityId === kidsFilterId
                                    ? i18nT('quests:screens.tabs.QuestsContentPanel.kvesty_dlya_detey_fbda5ab0')
                                    : selectedCityName || i18nT('quests:screens.tabs.QuestsContentPanel.vse_kvesty_1c003efd')}
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
                    </View>
                </View>
                {isMobile && (
                    <View style={styles.headerToggleRow}>
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
                            style={[styles.headerIconBtn, geoRequesting && styles.headerIconBtnDisabled]}
                            onPress={onShowNearby}
                            disabled={geoRequesting}
                            accessibilityRole="button"
                            accessibilityLabel={geoRequesting ? i18nT('quests:screens.tabs.QuestsContentPanel.ischem_kvesty_ryadom_so_mnoy_f5a72f30') : i18nT('quests:screens.tabs.QuestsContentPanel.pokazat_kvesty_ryadom_so_mnoy_d7a7ee55')}
                            testID="quests-show-nearby"
                        >
                            <Feather name="navigation" size={17} color={colors.text} />
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

    const geoMessageBlock = isMobile && geoMessage ? (
        <View style={styles.nearbyCtaBlock}>
            <Text style={styles.geoMessageText} testID="quests-geo-message">
                {geoMessage}
            </Text>
        </View>
    ) : null;

    const inner = (
        <>
            {contentHeader}

            <View style={[styles.contentBody, viewMode === 'map' && isMobile && styles.contentBodyMap]}>
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

                        {!searchActive && selectedCityId === nearbyId && userLoc && questsAll.length === 0 && dataLoaded && (
                            <EmptyState
                                icon="map-pin"
                                title={i18nT('quests:screens.tabs.QuestsContentPanel.ryadom_nichego_ne_naydeno_271dd8e7')}
                                description={i18nT('quests:screens.tabs.QuestsContentPanel.posmotrite_kvesty_v_drugih_gorodah_ili_vyber_720d6ffd')}
                                variant="empty"
                                iconSize={48}
                            />
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
                                {questsAll.map((quest, index) => (
                                    <QuestCard
                                        key={quest.id}
                                        styles={styles}
                                        cityId={getQuestCityId(quest)}
                                        quest={quest}
                                        nearby={selectedCityId === nearbyId}
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

            {!searchActive && selectedCityId === nearbyId && userLoc && dataLoaded && (
                <EmptyState
                    icon="map-pin"
                    title={i18nT('quests:screens.tabs.QuestsContentPanel.ryadom_nichego_ne_naydeno_271dd8e7')}
                    description={i18nT('quests:screens.tabs.QuestsContentPanel.posmotrite_kvesty_v_drugih_gorodah_ili_vyber_720d6ffd')}
                    variant="empty"
                    iconSize={48}
                />
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
            <View style={styles.content}>
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
        return <View style={[styles.content, { flex: 1 }]}>{inner}</View>;
    }

    return (
        <ScrollView
            style={styles.content}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
        >
            {inner}
        </ScrollView>
    );
}
