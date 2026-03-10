import { createOptimizedQueryClient } from '@/utils/reactQueryConfig';

describe('createOptimizedQueryClient', () => {
  const originalRequestIdleCallback = (window as any).requestIdleCallback;

  afterEach(() => {
    if (originalRequestIdleCallback === undefined) {
      delete (window as any).requestIdleCallback;
    } else {
      (window as any).requestIdleCallback = originalRequestIdleCallback;
    }
  });

  it('schedules static prefetch by default on web', () => {
    const requestIdleCallback = jest.fn(() => 1);
    (window as any).requestIdleCallback = requestIdleCallback;

    createOptimizedQueryClient();

    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
  });

  it('skips static prefetch when disabled for critical routes', () => {
    const requestIdleCallback = jest.fn(() => 1);
    (window as any).requestIdleCallback = requestIdleCallback;

    createOptimizedQueryClient(undefined, {
      enableStaticPrefetch: false,
    });

    expect(requestIdleCallback).not.toHaveBeenCalled();
  });
});
