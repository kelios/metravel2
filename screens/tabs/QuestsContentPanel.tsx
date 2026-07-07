import { Suspense } from 'react';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
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
    nearbyRadiusKm: number;
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
    onShowNearby: () => void;
    onOpenFilterDrawer: () => void;
    onToggleViewMode: () => void;
    onSetRadius: (km: number) => void;
    onMapUserLocationChange: (loc: { latitude: number; longitude: number } | null) => void;
    onMapMove: (center: MapMovePayload) => void;
    onSearchMapArea: () => void;
};

const RADIUS_OPTIONS = [5, 10, 15, 20, 30] as const;

export default function QuestsContentPanel({
    styles,
    colors,
    dataLoaded,
    viewMode,
    selectedCityId,
    selectedCityName,
    nearbyId,
    nearbyRadiusKm,
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
    onShowNearby,
    onOpenFilterDrawer,
    onToggleViewMode,
    onSetRadius,
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

    // Контрол радиуса живёт рядом с картой (а не в списке городов): он задаёт
    // окружность, которую карта рисует, и радиус, по которому «Искать в этой
    // области»/«Рядом» считают квесты — так «что видно» совпадает со счётчиком.
    const showRadiusControl = viewMode === 'map' && selectedCityId === nearbyId;
    const radiusControl = showRadiusControl ? (
        <View style={styles.mapRadiusBar}>
            <Text style={styles.radiusLabel}>Радиус:</Text>
            {RADIUS_OPTIONS.map((km) => (
                <Pressable
                    key={km}
                    onPress={() => onSetRadius(km)}
                    style={[styles.radiusChip, nearbyRadiusKm === km && styles.radiusChipActive]}
                    accessibilityRole="button"
                    accessibilityLabel={`Радиус ${km} км`}
                    accessibilityState={{ selected: nearbyRadiusKm === km }}
                    testID={`quests-map-radius-${km}`}
                >
                    <Text style={[styles.radiusChipText, nearbyRadiusKm === km && styles.radiusChipTextActive]}>
                        {km} км
                    </Text>
                </Pressable>
            ))}
        </View>
    ) : null;

    const inner = (
        <>
            <View style={styles.contentHeader}>
                <View style={styles.contentTitleBlock}>
                    <Text style={styles.contentTitle} numberOfLines={2}>
                        {selectedCityId === nearbyId
                            ? (isMapAreaActive ? 'Квесты в этой области' : userLoc ? 'Квесты поблизости' : 'Все квесты')
                            : selectedCityName || 'Все квесты'}
                    </Text>
                    {dataLoaded && <Text style={styles.contentCount}>{pluralizeQuest(questsAll.length)}</Text>}
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

            <View style={[styles.contentBody, viewMode === 'map' && isMobile && styles.contentBodyMap]}>
                {isMobile && geoMessage ? (
                    <View style={styles.nearbyCtaBlock}>
                        <Text style={styles.geoMessageText} testID="quests-geo-message">
                            {geoMessage}
                        </Text>
                    </View>
                ) : null}

                {viewMode === 'map' ? (
                    <View style={styles.mapSection}>
                        {radiusControl}

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

                        {dataLoaded && Platform.OS !== 'web' && mapPoints.length === 0 && (
                            <EmptyState
                                icon="map-pin"
                                title="Нет квестов для отображения на карте"
                                description="Измените город или радиус, чтобы увидеть точки на карте"
                                variant="empty"
                                iconSize={48}
                            />
                        )}

                        {dataLoaded && Platform.OS === 'web' && mapPoints.length === 0 && (
                            <EmptyState
                                icon="map-pin"
                                title="Нет квестов для отображения на карте"
                                description="Измените город или радиус, чтобы увидеть точки на карте"
                                variant="empty"
                                iconSize={48}
                            />
                        )}

                        {dataLoaded && Platform.OS === 'web' && mapPoints.length > 0 && (
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
                                        pointsOnly
                                        mode="radius"
                                        radius={selectedCityId === nearbyId ? String(nearbyRadiusKm) : '30'}
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

                        {dataLoaded && Platform.OS !== 'web' && mapPoints.length > 0 && (
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
                                    pointsOnly
                                    mode="radius"
                                    radius={selectedCityId === nearbyId ? String(nearbyRadiusKm) : '30'}
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
                        {selectedCityId === nearbyId && userLoc && questsAll.length === 0 && dataLoaded && (
                            <EmptyState
                                icon="map-pin"
                                title="Рядом ничего не найдено"
                                description="Попробуйте увеличить радиус поиска"
                                variant="empty"
                                iconSize={48}
                            />
                        )}

                        {!selectedCityId && dataLoaded && (
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
                                {questsAll.map((quest) => (
                                    <QuestCard
                                        key={quest.id}
                                        styles={styles}
                                        cityId={selectedCityId === nearbyId ? (quest.cityId || '') : (selectedCityId || '')}
                                        quest={quest}
                                        nearby={selectedCityId === nearbyId}
                                        cardWidth={questCardWidth}
                                    />
                                ))}
                            </View>
                        )}
                    </>
                )}
            </View>
        </>
    );

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
