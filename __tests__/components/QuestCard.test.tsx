import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Platform } from 'react-native';

import QuestCard from '@/screens/tabs/QuestCard';
import { createTestQueryClient } from '@/__tests__/helpers/testQueryClient';
import type { QuestMeta } from '@/utils/questAdapters';

const mockPush = jest.fn();
const mockImageCardMedia = jest.fn((props: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: 'quest-card-media', ...props });
});

let mockIsPhone = true;

jest.mock('expo-router', () => ({
    router: {
        push: (...args: any[]) => mockPush(...args),
    },
}));

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@/components/layout/UserAvatar', () => 'UserAvatar');
jest.mock('@/components/ui/ShimmerOverlay', () => ({
    ShimmerOverlay: 'ShimmerOverlay',
}));
jest.mock('@/components/ui/ImageCardMedia', () => ({
    __esModule: true,
    default: (props: any) => mockImageCardMedia(props),
}));
jest.mock('@/hooks/useResponsive', () => ({
    useResponsive: () => ({ isPhone: mockIsPhone }),
}));
jest.mock('@/hooks/useTheme', () => ({
    useThemedColors: () => ({
        backgroundTertiary: 'backgroundTertiary',
        backgroundSecondary: 'backgroundSecondary',
        borderLight: 'borderLight',
        brandAlpha30: 'brandAlpha30',
        brandDark: 'brandDark',
        primary: 'primary',
        surface: 'surface',
        text: 'text',
        textMuted: 'textMuted',
        textOnDark: 'textOnDark',
    }),
}));
jest.mock('@/hooks/useQuestsApi', () => ({
    useQuestReviews: () => ({
        data: [],
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
    }),
}));

const styles = new Proxy({}, {
    get: () => ({}),
});

const makeQuest = (overrides: Partial<QuestMeta> = {}): QuestMeta => ({
    id: 'krakow-dragon',
    title: 'Тайна дракона',
    points: 6,
    cityId: 'krakow',
    cityName: 'Kraków',
    lat: 50.061,
    lng: 19.936,
    durationMin: 90,
    difficulty: 'easy',
    cover: 'https://cdn.example.com/quest.jpg',
    ratingAvg: 4.7,
    ratingCount: 1,
    completionsCount: 0,
    isCompletedByMe: false,
    firstCompleter: null,
    ...overrides,
});

const renderWithQueryClient = (ui: React.ReactElement) =>
    render(
        <QueryClientProvider client={createTestQueryClient()}>
            {ui}
        </QueryClientProvider>,
    );

describe('QuestCard', () => {
    beforeEach(() => {
        mockIsPhone = true;
        mockPush.mockClear();
        mockImageCardMedia.mockClear();
        (Platform as { OS: string }).OS = 'web';
    });

    it('renders mobile quest media with stable contain geometry and pioneer badge', () => {
        const { getByTestId } = renderWithQueryClient(
            <QuestCard
                styles={styles}
                cardWidth={340}
                cityId="krakow"
                quest={makeQuest()}
                nearby
            />,
        );

        expect(mockImageCardMedia).toHaveBeenCalledTimes(1);
        expect(mockImageCardMedia.mock.calls[0]?.[0]).toEqual(
            expect.objectContaining({
                src: 'https://cdn.example.com/quest.jpg',
                width: 340,
                height: 238,
                fit: 'contain',
                blurBackground: true,
                allowCriticalWebBlur: true,
                revealOnLoadOnly: true,
                loading: 'eager',
                priority: 'low',
                optimizeWeb: false,
            }),
        );
        expect(getByTestId('quest-card-pioneer-krakow-dragon')).toBeTruthy();
    });

    it('opens the quest reviews modal from the mobile reviews CTA', () => {
        const { getByTestId } = renderWithQueryClient(
            <QuestCard
                styles={styles}
                cardWidth={340}
                cityId="krakow"
                quest={makeQuest({ completionsCount: 3 })}
            />,
        );

        fireEvent.press(getByTestId('quest-card-reviews-krakow-dragon'));

        expect(getByTestId('quest-reviews-modal')).toBeTruthy();
        expect(mockPush).not.toHaveBeenCalled();
    });
});
