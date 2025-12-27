import * as performanceMonitoring from '@/src/utils/performanceMonitoring';

describe('performanceMonitoring', () => {
  it('should initialize without errors', () => {
    expect(() => performanceMonitoring.init()).not.toThrow();
  });
});
