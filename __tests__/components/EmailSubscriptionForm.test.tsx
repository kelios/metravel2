import React from 'react';
import { act, render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/api/misc', () => ({
    subscribeEmail: jest.fn(),
}));

const mockAuth = { isAuthenticated: false, userId: null as string | null };
// Подписка как у настоящего useAuth (стор): смена аккаунта перерисовывает форму
// без смены пропсов, иначе memo-компонент её не увидит.
const mockAuthStore = { version: 0, listeners: new Set<() => void>() };
jest.mock('@/context/AuthContext', () => {
    const { useSyncExternalStore } = jest.requireActual('react');
    return {
        useAuth: () => {
            useSyncExternalStore(
                (listener: () => void) => {
                    mockAuthStore.listeners.add(listener);
                    return () => mockAuthStore.listeners.delete(listener);
                },
                () => mockAuthStore.version,
            );
            return mockAuth;
        },
    };
});

function switchAuth(next: { isAuthenticated: boolean; userId: string | null }) {
    act(() => {
        Object.assign(mockAuth, next);
        mockAuthStore.version += 1;
        mockAuthStore.listeners.forEach((listener) => listener());
    });
}

jest.mock('@/api/emailSubscription', () => {
    const actual = jest.requireActual('@/api/emailSubscription');
    return {
        ...actual,
        fetchEmailSubscriptionStatus: jest.fn(),
        sendQuestToEmail: jest.fn(),
    };
});

jest.mock('@/utils/analytics', () => ({
    queueAnalyticsEvent: jest.fn(),
}));

jest.mock('@/utils/actionConsent', () => {
    const actual = jest.requireActual('@/utils/actionConsent');
    return { ...actual, recordActionConsent: jest.fn(() => Promise.resolve()) };
});

jest.mock('expo-router', () => ({
    Link: ({ children }: { children: React.ReactNode }) => children,
}));

import EmailSubscriptionForm from '@/components/common/EmailSubscriptionForm';
import { subscribeEmail } from '@/api/misc';
import {
    fetchEmailSubscriptionStatus,
    NotSubscribedError,
    sendQuestToEmail,
} from '@/api/emailSubscription';
import { queueAnalyticsEvent } from '@/utils/analytics';
import { EMAIL_SUBSCRIPTION_CONSENT, recordActionConsent } from '@/utils/actionConsent';

const mockedSubscribeEmail = subscribeEmail as jest.Mock;
const mockedQueueAnalyticsEvent = queueAnalyticsEvent as jest.Mock;
const mockedRecordActionConsent = recordActionConsent as jest.Mock;
const mockedFetchStatus = fetchEmailSubscriptionStatus as jest.Mock;
const mockedSendQuest = sendQuestToEmail as jest.Mock;

const QUEST_URL = 'https://metravel.by/quests/12/luxembourg-old-town';

function renderForm(source = 'quest', pageUrl: string | null = QUEST_URL, accountDelivery = false) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <EmailSubscriptionForm source={source} pageUrl={pageUrl} accountDelivery={accountDelivery} />
        </QueryClientProvider>,
    );
}

async function submitValid(utils: ReturnType<typeof renderForm>) {
    fireEvent.changeText(utils.getByLabelText(EMAIL_LABEL), 'reader@example.com');
    fireEvent.press(utils.getByTestId('email-subscribe-consent'));
    fireEvent.press(utils.getByLabelText(SUBMIT_LABEL));
}

const EMAIL_LABEL = 'Email для подписки на новые маршруты';
const SUBMIT_LABEL = 'Подписаться на рассылку новых маршрутов';

describe('EmailSubscriptionForm', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAuth.isAuthenticated = false;
        mockAuth.userId = null;
        mockedSubscribeEmail.mockResolvedValue({ ok: true, status: 'created' });
    });

    it('не отправляет подписку, пока согласие не отмечено', async () => {
        const { getByLabelText } = renderForm();

        fireEvent.changeText(getByLabelText(EMAIL_LABEL), 'reader@example.com');
        fireEvent.press(getByLabelText(SUBMIT_LABEL));

        await waitFor(() => expect(mockedSubscribeEmail).not.toHaveBeenCalled());
        expect(mockedRecordActionConsent).not.toHaveBeenCalled();
    });

    it('submit по Enter без согласия объясняет причину, а не молчит', async () => {
        const { getByLabelText, getByTestId, queryByText } = renderForm();
        const input = getByLabelText(EMAIL_LABEL);

        fireEvent.changeText(input, 'reader@example.com');
        fireEvent(input, 'submitEditing');

        await waitFor(() =>
            expect(queryByText('Отметьте согласие, чтобы подписаться')).toBeTruthy(),
        );
        expect(mockedSubscribeEmail).not.toHaveBeenCalled();
        // причина относится к чекбоксу: валидный email не помечается ошибкой
        expect(queryByText('Введите корректный email')).toBeNull();

        // отметка согласия убирает подсказку
        fireEvent.press(getByTestId('email-subscribe-consent'));
        await waitFor(() =>
            expect(queryByText('Отметьте согласие, чтобы подписаться')).toBeNull(),
        );
    });

    it('после согласия отправляет email на серверный контракт и фиксирует согласие', async () => {
        const { getByLabelText, getByTestId } = renderForm('quest');

        fireEvent.changeText(getByLabelText(EMAIL_LABEL), 'reader@example.com');
        fireEvent.press(getByTestId('email-subscribe-consent'));
        fireEvent.press(getByLabelText(SUBMIT_LABEL));

        await waitFor(() =>
            expect(mockedSubscribeEmail).toHaveBeenCalledWith(
                'reader@example.com',
                'quest',
                QUEST_URL,
                {
                    granted: true,
                    version: EMAIL_SUBSCRIPTION_CONSENT.version,
                },
            ),
        );
        expect(mockedRecordActionConsent).toHaveBeenCalledWith(
            EMAIL_SUBSCRIPTION_CONSENT.type,
            EMAIL_SUBSCRIPTION_CONSENT.version,
        );
    });

    it('шлёт событие email_subscribe с источником только после успеха бэкенда', async () => {
        const { getByLabelText, getByTestId } = renderForm('scenario');

        fireEvent.changeText(getByLabelText(EMAIL_LABEL), 'reader@example.com');
        fireEvent.press(getByTestId('email-subscribe-consent'));
        fireEvent.press(getByLabelText(SUBMIT_LABEL));

        await waitFor(() =>
            expect(mockedQueueAnalyticsEvent).toHaveBeenCalledWith('email_subscribe', {
                source: 'scenario',
                status: 'created',
            }),
        );
    });

    it('при ошибке бэкенда не показывает успех и не шлёт событие', async () => {
        mockedSubscribeEmail.mockRejectedValue(new Error('Не удалось оформить подписку'));
        const { getByLabelText, getByTestId, queryByText } = renderForm();

        fireEvent.changeText(getByLabelText(EMAIL_LABEL), 'reader@example.com');
        fireEvent.press(getByTestId('email-subscribe-consent'));
        fireEvent.press(getByLabelText(SUBMIT_LABEL));

        await waitFor(() => expect(queryByText('Не удалось оформить подписку')).toBeTruthy());
        expect(mockedQueueAnalyticsEvent).not.toHaveBeenCalled();
        expect(queryByText(/Готово/)).toBeNull();
    });

    // #2124: адрес страницы задаёт место монтажа, на всех платформах одинаково.
    it.each(['ios', 'android', 'web'] as const)(
        'на %s отправляет canonical страницы из пропа pageUrl',
        async (os) => {
            const { Platform } = require('react-native');
            const original = Platform.OS;
            Platform.OS = os;
            try {
                const utils = renderForm('quest', QUEST_URL);
                await submitValid(utils);
                await waitFor(() => expect(mockedSubscribeEmail).toHaveBeenCalled());
                expect(mockedSubscribeEmail.mock.calls[0][2]).toBe(QUEST_URL);
            } finally {
                Platform.OS = original;
            }
        },
    );

    it('pageUrl=null не угадывает адрес из window.location, а не шлёт ничего', async () => {
        const utils = renderForm('home', null);
        await submitValid(utils);
        await waitFor(() => expect(mockedSubscribeEmail).toHaveBeenCalled());
        expect(mockedSubscribeEmail.mock.calls[0][2]).toBeUndefined();
    });

    it('после created на квесте просит подтвердить почту и обещает этот квест', async () => {
        const utils = renderForm('quest');
        await submitValid(utils);
        await waitFor(() =>
            expect(
                utils.queryByText('Проверьте почту и подтвердите подписку, после этого пришлём этот квест.'),
            ).toBeTruthy(),
        );
        expect(utils.queryByText(/Готово/)).toBeNull();
    });

    it('после created в остальных местах обещает письмо', async () => {
        const utils = renderForm('article', 'https://metravel.by/articles');
        await submitValid(utils);
        await waitFor(() =>
            expect(
                utils.queryByText('Проверьте почту и подтвердите подписку, после этого пришлём письмо.'),
            ).toBeTruthy(),
        );
        expect(utils.queryByText(/Готово/)).toBeNull();
    });

    it('для exists текст прежний', async () => {
        mockedSubscribeEmail.mockResolvedValue({ ok: true, status: 'exists' });
        const utils = renderForm('quest');
        await submitValid(utils);
        await waitFor(() => expect(utils.queryByText(/Вы уже подписаны/)).toBeTruthy());
        expect(utils.queryByText(/Проверьте почту/)).toBeNull();
    });

    it('не обращается к бэкенду при некорректном email', async () => {
        const { getByLabelText, getByTestId, queryByText } = renderForm();

        fireEvent.changeText(getByLabelText(EMAIL_LABEL), 'not-an-email');
        fireEvent.press(getByTestId('email-subscribe-consent'));
        fireEvent.press(getByLabelText(SUBMIT_LABEL));

        await waitFor(() => expect(queryByText('Введите корректный email')).toBeTruthy());
        expect(mockedSubscribeEmail).not.toHaveBeenCalled();
    });

    it('гостю с уже подтверждённой подпиской сообщает, что квест отправлен (status=sent)', async () => {
        mockedSubscribeEmail.mockResolvedValue({ ok: true, status: 'sent' });
        const utils = renderForm('quest');
        await submitValid(utils);
        await waitFor(() =>
            expect(utils.queryByText('Вы уже подписаны — отправили квест на почту.')).toBeTruthy(),
        );
    });

    describe('accountDelivery (#2318)', () => {
        const SEND_LABEL = 'Прислать печатную версию квеста на me@example.com';

        beforeEach(() => {
            mockAuth.isAuthenticated = true;
            mockAuth.userId = '7';
        });

        it('гость видит форму и статус подписки не запрашивается', async () => {
            mockAuth.isAuthenticated = false;
            const utils = renderForm('quest', QUEST_URL, true);
            expect(utils.getByLabelText(EMAIL_LABEL)).toBeTruthy();
            expect(mockedFetchStatus).not.toHaveBeenCalled();
        });

        it('подписанному вместо формы — кнопка, квест уходит на email аккаунта', async () => {
            mockedFetchStatus.mockResolvedValue({ subscribed: true, email: 'me@example.com' });
            mockedSendQuest.mockResolvedValue(undefined);
            const utils = renderForm('quest', QUEST_URL, true);

            const button = await waitFor(() => utils.getByLabelText(SEND_LABEL));
            expect(utils.queryByLabelText(EMAIL_LABEL)).toBeNull();
            expect(utils.queryByTestId('email-subscribe-consent')).toBeNull();

            fireEvent.press(button);
            await waitFor(() =>
                expect(utils.queryByText('Отправили квест на me@example.com — проверьте почту.')).toBeTruthy(),
            );
            expect(mockedSendQuest).toHaveBeenCalledWith(QUEST_URL);
            expect(mockedSubscribeEmail).not.toHaveBeenCalled();
            expect(mockedQueueAnalyticsEvent).toHaveBeenCalledWith('quest_email_send', { source: 'quest' });
        });

        it('неподписанному — форма с подставленным email аккаунта', async () => {
            mockedFetchStatus.mockResolvedValue({ subscribed: false, email: 'me@example.com' });
            const utils = renderForm('quest', QUEST_URL, true);
            await waitFor(() =>
                expect(utils.getByLabelText(EMAIL_LABEL).props.value).toBe('me@example.com'),
            );
            expect(utils.queryByLabelText(SEND_LABEL)).toBeNull();
        });

        it('ошибка статуса — честный запасной вариант: обычная форма', async () => {
            mockedFetchStatus.mockRejectedValue(new Error('404'));
            const utils = renderForm('quest', QUEST_URL, true);
            await waitFor(() => expect(utils.getByLabelText(EMAIL_LABEL)).toBeTruthy());
        });

        it('подписка пропала (403 not_subscribed) — возвращает форму с причиной', async () => {
            mockedFetchStatus.mockResolvedValue({ subscribed: true, email: 'me@example.com' });
            mockedSendQuest.mockRejectedValue(new NotSubscribedError());
            const utils = renderForm('quest', QUEST_URL, true);

            fireEvent.press(await waitFor(() => utils.getByLabelText(SEND_LABEL)));
            await waitFor(() => expect(utils.getByLabelText(EMAIL_LABEL)).toBeTruthy());
            expect(
                utils.queryByText('Подписка не найдена — подпишитесь, и мы пришлём квест.'),
            ).toBeTruthy();
        });

        it('выход и вход другим аккаунтом не переносят итог отправки и email прошлого', async () => {
            mockedFetchStatus.mockResolvedValue({ subscribed: true, email: 'me@example.com' });
            mockedSendQuest.mockResolvedValue(undefined);
            const utils = renderForm('quest', QUEST_URL, true);

            fireEvent.press(await waitFor(() => utils.getByLabelText(SEND_LABEL)));
            await waitFor(() =>
                expect(utils.queryByText('Отправили квест на me@example.com — проверьте почту.')).toBeTruthy(),
            );

            switchAuth({ isAuthenticated: false, userId: null });
            await waitFor(() => expect(utils.getByLabelText(EMAIL_LABEL).props.value).toBe(''));

            mockedFetchStatus.mockResolvedValue({ subscribed: true, email: 'other@example.com' });
            switchAuth({ isAuthenticated: true, userId: '8' });
            await waitFor(() =>
                expect(utils.getByLabelText('Прислать печатную версию квеста на other@example.com')).toBeTruthy(),
            );
            expect(utils.queryByText(/Отправили квест на/)).toBeNull();
        });

        it('неподписанному после смены аккаунта подставляется email нового аккаунта', async () => {
            mockedFetchStatus.mockResolvedValue({ subscribed: false, email: 'me@example.com' });
            const utils = renderForm('quest', QUEST_URL, true);
            await waitFor(() =>
                expect(utils.getByLabelText(EMAIL_LABEL).props.value).toBe('me@example.com'),
            );

            mockedFetchStatus.mockResolvedValue({ subscribed: false, email: 'other@example.com' });
            switchAuth({ isAuthenticated: true, userId: '8' });
            await waitFor(() =>
                expect(utils.getByLabelText(EMAIL_LABEL).props.value).toBe('other@example.com'),
            );
        });

        it('прочая ошибка отправки остаётся у кнопки', async () => {
            mockedFetchStatus.mockResolvedValue({ subscribed: true, email: 'me@example.com' });
            mockedSendQuest.mockRejectedValue(new Error('Не удалось отправить квест. Попробуйте ещё раз.'));
            const utils = renderForm('quest', QUEST_URL, true);

            fireEvent.press(await waitFor(() => utils.getByLabelText(SEND_LABEL)));
            await waitFor(() =>
                expect(utils.queryByText('Не удалось отправить квест. Попробуйте ещё раз.')).toBeTruthy(),
            );
            expect(utils.getByLabelText(SEND_LABEL)).toBeTruthy();
        });
    });
});
