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

function renderForm(source = 'quest') {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <EmailSubscriptionForm source={source} />
        </QueryClientProvider>,
    );
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
                undefined,
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

    it('не обращается к бэкенду при некорректном email', async () => {
        const { getByLabelText, getByTestId, queryByText } = renderForm();

        fireEvent.changeText(getByLabelText(EMAIL_LABEL), 'not-an-email');
        fireEvent.press(getByTestId('email-subscribe-consent'));
        fireEvent.press(getByLabelText(SUBMIT_LABEL));

        await waitFor(() => expect(queryByText('Введите корректный email')).toBeTruthy());
        expect(mockedSubscribeEmail).not.toHaveBeenCalled();
    });
});
