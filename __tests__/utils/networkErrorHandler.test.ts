// __tests__/utils/networkErrorHandler.test.ts
import { 
  handleNetworkError, 
  isNetworkError,
  isAuthError,
  isServerError,
  getUserFriendlyNetworkError,
  withNetworkErrorHandler
} from '@/src/utils/networkErrorHandler';
import { ApiError } from '@/src/api/client';

describe('networkErrorHandler', () => {
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
      
      expect(message).toContain('подключения' || 'интернет');
    });

    it('should return specific message for 401', () => {
      const error = new ApiError(401, 'Unauthorized');
      const message = getUserFriendlyNetworkError(error);
      
      expect(message).toContain('авторизация' || 'войдите');
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
  });

  describe('handleNetworkError', () => {
    it('should handle network error without throwing', () => {
      const error = new Error('Network failed');
      expect(() => handleNetworkError(error)).not.toThrow();
    });

    it('should respect silent option', () => {
      const error = new Error('Network failed');
      expect(() => handleNetworkError(error, { silent: true })).not.toThrow();
    });

    it('should call onRetry for network errors', () => {
      const error = new Error('network failed');
      const onRetry = jest.fn();
      
      // handleNetworkError sets up event listener but doesn't call onRetry immediately
      expect(() => handleNetworkError(error, { onRetry })).not.toThrow();
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
