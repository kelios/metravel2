// api/apiConfig.ts
// ✅ АРХИТЕКТУРА: Централизованная конфигурация API URL и таймаутов

import { Platform } from 'react-native';

const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
const isLocalApi = String(process.env.EXPO_PUBLIC_IS_LOCAL_API || '').toLowerCase() === 'true';
export const isE2E = String(process.env.EXPO_PUBLIC_E2E || '').toLowerCase() === 'true';

const webOriginApi =
    Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
        ? `${window.location.origin}/api`
        : '';

const isWebLocalHost =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof window.location?.hostname === 'string' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const rawApiUrl: string =
    Platform.OS === 'web'
        ? ((isE2E || isLocalApi) && isWebLocalHost && webOriginApi ? webOriginApi : (envApiUrl || ''))
        : (envApiUrl || (process.env.NODE_ENV === 'test' ? 'https://example.test/api' : ''));

if (!rawApiUrl) {
    throw new Error('EXPO_PUBLIC_API_URL is not defined. Please set this environment variable.');
}

// Нормализуем: чтобы всегда был суффикс /api и не было двойных слэшей
export const API_BASE_URL = (() => {
    const trimmed = rawApiUrl.replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
})();

export const DEFAULT_TIMEOUT = 10000;
export const LONG_TIMEOUT = 30000;

// Ключи для безопасного хранилища
export const TOKEN_KEY = 'userToken';
export const REFRESH_TOKEN_KEY = 'refreshToken';
