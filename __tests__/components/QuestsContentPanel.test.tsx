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
        contentTitle: {},
        contentCount: {},
        mobileFilterBtn: {},
        mobileFilterBtnText: {},
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

    it('shows a geolocation-disabled banner and keeps the map visible with a wide radius fallback', () => {
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
                radius: '50',
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
});
