import { fireEvent, render } from '@testing-library/react-native';
import { Platform } from 'react-native';

import QuestsContentPanel from '@/screens/tabs/QuestsContentPanel';

let mockIsMobile = false;

jest.mock('@/hooks/useResponsive', () => ({
    useResponsive: () => ({ isMobile: mockIsMobile }),
}));

jest.mock('@expo/vector-icons/Feather', () => 'Feather');

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
        mapRadiusBar: {},
        radiusLabel: {},
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
                nearbyRadiusKm={15}
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
                radius: '15',
            }),
            undefined,
        );
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
