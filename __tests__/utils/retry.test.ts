// __tests__/utils/retry.test.ts
import { retry, isRetryableError } from '@/utils/retry';

describe('retry utility', () => {
  describe('isRetryableError', () => {
    it('should identify network errors as retryable', () => {
      const networkError = new Error('network request failed');
      expect(isRetryableError(networkError)).toBe(true);
    });

    it('should identify timeout errors as retryable', () => {
      const timeoutError = new Error('Request timeout');
      expect(isRetryableError(timeoutError)).toBe(true);
    });

    it('should identify fetch errors as retryable', () => {
      const fetchError = new Error('Failed to fetch');
      expect(isRetryableError(fetchError)).toBe(true);
    });

    it('should not retry 4xx errors', () => {
      const clientError = new Error('400 Bad Request');
      expect(isRetryableError(clientError)).toBe(false);
    });

    it('should retry 5xx errors', () => {
      const serverError = new Error('500 Internal Server Error');
      expect(isRetryableError(serverError)).toBe(true);
    });

    it('should not retry authentication errors', () => {
      const authError = new Error('401 Unauthorized');
      expect(isRetryableError(authError)).toBe(false);
    });
  });

  describe('retry function', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await retry(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('network failed'))
        .mockRejectedValueOnce(new Error('network failed'))
        .mockResolvedValueOnce('success');
      
      const result = await retry(fn, { maxAttempts: 3, delay: 10 });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('network failed'));
      
      await expect(retry(fn, { maxAttempts: 2, delay: 10 }))
        .rejects.toThrow('network failed');
      
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should respect custom shouldRetry function', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('custom error'));
      const shouldRetry = jest.fn().mockReturnValue(false);
      
      await expect(retry(fn, { shouldRetry, delay: 10 }))
        .rejects.toThrow('custom error');
      
      expect(fn).toHaveBeenCalledTimes(1);
      expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should apply exponential backoff', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('network failed'))
        .mockResolvedValueOnce('success');
      
      const startTime = Date.now();
      await retry(fn, { maxAttempts: 2, delay: 100 });
      const duration = Date.now() - startTime;
      
      // Should have waited at least the delay time
      expect(duration).toBeGreaterThanOrEqual(90);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('401 Unauthorized'));
      const shouldRetry = (error: Error) => !error.message.includes('401');
      
      await expect(retry(fn, { delay: 10, shouldRetry }))
        .rejects.toThrow('401 Unauthorized');
      
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
