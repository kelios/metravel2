import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { mockPush, mockUseRouter, resetExpoRouterMocks } from '../helpers/expoRouterMock';
import { createQueryWrapper } from '../helpers/testQueryClient';
import { createAuthValue } from '../helpers/mockContextValues';
import {
    mockFetchMyTravels,
    mockUnwrapMyTravelsPayload,
    resetTravelsApiMocks,
} from '../helpers/mockTravelsApi';
import {
    SUBSCRIPTION_AUTHOR_FIXTURE,
    SUBSCRIBER_FIXTURE,
} from '../fixtures/travelFixtures';

jest.mock('@/api/user', () => ({
    fetchMySubscriptions: jest.fn(),
    fetchMySubscribers: jest.fn(),
    unsubscribeFromUser: jest.fn(),
}));

jest.mock('@/api/travelsApi', () => ({
    fetchMyTravels: mockFetchMyTravels,
    unwrapMyTravelsPayload: mockUnwrapMyTravelsPayload,
}));

jest.mock('@/context/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('@/utils/authNavigation', () => ({
    buildLoginHref: jest.fn(() => '/login'),
}));

jest.mock('@/utils/confirmAction', () => ({
    confirmAction: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@/utils/toast', () => ({
    showToast: jest.fn(),
}));

jest.mock('expo-router', () => ({
    useRouter: mockUseRouter,
}));

import SubscriptionsScreen from '@/app/(tabs)/subscriptions';
import { useAuth } from '@/context/AuthContext';
import { fetchMySubscriptions, fetchMySubscribers } from '@/api/user';

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedFetchMySubscriptions = fetchMySubscriptions as jest.Mock;
const mockedFetchMySubscribers = fetchMySubscribers as jest.Mock;
const mockedFetchMyTravels = mockFetchMyTravels as jest.Mock;

describe('SubscriptionsScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetExpoRouterMocks();
        resetTravelsApiMocks();
        mockedUseAuth.mockReturnValue(createAuthValue({
            isAuthenticated: true,
            authReady: true,
            userId: '1',
        }));
        mockedFetchMySubscriptions.mockResolvedValue([]);
        mockedFetchMySubscribers.mockResolvedValue([]);
        mockedFetchMyTravels.mockResolvedValue([]);
    });

    it('shows login prompt when not authenticated', () => {
        mockedUseAuth.mockReturnValue(createAuthValue({
            isAuthenticated: false,
            authReady: true,
            userId: null,
        }));

        const { getByText } = render(<SubscriptionsScreen />, {
            wrapper: createQueryWrapper().Wrapper,
        });

        expect(getByText('Войдите в аккаунт')).toBeTruthy();
    });

    it('shows empty state when no subscriptions', async () => {
        mockedFetchMySubscriptions.mockResolvedValue([]);

        const { findByText } = render(<SubscriptionsScreen />, {
            wrapper: createQueryWrapper().Wrapper,
        });

        const emptyText = await findByText('Вы ещё ни на кого не подписаны');
        expect(emptyText).toBeTruthy();
    });

    it('shows subscribed authors with their names', async () => {
        mockedFetchMySubscriptions.mockResolvedValue([SUBSCRIPTION_AUTHOR_FIXTURE]);
        mockedFetchMyTravels.mockResolvedValue([]);

        const { findByText } = render(<SubscriptionsScreen />, {
            wrapper: createQueryWrapper().Wrapper,
        });

        const authorName = await findByText('Иван Петров');
        expect(authorName).toBeTruthy();
    });

    it('shows header with author count', async () => {
        mockedFetchMySubscriptions.mockResolvedValue([SUBSCRIPTION_AUTHOR_FIXTURE]);
        mockedFetchMyTravels.mockResolvedValue([]);

        const { findByText } = render(<SubscriptionsScreen />, {
            wrapper: createQueryWrapper().Wrapper,
        });

        const subtitle = await findByText('1 автор');
        expect(subtitle).toBeTruthy();
    });

    it('shows loading state when auth is not ready', () => {
        mockedUseAuth.mockReturnValue(createAuthValue({
            isAuthenticated: true,
            authReady: false,
            userId: '1',
        }));

        const { getByText } = render(<SubscriptionsScreen />, {
            wrapper: createQueryWrapper().Wrapper,
        });

        expect(getByText('Подписки')).toBeTruthy();
    });

    it('shows tab bar with Подписки and Подписчики tabs', async () => {
        mockedFetchMySubscriptions.mockResolvedValue([SUBSCRIPTION_AUTHOR_FIXTURE]);
        mockedFetchMySubscribers.mockResolvedValue([]);
        mockedFetchMyTravels.mockResolvedValue([]);

        const { findByText } = render(<SubscriptionsScreen />, {
            wrapper: createQueryWrapper().Wrapper,
        });

        const subscriptionsTab = await findByText('Подписки (1)');
        expect(subscriptionsTab).toBeTruthy();

        const subscribersTab = await findByText('Подписчики');
        expect(subscribersTab).toBeTruthy();
    });

    it('shows subscribers list when Подписчики tab is pressed', async () => {
        mockedFetchMySubscriptions.mockResolvedValue([]);
        mockedFetchMySubscribers.mockResolvedValue([SUBSCRIBER_FIXTURE]);
        mockedFetchMyTravels.mockResolvedValue([]);

        const { findByText, findByLabelText } = render(<SubscriptionsScreen />, {
            wrapper: createQueryWrapper().Wrapper,
        });

        const subscribersTab = await findByLabelText('Подписчики');
        fireEvent.press(subscribersTab);

        const subscriberName = await findByText('Мария Сидорова');
        expect(subscriberName).toBeTruthy();
    });

    it('shows empty state for subscribers tab when no subscribers', async () => {
        mockedFetchMySubscriptions.mockResolvedValue([]);
        mockedFetchMySubscribers.mockResolvedValue([]);
        mockedFetchMyTravels.mockResolvedValue([]);

        const { findByText, findByLabelText } = render(<SubscriptionsScreen />, {
            wrapper: createQueryWrapper().Wrapper,
        });

        const subscribersTab = await findByLabelText('Подписчики');
        fireEvent.press(subscribersTab);

        const emptyText = await findByText('У вас пока нет подписчиков');
        expect(emptyText).toBeTruthy();
    });

    it('opens travel by explicit url, then falls back to slug and id routes', async () => {
        mockedFetchMySubscriptions.mockResolvedValue([SUBSCRIPTION_AUTHOR_FIXTURE]);
        mockedFetchMyTravels.mockResolvedValue([
            { id: 100, title: 'Travel With Url', url: '/custom/travel-url' },
            { id: 101, title: 'Travel With Slug', slug: 'slug-trip' },
            { id: 102, title: 'Travel With Id Only' },
        ]);

        const { findByLabelText } = render(<SubscriptionsScreen />, {
            wrapper: createQueryWrapper().Wrapper,
        });

        const withUrl = await findByLabelText('Travel With Url');
        fireEvent.press(withUrl);
        expect(mockPush).toHaveBeenCalledWith('/custom/travel-url');

        const withSlug = await findByLabelText('Travel With Slug');
        fireEvent.press(withSlug);
        expect(mockPush).toHaveBeenCalledWith('/travels/slug-trip');

        const withIdOnly = await findByLabelText('Travel With Id Only');
        fireEvent.press(withIdOnly);
        expect(mockPush).toHaveBeenCalledWith('/travels/102');
    });
});
