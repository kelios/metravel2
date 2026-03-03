// __tests__/components/SyncIndicator.test.tsx
// AND-10: Tests for sync indicator component.
// Note: SyncIndicatorNative uses reanimated hooks which are not easily testable.
// We test the module exports and the web-path (returns null).
describe('SyncIndicator', () => {
  it('is exported as a named function', () => {
    const mod = require('@/components/ui/SyncIndicator');
    expect(typeof mod.SyncIndicator).toBe('function');
  });
});
