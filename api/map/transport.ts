import { fetchPublicWithSession } from '@/api/publicFetchWithSession';
import { resolveApiBaseUrl } from '@/utils/resolveApiBaseUrl';
import { Platform } from 'react-native';

const isLocalApi = String(process.env.EXPO_PUBLIC_IS_LOCAL_API || '').toLowerCase() === 'true';
const isE2E = String(process.env.EXPO_PUBLIC_E2E || '').toLowerCase() === 'true';
const rawApiUrl = resolveApiBaseUrl({
  platformOS: Platform.OS,
  envApiUrl: process.env.EXPO_PUBLIC_API_URL,
  prodApiUrl: process.env.PROD_API_URL,
  nodeEnv: process.env.NODE_ENV,
  isE2E,
  isLocalApi,
  windowOrigin: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.origin : null,
  windowHostname: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.hostname : null,
});
if (!rawApiUrl) {
  throw new Error('EXPO_PUBLIC_API_URL is not defined. Please set this environment variable.');
}
const URLAPI = rawApiUrl;

export const DEFAULT_TIMEOUT = 10000; // 10 секунд
export const LONG_TIMEOUT = 30000; // 30 секунд для тяжелых запросов
const TRANSIENT_HTTP_STATUSES = new Set([502, 503, 504]);
const MAP_FETCH_RETRY_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 350;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// #2165: гео-выдача и ленты путешествий читаются с сессией — бэк режет в них
// заблокированных авторов по тому, кто спрашивает (#2164). Справочник фильтров
// (`filterformap`) авторского контента не содержит и остаётся анонимным.
export const fetchWithTransientRetry = async (
  url: string,
  init: RequestInit,
  timeoutMs: number,
  retries: number = 1
) => {
  let attempt = 0;
  while (true) {
    const response = await fetchPublicWithSession(url, init, timeoutMs);
    const shouldRetry =
      attempt < retries && !response.ok && TRANSIENT_HTTP_STATUSES.has(response.status);
    if (!shouldRetry) return response;

    attempt += 1;
    if (MAP_FETCH_RETRY_DELAY_MS > 0) {
      await wait(MAP_FETCH_RETRY_DELAY_MS);
    }
  }
};

// Для запросов с query (?...) оставляем базу без завершающего слеша, для остальных — со слешем.
export const SEARCH_TRAVELS_FOR_MAP = `${URLAPI}/travels/search_travels_for_map/`; // далее добавляется ?...
export const SEARCH_TRAVELS_FOR_MAP_LITE = `${URLAPI}/travels/search_travels_for_map_lite/`;
export const GET_MAP_CLUSTERS = `${URLAPI}/map/clusters/`; // серверная кластеризация, BE #719: ?bbox=south,west,north,east&zoom=
// Ленивая коллекция материалов места (#1567): короткие summary с cursor-пагинацией.
export const getMapPlaceSourcesUrl = (placeId: string | number) =>
  `${URLAPI}/map/places/${encodeURIComponent(String(placeId))}/sources/`;
export const GET_FILTER_FOR_MAP = `${URLAPI}/filterformap/`;
export const GET_TRAVELS = `${URLAPI}/travels/`;
export const GET_TRAVELS_OF_MONTH = `${URLAPI}/travels/of-month/`;
export const GET_TRAVELS_RANDOM = `${URLAPI}/travels/random/`;
export const SEARCH_TRAVELS_NEAR_ROUTE = `${URLAPI}/travels/near-route/`;

export const withOptionalLimit = (url: string, limit?: number): string => {
  if (!Number.isFinite(limit) || !limit || limit <= 0) return url;
  const separator = url.includes('?') ? '&' : '?';
  const perPage = Math.max(1, Math.floor(limit));
  return `${url}${separator}page=1&perPage=${perPage}`;
};
