// Подписка email аккаунта и отправка квеста на почту (#2317 бэк, #2318 фронт).
//
// Контракт бэка:
// - `GET /api/subscribe/status/` (только с входом) → `{subscribed, email}`:
//   у email аккаунта есть подтверждённая активная подписка на рассылку;
// - `POST /api/subscribe/send-quest/` (только с входом) `{page_url}` → 200
//   `{ok, status: 'sent'}`; 403 `{code: 'not_subscribed'}` — подписки нет
//   (отписался в другой вкладке); 400 — квест по адресу не распознан; 429 — лимит.

import { apiClient, ApiError } from '@/api/client';
import { translate as i18nT } from '@/i18n';

export type EmailSubscriptionStatus = {
  subscribed: boolean;
  email: string;
};

export const fetchEmailSubscriptionStatus = async (): Promise<EmailSubscriptionStatus> => {
  const json = await apiClient.get<{ subscribed?: unknown; email?: unknown } | null>(
    '/subscribe/status/',
  );
  return {
    subscribed: json?.subscribed === true,
    email: typeof json?.email === 'string' ? json.email : '',
  };
};

/** Подписки больше нет: блок должен вернуться к форме подписки. */
export class NotSubscribedError extends Error {
  constructor() {
    super(i18nT('sharedStatic:subscription.sendQuestNotSubscribed'));
    this.name = 'NotSubscribedError';
  }
}

export const sendQuestToEmail = async (pageUrl: string): Promise<void> => {
  try {
    await apiClient.post<unknown>('/subscribe/send-quest/', { page_url: pageUrl });
  } catch (error) {
    if (error instanceof ApiError) {
      const code = (error.data as { code?: unknown } | undefined)?.code;
      if (error.status === 403 && code === 'not_subscribed') throw new NotSubscribedError();
      if (error.status === 429) throw new Error(i18nT('errorsStatic:api.misc.tooManyAttempts'));
    }
    throw new Error(i18nT('sharedStatic:subscription.sendQuestFailed'));
  }
};
