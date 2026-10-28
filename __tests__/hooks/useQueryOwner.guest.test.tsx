import { renderHook } from '@testing-library/react-native';
import { useQueryOwner } from '@/hooks/useQueryOwner';

let mockIdentity = { isAuthenticated: false, userId: 'stale-owner' as string | null };
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (select: (state: typeof mockIdentity) => unknown) => select(mockIdentity),
}));

it('excludes a known guest even if an old owner ID is present', async () => {
  mockIdentity = { isAuthenticated: false, userId: 'stale-owner' };
  const { result, rerender } = await renderHook(() => useQueryOwner());
  expect(result.current).toBeNull();
  mockIdentity = { isAuthenticated: true, userId: 'current-owner' };
  await rerender({});
  expect(result.current).toBe('current-owner');
  mockIdentity = { isAuthenticated: false, userId: null };
  await rerender({});
  expect(result.current).toBeNull();
});
