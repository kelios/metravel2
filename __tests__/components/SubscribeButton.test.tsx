import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/api/user', () => ({
    fetchMySubscriptions: jest.fn(),
    subscribeToUser: jest.fn(),
    unsubscribeFromUser: jest.fn(),
}));

jest.mock('@/context/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('@/utils/authNavigation', () => ({
    buildLoginHref: jest.fn(() => '/login'),
}));

import SubscribeButton from '@/components/ui/SubscribeButton';
import { useAuth } from '@/context/AuthContext';
import {
    fetchMySubscriptions,
    subscribeToUser,
    unsubscribeFromUser,
} from '@/api/user';

const mockedUseAuth = useAuth as jest.Mock;
const mockedFetchMySubscriptions = fetchMySubscriptions as jest.Mock;
const mockedSubscribeToUser = subscribeToUser as jest.Mock;
const mockedUnsubscribeFromUser = unsubscribeFromUser as jest.Mock;

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

describe('SubscribeButton', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedUseAuth.mockReturnValue({
            isAuthenticated: true,
            userId: '1',
        });
        mockedFetchMySubscriptions.mockResolvedValue([]);
        mockedSubscribeToUser.mockResolvedValue(null);
        mockedUnsubscribeFromUser.mockResolvedValue(null);
    });

    it('renders nothing when viewing own profile', () => {
        mockedUseAuth.mockReturnValue({
            isAuthenticated: true,
            userId: '42',
        });

        const { toJSON } = render(
            <SubscribeButton targetUserId="42" />,
            { wrapper: createWrapper() }
        );

        expect(toJSON()).toBeNull();
    });

    it('renders "Подписаться" when not subscribed', async () => {
        mockedFetchMySubscriptions.mockResolvedValue([]);

        const { findByText } = render(
            <SubscribeButton targetUserId="99" />,
            { wrapper: createWrapper() }
        );

        const button = await findByText('Подписаться');
        expect(button).toBeTruthy();
    });

    it('renders "Вы подписаны" when already subscribed', async () => {
        mockedFetchMySubscriptions.mockResolvedValue([
            { id: 5, first_name: 'Test', last_name: 'User', user: 99 },
        ]);

        const { findByText } = render(
            <SubscribeButton targetUserId="99" />,
            { wrapper: createWrapper() }
        );

        const button = await findByText('Вы подписаны');
        expect(button).toBeTruthy();
    });

    it('calls subscribeToUser on press when not subscribed', async () => {
        mockedFetchMySubscriptions.mockResolvedValue([]);

        const { findByText } = render(
            <SubscribeButton targetUserId="99" />,
            { wrapper: createWrapper() }
        );

        const button = await findByText('Подписаться');
        fireEvent.press(button);

        await waitFor(() => {
            expect(mockedSubscribeToUser).toHaveBeenCalledWith('99');
        });
    });

    it('calls unsubscribeFromUser on press when subscribed', async () => {
        mockedFetchMySubscriptions.mockResolvedValue([
            { id: 5, first_name: 'Test', last_name: 'User', user: 99 },
        ]);

        const { findByText } = render(
            <SubscribeButton targetUserId="99" />,
            { wrapper: createWrapper() }
        );

        const button = await findByText('Вы подписаны');
        fireEvent.press(button);

        await waitFor(() => {
            expect(mockedUnsubscribeFromUser).toHaveBeenCalledWith('99');
        });
    });

    it('renders subscribe button for unauthenticated users (redirects to login)', async () => {
        mockedUseAuth.mockReturnValue({
            isAuthenticated: false,
            userId: null,
        });

        const { findByText } = render(
            <SubscribeButton targetUserId="99" />,
            { wrapper: createWrapper() }
        );

        const button = await findByText('Подписаться');
        expect(button).toBeTruthy();
    });

    it('renders nothing when targetUserId is null', () => {
        const { toJSON } = render(
            <SubscribeButton targetUserId={null} />,
            { wrapper: createWrapper() }
        );

        expect(toJSON()).toBeNull();
    });
});
