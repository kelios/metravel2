import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { PixelRatio, Platform } from 'react-native';

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
                loading: 'lazy',
                priority: 'low',
                optimizeWeb: false,
                allowCriticalWebBlur: true,
                allowSafariWebLazy: true,
            }),
        );
        expect(getByTestId('quest-card-pioneer-krakow-dragon')).toBeTruthy();
    });

    it('requests high fetch priority for the first above-the-fold cards', () => {
        renderWithQueryClient(
            <QuestCard
                styles={styles}
                cardWidth={340}
                cityId="krakow"
                quest={makeQuest()}
                index={0}
            />,
        );

        expect(mockImageCardMedia.mock.calls[0]?.[0]).toEqual(
            expect.objectContaining({ priority: 'high' }),
        );
    });

    it('asks to clarify age for a kids quest without replacing its city label', () => {
        const { getByTestId, getByText, queryByText } = renderWithQueryClient(
            <QuestCard
                styles={styles}
                cardWidth={340}
                cityId="krakow"
                quest={makeQuest({ tags: ['kids', 'family'] })}
            />,
        );

        expect(getByTestId('quest-card-kids-krakow-dragon')).toBeTruthy();
        expect(getByText('Уточнить возраст')).toBeTruthy();
        expect(getByText('Kraków')).toBeTruthy();
        expect(queryByText('Для детей')).toBeNull();
        expect(queryByText('Детская сказка')).toBeNull();
    });

    it('shows an explicit age category when age tags are present', () => {
        const { getByTestId, getByText, queryByText } = renderWithQueryClient(
            <QuestCard
                styles={styles}
                cardWidth={340}
                cityId="vitebsk"
                quest={makeQuest({ id: 'vitebsk-teens', tags: ['kids', 'age-11-14'] })}
            />,
        );

        expect(getByTestId('quest-card-kids-vitebsk-teens')).toBeTruthy();
        expect(getByText('11-14 лет')).toBeTruthy();
        expect(queryByText('Для детей')).toBeNull();
    });

    it('passes a resized proxy cover URL to native image instead of the full-size original', () => {
        (Platform as { OS: string }).OS = 'android';
        const prevApiUrl = process.env.EXPO_PUBLIC_API_URL;
        process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by';

        try {
            renderWithQueryClient(
                <QuestCard
                    styles={styles}
                    cardWidth={340}
                    cityId="krakow"
                    quest={makeQuest({
                        cover: 'https://metravel.by/quest-cover/quests/1/main/abc.png',
                    })}
                    index={5}
                />,
            );

            const src = String(mockImageCardMedia.mock.calls[0]?.[0]?.src);
            expect(src).toContain('https://metravel.by/quest-cover/quests/1/main/abc.png?');
            expect(src).toContain('w=');
            expect(src).toContain('q=60');
            expect(src).toContain('fit=contain');
        } finally {
            process.env.EXPO_PUBLIC_API_URL = prevApiUrl;
        }
    });

    it('keeps only the first two covers eager and high-priority', () => {
        for (const index of [0, 1, 2]) {
            mockImageCardMedia.mockClear();
            renderWithQueryClient(
                <QuestCard
                    styles={styles}
                    cardWidth={420}
                    cityId="krakow"
                    quest={makeQuest({ id: `quest-${index}` })}
                    index={index}
                />,
            );

            expect(mockImageCardMedia.mock.calls[0]?.[0]).toEqual(
                expect.objectContaining({
                    loading: index < 2 ? 'eager' : 'lazy',
                    priority: index < 2 ? 'high' : 'low',
                    allowSafariWebLazy: index >= 2,
                }),
            );
        }
    });

    it('uses a 480px web cover candidate for a 420px DPR1 card', () => {
        const pixelRatioSpy = jest.spyOn(PixelRatio, 'get').mockReturnValue(1);
        const prevApiUrl = process.env.EXPO_PUBLIC_API_URL;
        process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by';

        try {
            renderWithQueryClient(
                <QuestCard
                    styles={styles}
                    cardWidth={420}
                    cityId="krakow"
                    quest={makeQuest({
                        cover: 'https://metravel.by/quest-cover/quests/1/main/abc.png',
                    })}
                    index={2}
                />,
            );

            const src = String(mockImageCardMedia.mock.calls[0]?.[0]?.src);
            expect(src).toContain('w=480');
            expect(src).not.toContain('w=1024');
        } finally {
            process.env.EXPO_PUBLIC_API_URL = prevApiUrl;
            pixelRatioSpy.mockRestore();
        }
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
