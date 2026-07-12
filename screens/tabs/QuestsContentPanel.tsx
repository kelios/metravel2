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
import { pluralizeQuest, type QuestMeta } from './questsShared';

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
    onShowNearby,
    onOpenFilterDrawer,
    onToggleViewMode,
    onMapUserLocationChange,
    onMapMove,
    onSearchMapArea,
}: QuestsContentPanelProps) {
    const router = useRouter();

    const openQuestFromPoint = (point?: { questMeta?: MapPoint['questMeta'] }) => {
        const meta = point?.questMeta;
        if (!meta?.cityId || !meta?.id) return;
        router.push(`/quests/${meta.cityId}/${meta.id}`);
    };

    const getQuestCityId = useCallback((quest: QuestListItem) => (
        selectedCityId === nearbyId ? (quest.cityId || '') : (selectedCityId || '')
    ), [nearbyId, selectedCityId]);

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

    const searchActive = searchQuery.trim().length > 0;

    const contentHeader = (
        <View style={styles.contentHeader}>
            <View style={styles.contentHeaderTopRow}>
                <View style={styles.contentTitleBlock}>
                    <Text style={styles.contentTitle} numberOfLines={2}>
                        {searchActive
                            ? 'Результаты поиска'
                            : selectedCityId === nearbyId
                                ? (isMapAreaActive ? 'Квесты в этой области' : userLoc ? 'Квесты поблизости' : 'Все квесты')
                                : selectedCityName || 'Все квесты'}
                    </Text>
                    <View style={styles.contentCountRow}>
                        {dataLoaded && <Text style={styles.contentCount}>{pluralizeQuest(questsAll.length)}</Text>}
                        {dataLoaded && !searchActive && filtersActive && (
                            <Pressable
                                style={styles.resetFiltersChip}
                                onPress={onResetFilters}
                                accessibilityRole="button"
                                accessibilityLabel="Сбросить фильтры и показать все квесты"
                                hitSlop={8}
                                testID="quests-reset-filters"
                            >
                                <Feather name="x" size={13} color={colors.primary} />
                                <Text style={styles.resetFiltersChipText}>Все квесты</Text>
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
                            accessibilityLabel={viewMode === 'map' ? 'Показать список квестов' : 'Показать квесты на карте'}
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
                            accessibilityLabel="Выбрать город"
                        >
                            <Feather name="filter" size={17} color={colors.text} />
                        </Pressable>
                        <Pressable
                            style={[styles.headerIconBtn, geoRequesting && styles.headerIconBtnDisabled]}
                            onPress={onShowNearby}
                            disabled={geoRequesting}
                            accessibilityRole="button"
                            accessibilityLabel={geoRequesting ? 'Ищем квесты рядом со мной' : 'Показать квесты рядом со мной'}
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
                    placeholder="Поиск по названию или городу"
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="search"
                    autoCorrect={false}
                    clearButtonMode="never"
                    accessibilityLabel="Поиск квестов по названию или городу"
                    testID="quests-search-input"
                />
                {searchActive && (
                    <Pressable
                        style={styles.searchClearBtn}
                        onPress={() => onSearchChange('')}
                        accessibilityRole="button"
                        accessibilityLabel="Очистить поиск"
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
                                    Геолокация отключена. Показываем все квесты на карте.
                                </Text>
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
                                        accessibilityLabel="Искать в этой области"
                                        testID="quests-map-search-area"
                                    >
                                        <Feather name="search" size={15} color={colors.textOnPrimary} />
                                        <Text style={styles.mapSearchAreaBtnText}>Искать в этой области</Text>
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
                                        accessibilityLabel="Искать в этой области"
                                        testID="quests-map-search-area"
                                    >
                                        <Feather name="search" size={15} color={colors.textOnPrimary} />
                                        <Text style={styles.mapSearchAreaBtnText}>Искать в этой области</Text>
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
                        {searchActive && questsAll.length === 0 && dataLoaded && (
                            <EmptyState
                                icon="search"
                                title="Ничего не найдено"
                                description="Попробуйте другое название или город"
                                variant="empty"
                                iconSize={48}
                            />
                        )}

                        {!searchActive && selectedCityId === nearbyId && userLoc && questsAll.length === 0 && dataLoaded && (
                            <EmptyState
                                icon="map-pin"
                                title="Рядом ничего не найдено"
                                description="Посмотрите квесты в других городах или выберите область на карте"
                                variant="empty"
                                iconSize={48}
                            />
                        )}

                        {!searchActive && !selectedCityId && dataLoaded && (
                            <EmptyState
                                icon="compass"
                                title="Выберите город"
                                description={isMobile ? 'Нажмите «Город» чтобы выбрать' : 'Выберите город из списка слева'}
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
                    </>
                )}
            </View>
        </>
    );

    if (Platform.OS !== 'web' && isMobile && viewMode === 'list' && dataLoaded && questsAll.length > 0) {
        return (
            <View style={styles.content}>
                {contentHeader}
                <FlatList
                    data={questsAll}
                    keyExtractor={questKeyExtractor}
                    renderItem={renderQuestItem}
                    style={styles.questVirtualizedList}
                    contentContainerStyle={styles.questVirtualizedListContent}
                    ListHeaderComponent={geoMessageBlock}
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
        >
            {inner}
        </ScrollView>
    );
}
