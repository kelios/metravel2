// __tests__/services/performanceMonitoring.test.ts
// AND-25: Tests for performance monitoring service

describe('performanceMonitoring', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  });

  it('initPerformanceMonitoring is no-op when DSN not set', () => {
    const { initPerformanceMonitoring } = require('@/services/performanceMonitoring');
    // Should not throw
    expect(() => initPerformanceMonitoring()).not.toThrow();
  });

  it('captureException is no-op when not initialized with DSN', () => {
    const { captureException, initPerformanceMonitoring } = require('@/services/performanceMonitoring');
    initPerformanceMonitoring();
    // Should not throw
    expect(() => captureException(new Error('test'))).not.toThrow();
  });

  it('setUser is no-op when not initialized with DSN', () => {
    const { setUser, initPerformanceMonitoring } = require('@/services/performanceMonitoring');
    initPerformanceMonitoring();
    expect(() => setUser({ id: '123', email: 'test@test.com' })).not.toThrow();
  });

  it('startTransaction returns stub handle when not initialized', () => {
    const { startTransaction, initPerformanceMonitoring } = require('@/services/performanceMonitoring');
    initPerformanceMonitoring();
    const tx = startTransaction('test', 'navigation');
    expect(tx).toBeDefined();
    expect(typeof tx.finish).toBe('function');
    expect(typeof tx.setTag).toBe('function');
    expect(typeof tx.setData).toBe('function');
    // Should not throw
    tx.finish();
    tx.setTag('key', 'value');
    tx.setData('key', { foo: 'bar' });
  });

  it('addBreadcrumb is no-op when not initialized', () => {
    const { addBreadcrumb, initPerformanceMonitoring } = require('@/services/performanceMonitoring');
    initPerformanceMonitoring();
    expect(() => addBreadcrumb('navigation', 'test')).not.toThrow();
  });
});

