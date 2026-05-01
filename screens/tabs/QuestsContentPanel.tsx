import React, { Suspense } from 'react';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import EmptyState from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useResponsive } from '@/hooks/useResponsive';

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
    radiiLg: number;
    LazyQuestMap: any;
    onOpenFilterDrawer: () => void;
    onMapUserLocationChange: (loc: { latitude: number; longitude: number } | null) => void;
};

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
    radiiLg,
    LazyQuestMap,
    onOpenFilterDrawer,
    onMapUserLocationChange,
}: QuestsContentPanelProps) {
    const { isMobile } = useResponsive();
    return (
        <ScrollView
            style={styles.content}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.contentHeader}>
                <View style={styles.contentTitleBlock}>
                    <Text style={styles.contentTitle} numberOfLines={2}>
                        {selectedCityId === nearbyId
                            ? (userLoc ? 'Квесты поблизости' : 'Все квесты')
                            : selectedCityName || 'Все квесты'}
                    </Text>
                    {dataLoaded && <Text style={styles.contentCount}>{pluralizeQuest(questsAll.length)}</Text>}
                </View>
                {isMobile && (
                    <Pressable
                        style={styles.mobileFilterBtn}
                        onPress={onOpenFilterDrawer}
                        accessibilityRole="button"
                        accessibilityLabel="Выбрать город"
                    >
                        <Feather name="filter" size={16} color={colors.text} />
                        <Text style={styles.mobileFilterBtnText}>Город</Text>
                    </Pressable>
                )}
            </View>

            <View style={styles.contentBody}>
                {viewMode === 'map' ? (
                    <View style={styles.mapSection}>
                        {dataLoaded && selectedCityId === nearbyId && !userLoc && (
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

                        {dataLoaded && Platform.OS !== 'web' && (
                            <EmptyState
                                icon="map"
                                title="Карта доступна в веб-версии"
                                description="Откройте страницу квестов в браузере, чтобы увидеть карту"
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
                                <Suspense fallback={<View style={styles.mapLoading}><ActivityIndicator color={colors.primary} /></View>}>
                                    <LazyQuestMap
                                        travel={{ data: mapPoints as any }}
                                        coordinates={mapCenter}
                                        mode="radius"
                                        radius={selectedCityId === nearbyId
                                            ? (userLoc ? String(Math.max(nearbyRadiusKm, 5)) : '50')
                                            : '30'}
                                        routePoints={[]}
                                        transportMode="foot"
                                        onMapClick={() => {}}
                                        setRouteDistance={() => {}}
                                        setFullRouteCoords={() => {}}
                                        onUserLocationChange={onMapUserLocationChange}
                                    />
                                </Suspense>
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
                                {questsAll.map((quest, index) => (
                                    <QuestCard
                                        key={`${quest.id}-${index}`}
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
        </ScrollView>
    );
}
