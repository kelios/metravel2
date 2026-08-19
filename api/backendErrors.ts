// api/backendErrors.ts
// DRF отдаёт дефолтные сообщения валидации и троттлинга только по-английски:
// `{"email":["Enter a valid email address."]}`, `{"detail":"Request was
// throttled..."}`. Показывать их как есть нельзя — RU/BE/UK/PL-пользователь
// видит английский текст. Здесь известные сообщения бэкенда переводятся в наши
// ключи; всё остальное пробрасывается без изменений, чтобы новые серверные
// формулировки не проглатывались в пустоту.

import { translate as i18nT } from '@/i18n';
import type { TranslationKey } from '@/i18n/resources';

// Ключ ищется по нормализованному (lowercase) тексту: точное совпадение с
// дефолтами DRF, без эвристик по подстрокам — иначе своя формулировка бэкенда
// молча подменяется чужим смыслом.
const EXACT_MESSAGE_KEYS: Record<string, TranslationKey> = {
  // rest_framework.fields.EmailField.default_error_messages
  'enter a valid email address.': 'errorsStatic:api.backendErrors.invalidEmail',
  // rest_framework.fields.Field / CharField.default_error_messages
  'this field is required.': 'errorsStatic:api.backendErrors.fieldRequired',
  'this field may not be blank.': 'errorsStatic:api.backendErrors.fieldRequired',
  'this field may not be null.': 'errorsStatic:api.backendErrors.fieldRequired',
};

// Единственное сообщение с переменной частью, которое реально доходит до
// пользователя: ScopedRateThrottle подставляет в него оставшиеся секунды
// ("Request was throttled. Expected available in 42 seconds."), поэтому точным
// совпадением его не поймать.
const THROTTLED_PREFIX = 'request was throttled';

const firstMessage = (value: unknown): string | undefined => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed || undefined;
};

/**
 * Первое сообщение полевой ошибки DRF (`{field: ["..."]}` или `{field: "..."}`)
 * в локали пользователя. Незнакомое сообщение возвращается как есть,
 * отсутствующее/пустое — `undefined`, чтобы вызывающий код пошёл дальше по цепочке.
 */
export const localizeBackendFieldError = (value: unknown): string | undefined => {
  const message = firstMessage(value);
  if (!message) return undefined;

  const normalized = message.toLowerCase();
  if (normalized.startsWith(THROTTLED_PREFIX)) {
    return i18nT('errorsStatic:api.misc.tooManyAttempts');
  }

  const key = EXACT_MESSAGE_KEYS[normalized];
  return key ? i18nT(key) : message;
};
