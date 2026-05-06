// api/apiConfig.ts
// ✅ АРХИТЕКТУРА: Централизованная конфигурация API URL и таймаутов

import { Platform } from 'react-native';
import { resolveApiBaseUrl } from '@/utils/resolveApiBaseUrl';

const isLocalApi = String(process.env.EXPO_PUBLIC_IS_LOCAL_API || '').toLowerCase() === 'true';
export const isE2E = String(process.env.EXPO_PUBLIC_E2E || '').toLowerCase() === 'true';

const rawApiUrl = resolveApiBaseUrl({
    platformOS: Platform.OS,
    envApiUrl: process.env.EXPO_PUBLIC_API_URL,
    nodeEnv: process.env.NODE_ENV,
    isE2E,
    isLocalApi,
    windowOrigin: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.origin : null,
    windowHostname: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.hostname : null,
});

if (!rawApiUrl) {
    throw new Error('EXPO_PUBLIC_API_URL is not defined. Please set this environment variable.');
}
export const API_BASE_URL = rawApiUrl;

export const DEFAULT_TIMEOUT = 10000;
export const LONG_TIMEOUT = 30000;

// Ключи для безопасного хранилища
export const TOKEN_KEY = 'userToken';
export const REFRESH_TOKEN_KEY = 'refreshToken';
