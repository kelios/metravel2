// Ссылки подтверждения и отписки рассылки из писем (#2121).
//
// Контракт бэка (#1500, #823): `GET /api/subscribe/confirm/<token>/` и
// `GET /api/subscribe/unsubscribe/<token>/` — 200 `{ok, status}`, 404 для
// неизвестного, устаревшего или уже израсходованного токена, 429 при лимите.
//
// Ошибка сети, таймаут, 429 и 5xx — это `error`, а не `invalid`: сказать
// человеку «ссылка недействительна», когда упала сеть, — ложь. Ретраев нет
// намеренно: повтор после того, как бэк уже израсходовал токен, вернул бы 404 и
// показал ложное «недействительна».

import { API_BASE_URL, DEFAULT_TIMEOUT } from '@/api/apiConfig';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { safeJsonParse } from '@/utils/safeJsonParse';

export type SubscriptionLinkAction = 'confirm' | 'unsubscribe';
export type SubscriptionLinkResult = 'confirmed' | 'unsubscribed' | 'invalid' | 'error';

const SUCCESS_BY_ACTION: Record<SubscriptionLinkAction, 'confirmed' | 'unsubscribed'> = {
  confirm: 'confirmed',
  unsubscribe: 'unsubscribed',
};

export const resolveSubscriptionLink = async (
  action: SubscriptionLinkAction,
  token: string,
): Promise<SubscriptionLinkResult> => {
  const trimmed = token.trim();
  if (!trimmed) return 'invalid';

  try {
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/subscribe/${action}/${encodeURIComponent(trimmed)}/`,
      {
        method: 'GET',
        // Публичный AllowAny endpoint: cookie и Authorization не нужны и могут
        // увести запрос в CSRF/401-ветку (см. publicPostInit в api/misc.ts).
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      },
      DEFAULT_TIMEOUT,
    );

    if (res.status === 404) return 'invalid';
    if (!res.ok) return 'error';

    const json = await safeJsonParse<{ ok?: boolean }>(res, {});
    return json?.ok === true ? SUCCESS_BY_ACTION[action] : 'error';
  } catch {
    return 'error';
  }
};

export const confirmEmailSubscription = (token: string) => resolveSubscriptionLink('confirm', token);

export const unsubscribeEmailSubscription = (token: string) =>
  resolveSubscriptionLink('unsubscribe', token);
