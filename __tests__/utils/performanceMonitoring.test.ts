import * as performanceMonitoring from '@/utils/performanceMonitoring';

describe('performanceMonitoring', () => {
  it('should initialize without errors', () => {
    expect(() => performanceMonitoring.initPerformanceMonitoring()).not.toThrow();
  });
});
