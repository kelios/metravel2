import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/api/user', () => ({
    fetchMySubscriptions: jest.fn(),
    fetchMySubscribers: jest.fn(),
    unsubscribeFromUser: jest.fn(),
}));

jest.mock('@/api/travelsApi', () => ({
    fetchMyTravels: jest.fn(),
    unwrapMyTravelsPayload: (payload: any) => {
        if (!payload) return { items: [], total: 0 };
        if (Array.isArray(payload)) return { items: payload, total: payload.length };
        if (Array.isArray(payload?.data)) return { items: payload.data, total: payload.data.length };
        if (Array.isArray(payload?.results)) return { items: payload.results, total: Number(payload.count ?? payload.total ?? payload.results.length) || payload.results.length };
        if (Array.isArray(payload?.items)) return { items: payload.items, total: Number(payload.total ?? payload.count ?? payload.items.length) || payload.items.length };
        return { items: [], total: Number(payload?.total ?? payload?.count ?? 0) || 0 };
    },
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

import SubscriptionsScreen from '@/app/(tabs)/subscriptions';
import { useAuth } from '@/context/AuthContext';
import { fetchMySubscriptions, fetchMySubscribers } from '@/api/user';
import { fetchMyTravels } from '@/api/travelsApi';

const mockedUseAuth = useAuth as jest.Mock;
const mockedFetchMySubscriptions = fetchMySubscriptions as jest.Mock;
const mockedFetchMySubscribers = fetchMySubscribers as jest.Mock;
const mockedFetchMyTravels = fetchMyTravels as jest.Mock;

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
}

describe('SubscriptionsScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedUseAuth.mockReturnValue({
            isAuthenticated: true,
            authReady: true,
            userId: '1',
        });
        mockedFetchMySubscriptions.mockResolvedValue([]);
        mockedFetchMySubscribers.mockResolvedValue([]);
        mockedFetchMyTravels.mockResolvedValue([]);
    });

    it('shows login prompt when not authenticated', () => {
        mockedUseAuth.mockReturnValue({
            isAuthenticated: false,
            authReady: true,
            userId: null,
        });

        const { getByText } = render(<SubscriptionsScreen />, {
            wrapper: createWrapper(),
        });

        expect(getByText('Войдите в аккаунт')).toBeTruthy();
    });

    it('shows empty state when no subscriptions', async () => {
        mockedFetchMySubscriptions.mockResolvedValue([]);

        const { findByText } = render(<SubscriptionsScreen />, {
            wrapper: createWrapper(),
        });

        const emptyText = await findByText('Вы ещё ни на кого не подписаны');
        expect(emptyText).toBeTruthy();
    });

    it('shows subscribed authors with their names', async () => {
        mockedFetchMySubscriptions.mockResolvedValue([
            {
                id: 10,
                first_name: 'Иван',
                last_name: 'Петров',
                youtube: '',
                instagram: '',
                twitter: '',
                vk: '',
                avatar: '',
                user: 42,
            },
        ]);
        mockedFetchMyTravels.mockResolvedValue([]);

        const { findByText } = render(<SubscriptionsScreen />, {
            wrapper: createWrapper(),
        });

        const authorName = await findByText('Иван Петров');
        expect(authorName).toBeTruthy();
    });

    it('shows header with author count', async () => {
        mockedFetchMySubscriptions.mockResolvedValue([
            {
                id: 10,
                first_name: 'Иван',
                last_name: 'Петров',
                youtube: '',
                instagram: '',
                twitter: '',
                vk: '',
                avatar: '',
                user: 42,
            },
        ]);
        mockedFetchMyTravels.mockResolvedValue([]);

        const { findByText } = render(<SubscriptionsScreen />, {
            wrapper: createWrapper(),
        });

        const subtitle = await findByText('1 автор');
        expect(subtitle).toBeTruthy();
    });

    it('shows loading state when auth is not ready', () => {
        mockedUseAuth.mockReturnValue({
            isAuthenticated: true,
            authReady: false,
            userId: '1',
        });

        const { getByText } = render(<SubscriptionsScreen />, {
            wrapper: createWrapper(),
        });

        expect(getByText('Подписки')).toBeTruthy();
    });

    it('shows tab bar with Подписки and Подписчики tabs', async () => {
        mockedFetchMySubscriptions.mockResolvedValue([
            {
                id: 10,
                first_name: 'Иван',
                last_name: 'Петров',
                youtube: '',
                instagram: '',
                twitter: '',
                vk: '',
                avatar: '',
                user: 42,
            },
        ]);
        mockedFetchMySubscribers.mockResolvedValue([]);
        mockedFetchMyTravels.mockResolvedValue([]);

        const { findByText } = render(<SubscriptionsScreen />, {
            wrapper: createWrapper(),
        });

        const subscriptionsTab = await findByText('Подписки (1)');
        expect(subscriptionsTab).toBeTruthy();

        const subscribersTab = await findByText('Подписчики');
        expect(subscribersTab).toBeTruthy();
    });

    it('shows subscribers list when Подписчики tab is pressed', async () => {
        mockedFetchMySubscriptions.mockResolvedValue([]);
        mockedFetchMySubscribers.mockResolvedValue([
            {
                id: 20,
                first_name: 'Мария',
                last_name: 'Сидорова',
                youtube: '',
                instagram: '',
                twitter: '',
                vk: '',
                avatar: '',
                user: 55,
            },
        ]);
        mockedFetchMyTravels.mockResolvedValue([]);

        const { findByText, findByLabelText } = render(<SubscriptionsScreen />, {
            wrapper: createWrapper(),
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
            wrapper: createWrapper(),
        });

        const subscribersTab = await findByLabelText('Подписчики');
        fireEvent.press(subscribersTab);

        const emptyText = await findByText('У вас пока нет подписчиков');
        expect(emptyText).toBeTruthy();
    });
});
