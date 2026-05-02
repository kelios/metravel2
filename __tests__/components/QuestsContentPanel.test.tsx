import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';

import QuestsContentPanel from '@/screens/tabs/QuestsContentPanel';

jest.mock('@/hooks/useResponsive', () => ({
    useResponsive: () => ({ isMobile: false }),
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
});
