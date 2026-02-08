import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/api/user', () => ({
    fetchMySubscriptions: jest.fn(),
    unsubscribeFromUser: jest.fn(),
}));

jest.mock('@/api/travelsApi', () => ({
    fetchMyTravels: jest.fn(),
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

import SubscriptionsScreen from '@/app/(tabs)/subscriptions';
import { useAuth } from '@/context/AuthContext';
import { fetchMySubscriptions } from '@/api/user';
import { fetchMyTravels } from '@/api/travelsApi';

const mockedUseAuth = useAuth as jest.Mock;
const mockedFetchMySubscriptions = fetchMySubscriptions as jest.Mock;
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
});
