import * as performanceMonitoring from '@/utils/performance';

describe('performanceMonitoring', () => {
  it('should initialize without errors', () => {
    expect(() => performanceMonitoring.initPerformanceMonitoring()).not.toThrow();
  });
});
