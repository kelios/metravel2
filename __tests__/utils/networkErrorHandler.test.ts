// __tests__/utils/networkErrorHandler.test.ts
import { Platform } from 'react-native';
import { showToast } from '@/src/utils/toast';
import { 
  handleNetworkError, 
  isNetworkError,
  isAuthError,
  isServerError,
  getUserFriendlyNetworkError,
  withNetworkErrorHandler
} from '@/src/utils/networkErrorHandler';
import { ApiError } from '@/src/api/client';

jest.mock('@/src/utils/toast', () => ({
  __esModule: true,
  showToast: jest.fn(),
}));

describe('networkErrorHandler', () => {
  const originalPlatformOS = Platform.OS;
  const originalNavigator = (globalThis as any).navigator;
  const originalWindow = (globalThis as any).window;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    ;(globalThis as any).window = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    } as any;

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        onLine: true,
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatformOS,
    });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    });
    ;(globalThis as any).window = originalWindow as any;
  });

  describe('isNetworkError', () => {
    it('should identify network errors', () => {
      const networkError = new Error('Network request failed');
      expect(isNetworkError(networkError)).toBe(true);
    });

    it('should identify timeout errors', () => {
      const timeoutError = new Error('Request timeout');
      expect(isNetworkError(timeoutError)).toBe(true);
    });

    it('should identify fetch errors', () => {
      const fetchError = new Error('Failed to fetch');
      expect(isNetworkError(fetchError)).toBe(true);
    });

    it('should identify ApiError with status 0', () => {
      const apiError = new ApiError(0, 'Network error', { offline: true });
      expect(isNetworkError(apiError)).toBe(true);
    });

    it('should not identify non-network errors', () => {
      const validationError = new Error('Validation failed');
      expect(isNetworkError(validationError)).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(isNetworkError(null)).toBe(false);
      expect(isNetworkError(undefined)).toBe(false);
    });

    it('detects offline state via navigator.onLine on web', () => {
      delete (globalThis as any).navigator;
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: {
          onLine: false,
        },
      });
      expect(isNetworkError(new Error('Some error'))).toBe(true);
    });
  });

  describe('isAuthError', () => {
    it('should identify 401 errors', () => {
      const authError = new ApiError(401, 'Unauthorized');
      expect(isAuthError(authError)).toBe(true);
    });

    it('should identify 403 errors', () => {
      const forbiddenError = new ApiError(403, 'Forbidden');
      expect(isAuthError(forbiddenError)).toBe(true);
    });

    it('should identify auth errors by message', () => {
      const error = new Error('unauthorized');
      expect(isAuthError(error)).toBe(true);
    });

    it('should not identify non-auth errors', () => {
      const error = new Error('Network failed');
      expect(isAuthError(error)).toBe(false);
    });
  });

  describe('isServerError', () => {
    it('should identify 5xx errors', () => {
      const serverError = new ApiError(500, 'Internal Server Error');
      expect(isServerError(serverError)).toBe(true);
    });

    it('should identify 503 errors', () => {
      const unavailableError = new ApiError(503, 'Service Unavailable');
      expect(isServerError(unavailableError)).toBe(true);
    });

    it('should not identify 4xx errors as server errors', () => {
      const clientError = new ApiError(404, 'Not Found');
      expect(isServerError(clientError)).toBe(false);
    });
  });

  describe('getUserFriendlyNetworkError', () => {
    it('should return user-friendly message for network errors', () => {
      const error = new Error('Network request failed');
      const message = getUserFriendlyNetworkError(error);
      
      expect(message).toMatch(/подключ|интернет/i);
    });

    it('should return specific message for 401', () => {
      const error = new ApiError(401, 'Unauthorized');
      const message = getUserFriendlyNetworkError(error);
      
      expect(message).toMatch(/авториза|войдите/i);
    });

    it('should return specific message for 403', () => {
      const error = new ApiError(403, 'Forbidden');
      const message = getUserFriendlyNetworkError(error);
      
      expect(message).toContain('Доступ запрещен');
    });

    it('should return specific message for 404', () => {
      const error = new ApiError(404, 'Not Found');
      const message = getUserFriendlyNetworkError(error);
      
      expect(message).toContain('не найден');
    });

    it('should return specific message for 5xx', () => {
      const error = new ApiError(500, 'Server Error');
      const message = getUserFriendlyNetworkError(error);
      
      expect(message).toContain('сервера');
    });

    it('should handle null error', () => {
      const message = getUserFriendlyNetworkError(null);
      expect(message).toBeTruthy();
    });

    it('falls back to original message for ApiError with non-special status', () => {
      const error = new ApiError(418, 'I am a teapot');
      expect(getUserFriendlyNetworkError(error)).toContain('teapot');
    });
  });

  describe('handleNetworkError', () => {
    it('should handle network error without throwing', () => {
      const error = new Error('Network failed');
      expect(() => handleNetworkError(error)).not.toThrow();
    });

    it('should respect silent option', () => {
      const error = new Error('Network failed');
      expect(() => handleNetworkError(error, { silent: true })).not.toThrow();
      expect(showToast).not.toHaveBeenCalled();
    });

    it('should call onRetry for network errors', () => {
      const error = new Error('network failed');
      const onRetry = jest.fn();
      
      // handleNetworkError sets up event listener but doesn't call onRetry immediately
      expect(() => handleNetworkError(error, { onRetry })).not.toThrow();
    });

    it('shows toast on web for network errors when showToast is true', () => {
      const error = new Error('Network request failed');
      handleNetworkError(error);

      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text1: 'Нет подключения',
        })
      );
    });

    it('does not show toast when showToast is false', () => {
      const error = new Error('Network request failed');
      handleNetworkError(error, { showToast: false });
      expect(showToast).not.toHaveBeenCalled();
    });

    it('registers online listener and calls onRetry when online event fires', () => {
      const error = new Error('Network request failed');
      const onRetry = jest.fn();

      handleNetworkError(error, { onRetry });

      const add = (global.window as any).addEventListener as jest.Mock;
      expect(add).toHaveBeenCalledWith('online', expect.any(Function));

      const handler = add.mock.calls.find((c: any[]) => c[0] === 'online')?.[1];
      expect(typeof handler).toBe('function');

      handler();
      expect((global.window as any).removeEventListener).toHaveBeenCalledWith('online', handler);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('withNetworkErrorHandler', () => {
    it('should return result on success', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await withNetworkErrorHandler(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalled();
    });

    it('should return null on error', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Failed'));
      const result = await withNetworkErrorHandler(fn, { silent: true });
      
      expect(result).toBeNull();
    });

    it('should call onError callback', async () => {
      const error = new Error('Failed');
      const fn = jest.fn().mockRejectedValue(error);
      const onError = jest.fn();
      
      await withNetworkErrorHandler(fn, { onError, silent: true });
      
      expect(onError).toHaveBeenCalledWith(error);
    });
  });
});
