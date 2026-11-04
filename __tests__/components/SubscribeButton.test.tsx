import React from 'react';
import { act, render, fireEvent, waitFor } from '@testing-library/react-native';
import { useAuthStore } from '@/stores/authStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/api/user', () => ({
    fetchSubscriptionStatus: jest.fn(),
    subscribeToUser: jest.fn(),
    unsubscribeFromUser: jest.fn(),
}));

jest.mock('@/context/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('@/utils/authNavigation', () => ({
    buildLoginHref: jest.fn(() => '/login'),
    markSignedInBefore: jest.fn(),
}));

jest.mock('@/utils/toast', () => ({
    showToast: jest.fn(),
}));

import SubscribeButton from '@/components/ui/SubscribeButton';
import { useAuth } from '@/context/AuthContext';
import {
    fetchSubscriptionStatus,
    subscribeToUser,
    unsubscribeFromUser,
} from '@/api/user';

const mockedUseAuth = useAuth as jest.Mock;
const mockedFetchSubscriptionStatus = fetchSubscriptionStatus as jest.Mock;
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
        useAuthStore.setState({ isAuthenticated: true, userId: '1' });
        mockedUseAuth.mockReturnValue({
            isAuthenticated: true,
            userId: '1',
        });
        mockedFetchSubscriptionStatus.mockResolvedValue(false);
        mockedSubscribeToUser.mockResolvedValue(null);
        mockedUnsubscribeFromUser.mockResolvedValue(null);
    });

    it('renders nothing when viewing own profile', async () => {
        mockedUseAuth.mockReturnValue({
            isAuthenticated: true,
            userId: '42',
        });

        const { toJSON } = await render(
            <SubscribeButton targetUserId="42" />,
            { wrapper: createWrapper() }
        );

        expect(toJSON()).toBeNull();
    });

    it('renders "Подписаться" when not subscribed', async () => {
        mockedFetchSubscriptionStatus.mockResolvedValue(false);

        const { findByText } = await render(
            <SubscribeButton targetUserId="99" />,
            { wrapper: createWrapper() }
        );

        const button = await findByText('Подписаться');
        expect(button).toBeTruthy();
    });

    it('renders "Вы подписаны" when already subscribed', async () => {
        mockedFetchSubscriptionStatus.mockResolvedValue(true);

        const { findByText } = await render(
            <SubscribeButton targetUserId="99" />,
            { wrapper: createWrapper() }
        );

        const button = await findByText('Вы подписаны');
        expect(button).toBeTruthy();
    });

    it('calls subscribeToUser on press when not subscribed', async () => {
        mockedFetchSubscriptionStatus.mockResolvedValue(false);

        const { findByText } = await render(
            <SubscribeButton targetUserId="99" />,
            { wrapper: createWrapper() }
        );

        const button = await findByText('Подписаться');
        await fireEvent.press(button);

        await waitFor(() => {
            expect(mockedSubscribeToUser).toHaveBeenCalledWith(99, expect.any(Function));
        });
    });

    it('calls unsubscribeFromUser on press when subscribed', async () => {
        mockedFetchSubscriptionStatus.mockResolvedValue(true);

        const { findByText } = await render(
            <SubscribeButton targetUserId="99" />,
            { wrapper: createWrapper() }
        );

        const button = await findByText('Вы подписаны');
        await fireEvent.press(button);

        await waitFor(() => {
            expect(mockedUnsubscribeFromUser).toHaveBeenCalledWith(99, expect.any(Function));
        });
    });

    it.each([false, true])('cancels a prepared mutation after the account changes (subscribed=%s)', async (subscribed) => {
        mockedFetchSubscriptionStatus.mockResolvedValue(subscribed);
        const mutation = subscribed ? mockedUnsubscribeFromUser : mockedSubscribeToUser;
        const dispatch = jest.fn();
        let credentialsRead!: () => void;
        let mutationResult: Promise<unknown> | undefined;
        mutation.mockImplementation((_target, beforeFetch) => {
            mutationResult = new Promise<void>((resolve) => { credentialsRead = resolve; })
                .then(() => {
                    beforeFetch();
                    dispatch();
                });
            return mutationResult;
        });

        const { findByText } = await render(<SubscribeButton targetUserId="99" />, {
            wrapper: createWrapper(),
        });
        await fireEvent.press(await findByText(subscribed ? 'Вы подписаны' : 'Подписаться'));
        await waitFor(() => expect(mutation).toHaveBeenCalledTimes(1));

        await act(async () => {
            useAuthStore.setState({ userId: '2' });
            credentialsRead();
            await expect(mutationResult).rejects.toMatchObject({ name: 'AbortError' });
        });
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('renders subscribe button for unauthenticated users (redirects to login)', async () => {
        mockedUseAuth.mockReturnValue({
            isAuthenticated: false,
            userId: null,
        });

        const { findByText } = await render(
            <SubscribeButton targetUserId="99" />,
            { wrapper: createWrapper() }
        );

        const button = await findByText('Подписаться');
        expect(button).toBeTruthy();
    });

    it('renders nothing when targetUserId is null', async () => {
        const { toJSON } = await render(
            <SubscribeButton targetUserId={null} />,
            { wrapper: createWrapper() }
        );

        expect(toJSON()).toBeNull();
    });

    it('shows loading state while subscriptions are being fetched', async () => {
        mockedFetchSubscriptionStatus.mockReturnValue(new Promise(() => {}));

        const { getByLabelText } = await render(
            <SubscribeButton targetUserId="99" />,
            { wrapper: createWrapper() }
        );

        const button = getByLabelText('Загрузка состояния подписки');
        expect(button).toBeTruthy();
    });

    it('shows success toast after subscribe', async () => {
        const { showToast } = require('@/utils/toast');
        mockedFetchSubscriptionStatus.mockResolvedValue(false);
        const { findByText } = await render(
            <SubscribeButton targetUserId="99" />,
            { wrapper: createWrapper() }
        );
        await fireEvent.press(await findByText('Подписаться'));
        await waitFor(() => {
            expect(showToast).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'success', text1: 'Вы подписаны' })
            );
        });
    });

    it('shows toast on subscribe error', async () => {
        const { showToast } = require('@/utils/toast');
        mockedFetchSubscriptionStatus.mockResolvedValue(false);
        mockedSubscribeToUser.mockRejectedValue(new Error('Network error'));

        const { findByText } = await render(
            <SubscribeButton targetUserId="99" />,
            { wrapper: createWrapper() }
        );

        const button = await findByText('Подписаться');
        await fireEvent.press(button);

        await waitFor(() => {
            expect(showToast).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'error', text2: expect.stringContaining('подписаться') })
            );
        });
    });

    it('shows toast on unsubscribe error', async () => {
        const { showToast } = require('@/utils/toast');
        mockedFetchSubscriptionStatus.mockResolvedValue(true);
        let rejectMutation!: (error: Error) => void;
        mockedUnsubscribeFromUser.mockImplementation(() => new Promise((_resolve, reject) => {
            rejectMutation = reject;
        }));

        const { findByText } = await render(
            <SubscribeButton targetUserId="99" />,
            { wrapper: createWrapper() }
        );

        const button = await findByText('Вы подписаны');
        await fireEvent.press(button);
        expect(await findByText('Подписаться')).toBeTruthy();
        await act(async () => rejectMutation(new Error('Network error')));

        await waitFor(() => {
            expect(showToast).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'error', text2: expect.stringContaining('отписаться') })
            );
        });
        expect(await findByText('Вы подписаны')).toBeTruthy();
    });

    it('loads exact status only after row disclosure and mutates on a separate tap', async () => {
        mockedFetchSubscriptionStatus.mockResolvedValue(true);
        const { findByLabelText } = await render(
            <SubscribeButton targetUserId="99" iconOnly deferStatus />,
            { wrapper: createWrapper() }
        );
        expect(mockedFetchSubscriptionStatus).not.toHaveBeenCalled();
        await fireEvent.press(await findByLabelText('Проверить статус подписки'));
        const unsubscribe = await findByLabelText('Отписаться от пользователя');
        expect(mockedFetchSubscriptionStatus).toHaveBeenCalledWith(99, expect.any(AbortSignal));
        expect(mockedUnsubscribeFromUser).not.toHaveBeenCalled();
        await fireEvent.press(unsubscribe);
        await waitFor(() => expect(mockedUnsubscribeFromUser).toHaveBeenCalledWith(99, expect.any(Function)));
    });
});
