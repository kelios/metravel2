export const TEST_API_BASE_URL = 'https://example.test/api';

type ResolveApiBaseUrlOptions = {
  platformOS: string;
  envApiUrl?: string | null;
  nodeEnv?: string | null;
  isE2E?: boolean;
  isLocalApi?: boolean;
  windowOrigin?: string | null;
  windowHostname?: string | null;
};

const SELF_PROXY_PORTS = new Set(['8085', '19006']);

const normalizeString = (value?: string | null): string => String(value || '').trim();

const buildWebOriginApi = (origin?: string | null): string => {
  const trimmed = normalizeString(origin).replace(/\/+$/, '');
  return trimmed ? `${trimmed}/api` : '';
};

export const normalizeApiBaseUrl = (value: string): string => {
  const trimmed = normalizeString(value).replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

export const isLocalWebHostname = (hostname?: string | null): boolean => {
  const host = normalizeString(hostname).toLowerCase();
  return host === 'localhost' || host === '127.0.0.1';
};

export const isLikelySelfProxyApiUrl = (value?: string | null): boolean => {
  const trimmed = normalizeString(value);
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    const host = normalizeString(parsed.hostname).toLowerCase();
    const port = normalizeString(parsed.port);
    return (host === 'localhost' || host === '127.0.0.1' || host === '::1') && SELF_PROXY_PORTS.has(port);
  } catch {
    return false;
  }
};

export const resolveApiBaseUrl = ({
  platformOS,
  envApiUrl,
  nodeEnv,
  isE2E,
  isLocalApi,
  windowOrigin,
  windowHostname,
}: ResolveApiBaseUrlOptions): string => {
  if (normalizeString(nodeEnv) === 'test') {
    return TEST_API_BASE_URL;
  }

  const webOriginApi = platformOS === 'web' ? buildWebOriginApi(windowOrigin) : '';
  const normalizedEnvApiUrl = normalizeString(envApiUrl);

  if (platformOS === 'web') {
    if (isLocalWebHostname(windowHostname) && webOriginApi) {
      return webOriginApi;
    }

    if (isLikelySelfProxyApiUrl(normalizedEnvApiUrl) && webOriginApi) {
      return webOriginApi;
    }

    if ((isE2E || isLocalApi) && webOriginApi) {
      return webOriginApi;
    }
  }

  return normalizedEnvApiUrl ? normalizeApiBaseUrl(normalizedEnvApiUrl) : '';
};
