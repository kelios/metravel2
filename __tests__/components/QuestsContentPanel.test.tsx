import React from 'react';
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
        mapSection: {},
        mapLoading: {},
        mapContainer: {},
        skeletonGrid: {},
        skeletonCard: {},
        questsGrid: {},
    };

    const colors = {
        text: '#111',
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
                radiiLg={24}
                LazyQuestMap={LazyQuestMap}
                onOpenFilterDrawer={() => {}}
                onToggleViewMode={() => {}}
                onMapUserLocationChange={() => {}}
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
                radiiLg={24}
                LazyQuestMap={LazyQuestMap}
                onOpenFilterDrawer={onOpenFilterDrawer}
                onToggleViewMode={() => {}}
                onMapUserLocationChange={() => {}}
            />
        );

        fireEvent.press(getByLabelText('Выбрать город'));

        expect(onOpenFilterDrawer).toHaveBeenCalledTimes(1);
    });
});
