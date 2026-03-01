/**
 * @jest-environment jsdom
 */

import { isValidLazyComponent } from '@/components/travel/details/TravelDetailsLazy';

describe('isValidLazyComponent', () => {
  it('returns true for function components', () => {
    const Comp = () => null;
    expect(isValidLazyComponent(Comp)).toBe(true);
  });

  it('returns true for object-like React wrappers', () => {
    expect(isValidLazyComponent({ $$typeof: Symbol.for('react.memo') })).toBe(true);
  });

  it('returns false for invalid lazy defaults', () => {
    expect(isValidLazyComponent(undefined)).toBe(false);
    expect(isValidLazyComponent(null)).toBe(false);
    expect(isValidLazyComponent('broken')).toBe(false);
    expect(isValidLazyComponent(42)).toBe(false);
  });
});
