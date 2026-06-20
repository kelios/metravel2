import { apiClient, ApiError } from '@/api/client';
import type { ConsentType } from '@/utils/actionConsent';

/**
 * Consent-tracking API (Sprint 17 — Legal & Informed Consent, BE #435).
 *
 * Бэкенд хранит факт принятия согласия: (user, consent_type, version, accepted_at).
 * POST идемпотентен — повторное принятие того же (type, version) не дублируется.
 *
 * Локальное хранилище (utils/actionConsent.ts) остаётся источником правды для UX
 * (мгновенный отклик, работа без сети). Серверная запись — для аудита и кросс-
 * девайс. Поэтому здесь всё graceful: ошибки (401 без логина, 404/501 пока эндпоинт
 * не задеплоен, offline) проглатываются и НЕ ломают пользовательский сценарий.
 *
 * NOTE: apiClient.baseURL уже содержит `/api`, поэтому путь без `/api`.
 */

const isExpectedConsentError = (error: unknown): boolean =>
  error instanceof ApiError &&
  (error.status === 401 || error.status === 403 || error.status === 404 || error.status === 501 || error.status === 0);

/**
 * Зафиксировать факт согласия на сервере. Никогда не бросает — при любой ошибке
 * (нет логина, эндпоинт ещё не задеплоен, offline) тихо завершается: локальная
 * запись уже сделана вызывающей стороной.
 */
export const postConsentRecord = async (
  consentType: ConsentType,
  version = '1',
): Promise<void> => {
  try {
    await apiClient.post('/user/consents/', { consent_type: consentType, version });
  } catch (error) {
    if (isExpectedConsentError(error)) return;
    // Непредвиденную ошибку тоже не пробрасываем — трекинг не должен ломать flow.
  }
};
