import { setAuthSessionProbe } from '@/api/authInvalidation';
import { apiClient, ApiError } from '@/api/client';
import { postConsentRecord } from '@/api/consent';

// #2361: серверная запись согласия — только для вошедшего пользователя. Гостю
// `/user/consents/` отвечает 401 и тянет за собой пробу сессии, поэтому запрос
// не уходит вовсе; гостевое согласие на рассылку несёт `/api/subscribe/` (#1522).

jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn() } };
});

const mockedPost = (apiClient as unknown as { post: jest.Mock }).post;

beforeEach(() => {
  jest.clearAllMocks();
  setAuthSessionProbe(null);
});

afterAll(() => {
  setAuthSessionProbe(null);
});

describe('postConsentRecord', () => {
  it('гостю не отправляет запрос', async () => {
    setAuthSessionProbe(() => false);

    await postConsentRecord('email_subscribe', 'email-subscribe-2026-08-20-v1');

    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('без зарегистрированной пробы считает пользователя гостем', async () => {
    await postConsentRecord('quest_start');

    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('вошедшему пользователю пишет согласие на сервер', async () => {
    setAuthSessionProbe(() => true);
    mockedPost.mockResolvedValue({});

    await postConsentRecord('email_subscribe', 'email-subscribe-2026-08-20-v1');

    expect(mockedPost).toHaveBeenCalledWith('/user/consents/', {
      consent_type: 'email_subscribe',
      version: 'email-subscribe-2026-08-20-v1',
    });
  });

  it.each([401, 404, 0, 500])('вошедшему пользователю не пробрасывает ошибку %s', async (status) => {
    setAuthSessionProbe(() => true);
    mockedPost.mockRejectedValue(new ApiError(status, 'fail'));

    await expect(postConsentRecord('trip_apply', '1')).resolves.toBeUndefined();
  });
});
