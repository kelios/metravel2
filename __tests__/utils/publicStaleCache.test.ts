import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { ApiError } from '@/api/client';
import {
  getPublicStalePayloadMeta,
  isCacheablePublicGet,
  isRecoverablePublicStaleError,
  markPublicStalePayload,
  normalizePublicStaleEndpoint,
  readPublicStalePayload,
  savePublicStalePayload,
} from '@/utils/publicStaleCache';

describe('publicStaleCache', () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(async () => {
    await AsyncStorage.clear();
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatformOS,
    });
  });

  it('normalizes query params so equivalent endpoints share one key', () => {
    expect(normalizePublicStaleEndpoint('https://api.example.test/travels/?b=2&a=1')).toBe('/travels/?a=1&b=2');
    expect(normalizePublicStaleEndpoint('/travels/?query=%D0%BC%D0%B8%D0%BD%D1%81%D0%BA&page=0')).toBe('/travels/?page=0&query=%D0%BC%D0%B8%D0%BD%D1%81%D0%BA');
  });

  it('saves and reads a native public payload with stale metadata', async () => {
    const payload = { data: [{ id: 1, name: 'Cached route' }], total: 1 };

    await savePublicStalePayload('/travels/?page=0&query=cache', payload);

    const cached = await readPublicStalePayload<typeof payload>('/travels/?query=cache&page=0');
    expect(cached).toEqual(payload);
    expect(getPublicStalePayloadMeta(cached)).toEqual(expect.objectContaining({
      sourceEndpoint: '/travels/?page=0&query=cache',
    }));
  });

  it('does not cache web or Authorization responses', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    await savePublicStalePayload('/travels/?page=0', { data: [], total: 0 });
    expect(await readPublicStalePayload('/travels/?page=0')).toBeNull();

    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });

    expect(isCacheablePublicGet('/travels/', {
      headers: { Authorization: 'Token secret' },
    })).toBe(false);
  });

  it('recovers only network and 5xx failures', () => {
    expect(isRecoverablePublicStaleError(new ApiError(0, 'offline'))).toBe(true);
    expect(isRecoverablePublicStaleError(new ApiError(503, 'unavailable'))).toBe(true);
    expect(isRecoverablePublicStaleError(new Error('Network request failed'))).toBe(true);
    expect(isRecoverablePublicStaleError(new ApiError(404, 'missing'))).toBe(false);
    expect(isRecoverablePublicStaleError(new ApiError(401, 'auth'))).toBe(false);
    expect(isRecoverablePublicStaleError(new DOMException('Aborted', 'AbortError'))).toBe(false);
  });

  it('attaches stale metadata as non-enumerable payload state', () => {
    const payload = { data: [] };
    const marked = markPublicStalePayload(payload, {
      savedAt: '2026-06-25T10:00:00.000Z',
      sourceEndpoint: '/travels/',
    });

    expect(getPublicStalePayloadMeta(marked)).toEqual({
      savedAt: '2026-06-25T10:00:00.000Z',
      sourceEndpoint: '/travels/',
    });
    expect(JSON.stringify(marked)).toBe('{"data":[]}');
  });
});
