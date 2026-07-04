import {
  TEST_API_BASE_URL,
  isLoopbackApiUrl,
  isLikelySelfProxyApiUrl,
  normalizeApiBaseUrl,
  resolveApiBaseUrl,
} from '@/utils/resolveApiBaseUrl';

describe('resolveApiBaseUrl', () => {
  it('keeps configured backend on localhost web dev', () => {
    expect(
      resolveApiBaseUrl({
        platformOS: 'web',
        envApiUrl: 'https://metravel.by',
        windowOrigin: 'http://127.0.0.1:8081',
        windowHostname: '127.0.0.1',
      })
    ).toBe('https://metravel.by/api');
  });

  it('falls back to prod api on localhost web dev when env leaked Expo self-proxy url', () => {
    expect(
      resolveApiBaseUrl({
        platformOS: 'web',
        envApiUrl: 'http://127.0.0.1:8081',
        prodApiUrl: 'https://metravel.by',
        windowOrigin: 'http://127.0.0.1:8081',
        windowHostname: '127.0.0.1',
      })
    ).toBe('https://metravel.by/api');
  });

  it('falls back to current site api when env leaked self-proxy url on production web', () => {
    expect(
      resolveApiBaseUrl({
        platformOS: 'web',
        envApiUrl: 'http://127.0.0.1:8085',
        windowOrigin: 'https://metravel.by',
        windowHostname: 'metravel.by',
      })
    ).toBe('https://metravel.by/api');
  });

  it('keeps canonical env api url on production web', () => {
    expect(
      resolveApiBaseUrl({
        platformOS: 'web',
        envApiUrl: 'https://metravel.by',
        windowOrigin: 'https://metravel.by',
        windowHostname: 'metravel.by',
      })
    ).toBe('https://metravel.by/api');
  });

  it('falls back to prod api on native when env leaked Expo self-proxy url', () => {
    expect(
      resolveApiBaseUrl({
        platformOS: 'android',
        envApiUrl: 'http://127.0.0.1:8085',
        prodApiUrl: 'https://metravel.by',
        isLocalApi: false,
      })
    ).toBe('https://metravel.by/api');
  });

  it('falls back to prod api on native when env leaked any loopback dev proxy url', () => {
    expect(
      resolveApiBaseUrl({
        platformOS: 'android',
        envApiUrl: 'http://127.0.0.1:8086',
        prodApiUrl: 'https://metravel.by',
        isLocalApi: false,
      })
    ).toBe('https://metravel.by/api');
  });

  it('uses the canonical prod fallback on native self-proxy url when prod env is not public', () => {
    expect(
      resolveApiBaseUrl({
        platformOS: 'android',
        envApiUrl: 'http://127.0.0.1:8085',
        isLocalApi: false,
      })
    ).toBe('https://metravel.by/api');
  });

  it('keeps explicit local native api url when local api mode is enabled', () => {
    expect(
      resolveApiBaseUrl({
        platformOS: 'android',
        envApiUrl: 'http://127.0.0.1:8085',
        prodApiUrl: 'https://metravel.by',
        isLocalApi: true,
      })
    ).toBe('http://127.0.0.1:8085/api');

    expect(
      resolveApiBaseUrl({
        platformOS: 'android',
        envApiUrl: 'http://127.0.0.1:8086',
        prodApiUrl: 'https://metravel.by',
        isLocalApi: true,
      })
    ).toBe('http://127.0.0.1:8086/api');
  });

  it('uses web origin for e2e and local api flows', () => {
    expect(
      resolveApiBaseUrl({
        platformOS: 'web',
        envApiUrl: 'https://metravel.by',
        isE2E: true,
        windowOrigin: 'http://127.0.0.1:8085',
        windowHostname: 'metravel.by',
      })
    ).toBe('http://127.0.0.1:8085/api');

    expect(
      resolveApiBaseUrl({
        platformOS: 'web',
        envApiUrl: 'https://metravel.by',
        isLocalApi: true,
        windowOrigin: 'http://192.168.50.10:3000',
        windowHostname: '192.168.50.10',
      })
    ).toBe('http://192.168.50.10:3000/api');
  });

  it('uses test api base in test env', () => {
    expect(
      resolveApiBaseUrl({
        platformOS: 'ios',
        nodeEnv: 'test',
      })
    ).toBe(TEST_API_BASE_URL);
  });
});

describe('resolveApiBaseUrl helpers', () => {
  it('normalizes api base url suffix', () => {
    expect(normalizeApiBaseUrl('https://metravel.by/')).toBe('https://metravel.by/api');
    expect(normalizeApiBaseUrl('https://metravel.by/api/')).toBe('https://metravel.by/api');
  });

  it('detects expo self-proxy urls', () => {
    expect(isLikelySelfProxyApiUrl('http://127.0.0.1:8081/api')).toBe(true);
    expect(isLikelySelfProxyApiUrl('http://localhost:8082')).toBe(true);
    expect(isLikelySelfProxyApiUrl('http://127.0.0.1:8085')).toBe(true);
    expect(isLikelySelfProxyApiUrl('http://localhost:19006/api')).toBe(true);
    expect(isLikelySelfProxyApiUrl('https://metravel.by')).toBe(false);
  });

  it('detects loopback api urls separately from known self-proxy ports', () => {
    expect(isLoopbackApiUrl('http://127.0.0.1:8086')).toBe(true);
    expect(isLoopbackApiUrl('http://localhost:8000/api')).toBe(true);
    expect(isLoopbackApiUrl('https://metravel.by/api')).toBe(false);
  });
});
