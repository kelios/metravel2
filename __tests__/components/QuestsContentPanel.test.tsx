import { fireEvent, render } from '@testing-library/react-native';
import { FlatList, Platform } from 'react-native';

import QuestsContentPanel from '@/screens/tabs/QuestsContentPanel';
import type { QuestMeta } from '@/utils/questAdapters';

let mockIsMobile = false;

jest.mock('@/hooks/useResponsive', () => ({
    useResponsive: () => ({ isMobile: mockIsMobile }),
}));

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@/screens/tabs/QuestCard', () => {
    const React = require('react');
    const { Text } = require('react-native');

    return function MockQuestCard({ quest }: { quest: { id: string; title: string } }) {
        return React.createElement(Text, { testID: `quest-card-${quest.id}` }, quest.title);
    };
});

describe('QuestsContentPanel', () => {
    const styles = {
        content: {},
        contentHeader: {},
        contentTitleBlock: {},
        contentTitle: {},
        contentCount: {},
        headerToggleRow: {},
        headerIconBtn: {},
        headerIconBtnActive: {},
        headerIconBtnDisabled: {},
        contentBody: {},
        contentBodyMap: {},
        nearbyCtaBlock: {},
        showNearbyBtn: {},
        showNearbyBtnDisabled: {},
        showNearbyBtnText: {},
        geoMessageText: {},
        mapSection: {},
        geoBanner: {},
        geoBannerText: {},
        mapLoading: {},
        mapContainer: {},
        mapSearchAreaBtn: {},
        mapSearchAreaBtnText: {},
        skeletonGrid: {},
        skeletonCard: {},
        questsGrid: {},
        questVirtualizedList: {},
        questVirtualizedListContent: {},
        questVirtualizedItem: {},
        mapRadiusOverlay: {},
        mapRadiusToggle: {},
        mapRadiusToggleActive: {},
        mapRadiusToggleText: {},
        mapRadiusToggleTextActive: {},
        mapRadiusPopover: {},
        radiusChip: {},
        radiusChipActive: {},
        radiusChipText: {},
        radiusChipTextActive: {},
    };

    const colors = {
        text: '#111',
        textOnPrimary: '#fff',
        primary: '#222',
        warning: '#d97706',
        warningSoft: '#fef3c7',
        warningDark: '#92400e',
    };

    beforeEach(() => {
        mockIsMobile = false;
    });

    const makeQuest = (index: number): QuestMeta => ({
        id: `quest-${index}`,
        title: `Quest ${index}`,
        points: 3,
        cityId: 'warsaw',
        cityName: 'Warsaw',
        lat: 52.23 + index / 1000,
        lng: 21.01 + index / 1000,
        durationMin: 60,
        difficulty: 'easy',
        cover: `https://cdn.example.com/quest-${index}.jpg`,
        ratingAvg: null,
        ratingCount: 0,
        completionsCount: 0,
        isCompletedByMe: false,
        firstCompleter: null,
    });

    it('shows a geolocation-disabled banner and draws the map radius circle at the picked nearby radius', () => {
        (Platform as { OS: string }).OS = 'web';
        const LazyQuestMap = jest.fn(() => null);

        const { getByTestId, queryByText } = render(
            <QuestsContentPanel
                styles={styles}
                colors={colors}
                dataLoaded
                viewMode="map"
                selectedCityId="__nearby__"
                selectedCityName="Рядом"
                nearbyId="__nearby__"
                nearbyRadiusKm={20}
                questsAll={[]}
                questCardWidth={320}
                mapPoints={[
                    {
                        id: 'minsk-quest',
                        coord: '53.9,27.5667',
                        address: 'Минск',
                        travelImageThumbUrl: '',
                        categoryName: 'Квест',
                    },
                ]}
                mapCenter={{ latitude: 53.9, longitude: 27.56 }}
                userLoc={null}
                isMapAreaActive={false}
                geoMessage={null}
                geoRequesting={false}
                showMapAreaSearch={false}
                radiiLg={24}
                LazyQuestMap={LazyQuestMap}
                isMobile={false}
                onShowNearby={() => {}}
                onOpenFilterDrawer={() => {}}
                onToggleViewMode={() => {}}
                onSetRadius={() => {}}
                onMapUserLocationChange={() => {}}
                onMapMove={() => {}}
                onSearchMapArea={() => {}}
            />
        );

        expect(getByTestId('quests-geo-banner')).toBeTruthy();
        expect(queryByText('Геолокация отключена. Показываем все квесты на карте.')).toBeTruthy();
        expect(LazyQuestMap).toHaveBeenCalledWith(
            expect.objectContaining({
                coordinates: { latitude: 53.9, longitude: 27.56 },
                radius: '20',
            }),
            undefined,
        );
    });

    it('exposes only the compact 5/10/20/50 radius options in the map overlay popover', () => {
        (Platform as { OS: string }).OS = 'web';
        const LazyQuestMap = jest.fn(() => null);
        const onSetRadius = jest.fn();

        const { getByTestId, queryByTestId } = render(
            <QuestsContentPanel
                styles={styles}
                colors={colors}
                dataLoaded
                viewMode="map"
                selectedCityId="__nearby__"
                selectedCityName="Рядом"
                nearbyId="__nearby__"
                nearbyRadiusKm={10}
                questsAll={[]}
                questCardWidth={320}
                mapPoints={[
                    {
                        id: 'minsk-quest',
                        coord: '53.9,27.5667',
                        address: 'Минск',
                        travelImageThumbUrl: '',
                        categoryName: 'Квест',
                    },
                ]}
                mapCenter={{ latitude: 53.9, longitude: 27.56 }}
                userLoc={null}
                isMapAreaActive={false}
                geoMessage={null}
                geoRequesting={false}
                showMapAreaSearch={false}
                radiiLg={24}
                LazyQuestMap={LazyQuestMap}
                isMobile={false}
                onShowNearby={() => {}}
                onOpenFilterDrawer={() => {}}
                onToggleViewMode={() => {}}
                onSetRadius={onSetRadius}
                onMapUserLocationChange={() => {}}
                onMapMove={() => {}}
                onSearchMapArea={() => {}}
            />
        );

        // Overlay is collapsed by default: options hidden until the toggle is tapped.
        expect(queryByTestId('quests-map-radius-10')).toBeNull();

        fireEvent.press(getByTestId('quests-map-radius-toggle'));

        expect(getByTestId('quests-map-radius-5')).toBeTruthy();
        expect(getByTestId('quests-map-radius-10')).toBeTruthy();
        expect(getByTestId('quests-map-radius-20')).toBeTruthy();
        expect(getByTestId('quests-map-radius-50')).toBeTruthy();
        // Legacy radii are gone.
        expect(queryByTestId('quests-map-radius-15')).toBeNull();
        expect(queryByTestId('quests-map-radius-30')).toBeNull();

        // Picking a value applies it and closes the popover.
        fireEvent.press(getByTestId('quests-map-radius-20'));
        expect(onSetRadius).toHaveBeenCalledWith(20);
        expect(queryByTestId('quests-map-radius-20')).toBeNull();
    });

    it('keeps the map mounted with zero results and shows no full empty-state in map mode', () => {
        (Platform as { OS: string }).OS = 'web';
        const LazyQuestMap = jest.fn(() => null);

        const { queryByText } = render(
            <QuestsContentPanel
                styles={styles}
                colors={colors}
                dataLoaded
                viewMode="map"
                selectedCityId="__nearby__"
                selectedCityName="Рядом"
                nearbyId="__nearby__"
                nearbyRadiusKm={10}
                questsAll={[]}
                questCardWidth={320}
                mapPoints={[]}
                mapCenter={{ latitude: 53.9, longitude: 27.56 }}
                userLoc={{ lat: 53.9, lng: 27.56 }}
                isMapAreaActive
                geoMessage={null}
                geoRequesting={false}
                showMapAreaSearch={false}
                radiiLg={24}
                LazyQuestMap={LazyQuestMap}
                isMobile={false}
                onShowNearby={() => {}}
                onOpenFilterDrawer={() => {}}
                onToggleViewMode={() => {}}
                onSetRadius={() => {}}
                onMapUserLocationChange={() => {}}
                onMapMove={() => {}}
                onSearchMapArea={() => {}}
            />
        );

        expect(LazyQuestMap).toHaveBeenCalledWith(
            expect.objectContaining({ travel: { data: [] } }),
            undefined,
        );
        expect(queryByText('Нет квестов для отображения на карте')).toBeNull();
    });

    it('opens the city drawer from the mobile city button', () => {
        mockIsMobile = true;
        (Platform as { OS: string }).OS = 'android';
        const LazyQuestMap = jest.fn(() => null);
        const onOpenFilterDrawer = jest.fn();

        const { getByLabelText } = render(
            <QuestsContentPanel
                styles={styles}
                colors={colors}
                dataLoaded
                viewMode="list"
                selectedCityId="warsaw"
                selectedCityName="Warsaw"
                nearbyId="__nearby__"
                nearbyRadiusKm={15}
                questsAll={[]}
                questCardWidth={320}
                mapPoints={[]}
                mapCenter={{ latitude: 52.23, longitude: 21.01 }}
                userLoc={null}
                isMapAreaActive={false}
                geoMessage={null}
                geoRequesting={false}
                showMapAreaSearch={false}
                radiiLg={24}
                LazyQuestMap={LazyQuestMap}
                isMobile
                onShowNearby={() => {}}
                onOpenFilterDrawer={onOpenFilterDrawer}
                onToggleViewMode={() => {}}
                onSetRadius={() => {}}
                onMapUserLocationChange={() => {}}
                onMapMove={() => {}}
                onSearchMapArea={() => {}}
            />
        );

        fireEvent.press(getByLabelText('Выбрать город'));

        expect(onOpenFilterDrawer).toHaveBeenCalledTimes(1);
    });

    it('uses a virtualized FlatList for Android mobile quest list scrolling', () => {
        mockIsMobile = true;
        (Platform as { OS: string }).OS = 'android';
        const LazyQuestMap = jest.fn(() => null);
        const quests = Array.from({ length: 12 }, (_, index) => makeQuest(index));

        const { UNSAFE_getByType, getByTestId } = render(
            <QuestsContentPanel
                styles={styles}
                colors={colors}
                dataLoaded
                viewMode="list"
                selectedCityId="warsaw"
                selectedCityName="Warsaw"
                nearbyId="__nearby__"
                nearbyRadiusKm={15}
                questsAll={quests}
                questCardWidth={320}
                mapPoints={[]}
                mapCenter={{ latitude: 52.23, longitude: 21.01 }}
                userLoc={null}
                isMapAreaActive={false}
                geoMessage={null}
                geoRequesting={false}
                showMapAreaSearch={false}
                radiiLg={24}
                LazyQuestMap={LazyQuestMap}
                isMobile
                onShowNearby={() => {}}
                onOpenFilterDrawer={() => {}}
                onToggleViewMode={() => {}}
                onSetRadius={() => {}}
                onMapUserLocationChange={() => {}}
                onMapMove={() => {}}
                onSearchMapArea={() => {}}
            />
        );

        const list = UNSAFE_getByType(FlatList);

        expect(getByTestId('quests-virtualized-list')).toBeTruthy();
        expect(list.props.data).toHaveLength(12);
        expect(list.props.initialNumToRender).toBe(4);
        expect(list.props.maxToRenderPerBatch).toBe(4);
        expect(list.props.updateCellsBatchingPeriod).toBe(50);
        expect(list.props.windowSize).toBe(5);
        expect(list.props.removeClippedSubviews).toBe(true);
    });

    it('keeps the existing non-virtualized grid path on web', () => {
        mockIsMobile = true;
        (Platform as { OS: string }).OS = 'web';
        const LazyQuestMap = jest.fn(() => null);
        const quests = Array.from({ length: 2 }, (_, index) => makeQuest(index));

        const { getByTestId, queryByTestId } = render(
            <QuestsContentPanel
                styles={styles}
                colors={colors}
                dataLoaded
                viewMode="list"
                selectedCityId="warsaw"
                selectedCityName="Warsaw"
                nearbyId="__nearby__"
                nearbyRadiusKm={15}
                questsAll={quests}
                questCardWidth={320}
                mapPoints={[]}
                mapCenter={{ latitude: 52.23, longitude: 21.01 }}
                userLoc={null}
                isMapAreaActive={false}
                geoMessage={null}
                geoRequesting={false}
                showMapAreaSearch={false}
                radiiLg={24}
                LazyQuestMap={LazyQuestMap}
                isMobile
                onShowNearby={() => {}}
                onOpenFilterDrawer={() => {}}
                onToggleViewMode={() => {}}
                onSetRadius={() => {}}
                onMapUserLocationChange={() => {}}
                onMapMove={() => {}}
                onSearchMapArea={() => {}}
            />
        );

        expect(queryByTestId('quests-virtualized-list')).toBeNull();
        expect(getByTestId('quest-card-quest-0')).toBeTruthy();
        expect(getByTestId('quest-card-quest-1')).toBeTruthy();
    });

    it('exposes the mobile nearby CTA and geolocation message in list mode', () => {
        mockIsMobile = true;
        (Platform as { OS: string }).OS = 'web';
        const LazyQuestMap = jest.fn(() => null);
        const onShowNearby = jest.fn();

        const { getByTestId, getByText } = render(
            <QuestsContentPanel
                styles={styles}
                colors={colors}
                dataLoaded
                viewMode="list"
                selectedCityId="__nearby__"
                selectedCityName="Рядом"
                nearbyId="__nearby__"
                nearbyRadiusKm={15}
                questsAll={[]}
                questCardWidth={320}
                mapPoints={[]}
                mapCenter={{ latitude: 52.23, longitude: 21.01 }}
                userLoc={null}
                isMapAreaActive={false}
                geoMessage="Разрешите доступ к геолокации."
                geoRequesting={false}
                showMapAreaSearch={false}
                radiiLg={24}
                LazyQuestMap={LazyQuestMap}
                isMobile
                onShowNearby={onShowNearby}
                onOpenFilterDrawer={() => {}}
                onToggleViewMode={() => {}}
                onSetRadius={() => {}}
                onMapUserLocationChange={() => {}}
                onMapMove={() => {}}
                onSearchMapArea={() => {}}
            />
        );

        fireEvent.press(getByTestId('quests-show-nearby'));

        expect(onShowNearby).toHaveBeenCalledTimes(1);
        expect(getByText('Разрешите доступ к геолокации.')).toBeTruthy();
    });

    it('shows the reset-filters chip when a filter narrows the catalog and hides it otherwise', () => {
        mockIsMobile = true;
        (Platform as { OS: string }).OS = 'web';
        const LazyQuestMap = jest.fn(() => null);
        const onResetFilters = jest.fn();

        const baseProps = {
            styles,
            colors,
            dataLoaded: true,
            viewMode: 'list' as const,
            selectedCityName: 'Warsaw',
            nearbyId: '__nearby__',
            nearbyRadiusKm: 15,
            questsAll: [makeQuest(0)],
            questCardWidth: 320,
            mapPoints: [],
            mapCenter: { latitude: 52.23, longitude: 21.01 },
            userLoc: null,
            isMapAreaActive: false,
            geoMessage: null,
            geoRequesting: false,
            showMapAreaSearch: false,
            radiiLg: 24,
            LazyQuestMap,
            isMobile: true,
            onResetFilters,
            onShowNearby: () => {},
            onOpenFilterDrawer: () => {},
            onToggleViewMode: () => {},
            onSetRadius: () => {},
            onMapUserLocationChange: () => {},
            onMapMove: () => {},
            onSearchMapArea: () => {},
        };

        const { getByTestId, queryByTestId, rerender } = render(
            <QuestsContentPanel {...baseProps} selectedCityId="warsaw" filtersActive />
        );

        fireEvent.press(getByTestId('quests-reset-filters'));
        expect(onResetFilters).toHaveBeenCalledTimes(1);

        rerender(
            <QuestsContentPanel {...baseProps} selectedCityId="__nearby__" selectedCityName="Рядом" filtersActive={false} />
        );
        expect(queryByTestId('quests-reset-filters')).toBeNull();
    });

    it('shows the search-this-area action on the quest map and forwards map moves', () => {
        (Platform as { OS: string }).OS = 'web';
        const LazyQuestMap = jest.fn(() => null);
        const onMapMove = jest.fn();
        const onSearchMapArea = jest.fn();

        const { getByTestId } = render(
            <QuestsContentPanel
                styles={styles}
                colors={colors}
                dataLoaded
                viewMode="map"
                selectedCityId="warsaw"
                selectedCityName="Warsaw"
                nearbyId="__nearby__"
                nearbyRadiusKm={15}
                questsAll={[]}
                questCardWidth={320}
                mapPoints={[
                    {
                        id: 'warsaw-quest',
                        coord: '52.23,21.01',
                        address: 'Warsaw',
                        travelImageThumbUrl: '',
                        categoryName: 'Квест',
                    },
                ]}
                mapCenter={{ latitude: 52.23, longitude: 21.01 }}
                userLoc={null}
                isMapAreaActive={false}
                geoMessage={null}
                geoRequesting={false}
                showMapAreaSearch
                radiiLg={24}
                LazyQuestMap={LazyQuestMap}
                isMobile={false}
                onShowNearby={() => {}}
                onOpenFilterDrawer={() => {}}
                onToggleViewMode={() => {}}
                onSetRadius={() => {}}
                onMapUserLocationChange={() => {}}
                onMapMove={onMapMove}
                onSearchMapArea={onSearchMapArea}
            />
        );

        fireEvent.press(getByTestId('quests-map-search-area'));

        expect(onSearchMapArea).toHaveBeenCalledTimes(1);
        expect(LazyQuestMap).toHaveBeenCalledWith(
            expect.objectContaining({
                onMapMove,
            }),
            undefined,
        );
    });

    it('keeps the same header toggle row visible in map mode so the user can switch back to the list', () => {
        mockIsMobile = true;
        (Platform as { OS: string }).OS = 'web';
        const LazyQuestMap = jest.fn(() => null);
        const onToggleViewMode = jest.fn();
        const onOpenFilterDrawer = jest.fn();
        const onShowNearby = jest.fn();

        const { getByTestId, getByLabelText } = render(
            <QuestsContentPanel
                styles={styles}
                colors={colors}
                dataLoaded
                viewMode="map"
                selectedCityId="warsaw"
                selectedCityName="Warsaw"
                nearbyId="__nearby__"
                nearbyRadiusKm={15}
                questsAll={[]}
                questCardWidth={320}
                mapPoints={[
                    {
                        id: 'warsaw-quest',
                        coord: '52.23,21.01',
                        address: 'Warsaw',
                        travelImageThumbUrl: '',
                        categoryName: 'Квест',
                    },
                ]}
                mapCenter={{ latitude: 52.23, longitude: 21.01 }}
                userLoc={null}
                isMapAreaActive={false}
                geoMessage={null}
                geoRequesting={false}
                showMapAreaSearch={false}
                radiiLg={24}
                LazyQuestMap={LazyQuestMap}
                isMobile
                onShowNearby={onShowNearby}
                onOpenFilterDrawer={onOpenFilterDrawer}
                onToggleViewMode={onToggleViewMode}
                onSetRadius={() => {}}
                onMapUserLocationChange={() => {}}
                onMapMove={() => {}}
                onSearchMapArea={() => {}}
            />
        );

        // Same three icon controls as list mode: toggle view, pick city, show nearby.
        fireEvent.press(getByTestId('quests-toggle-view-mode'));
        expect(onToggleViewMode).toHaveBeenCalledTimes(1);

        fireEvent.press(getByLabelText('Выбрать город'));
        expect(onOpenFilterDrawer).toHaveBeenCalledTimes(1);

        fireEvent.press(getByTestId('quests-show-nearby'));
        expect(onShowNearby).toHaveBeenCalledTimes(1);
    });
});
