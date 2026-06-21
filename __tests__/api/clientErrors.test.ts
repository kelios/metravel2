import { isOfflineLikeError } from '@/api/clientErrors';
import { Platform } from 'react-native';

const originalPlatformOS = Platform.OS;

Object.defineProperty(global, 'navigator', {
  value: { onLine: true },
  writable: true,
});

describe('isOfflineLikeError', () => {
  beforeEach(() => {
    Platform.OS = 'web' as typeof Platform.OS;
    (navigator as any).onLine = true;
  });

  afterAll(() => {
    Platform.OS = originalPlatformOS;
  });

  it('реальный обрыв сети классифицируется как offline', () => {
    expect(isOfflineLikeError(new Error('Failed to fetch'))).toBe(true);
    expect(isOfflineLikeError(new Error('Network request failed'))).toBe(true);
    expect(isOfflineLikeError(new Error('network failed'))).toBe(true);
  });

  it('navigator.onLine=false на web — offline', () => {
    (navigator as any).onLine = false;
    expect(isOfflineLikeError(new Error('что угодно'))).toBe(true);
  });

  it('отменённый/прерванный запрос НЕ offline (иначе ложное «нет интернета»)', () => {
    expect(isOfflineLikeError(new Error('fetch failed: Fetch request has been canceled'))).toBe(false);
    expect(isOfflineLikeError(new Error('The operation was aborted'))).toBe(false);
    expect(isOfflineLikeError(new Error('Request was cancelled'))).toBe(false);
  });

  it('серверный таймаут/5xx НЕ классифицируется как offline', () => {
    expect(isOfflineLikeError(new Error('Request timeout'))).toBe(false);
    expect(isOfflineLikeError(new Error('Internal Server Error'))).toBe(false);
  });
});
