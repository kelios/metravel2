import * as performanceUtils from '@/utils/performance';

describe('performanceMonitoring', () => {
  it('performance utils module loads without errors', () => {
    expect(performanceUtils).toBeDefined();
  });
});
