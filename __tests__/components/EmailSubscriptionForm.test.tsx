import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/api/misc', () => ({
    subscribeEmail: jest.fn(),
}));

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
import { queueAnalyticsEvent } from '@/utils/analytics';
import { EMAIL_SUBSCRIPTION_CONSENT, recordActionConsent } from '@/utils/actionConsent';

const mockedSubscribeEmail = subscribeEmail as jest.Mock;
const mockedQueueAnalyticsEvent = queueAnalyticsEvent as jest.Mock;
const mockedRecordActionConsent = recordActionConsent as jest.Mock;

const QUEST_URL = 'https://metravel.by/quests/12/luxembourg-old-town';

function renderForm(source = 'quest', pageUrl: string | null = QUEST_URL) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <EmailSubscriptionForm source={source} pageUrl={pageUrl} />
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
});
