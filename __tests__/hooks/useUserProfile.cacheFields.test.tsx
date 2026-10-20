import { act, renderHook } from '@testing-library/react';
import { queryKeys } from '@/api/queryKeys';
import type { UserProfileDto } from '@/api/user';
import { useUserProfile } from '@/hooks/useUserProfile';
import { createQueryWrapper } from '../helpers/testQueryClient';

const mockSetUserAvatar = jest.fn();

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, userId: '42', setUserAvatar: mockSetUserAvatar }),
}));
jest.mock('@/api/user', () => ({
  fetchUserProfile: jest.fn(() => new Promise(() => undefined)),
  normalizeAvatar: (avatar: unknown) => typeof avatar === 'string' ? avatar : null,
  resolveProfileFullName: () => '',
}));
jest.mock('@/utils/storageBatch', () => ({
  setStorageBatch: jest.fn().mockResolvedValue(undefined),
  removeStorageBatch: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/utils/toast', () => ({ showToast: jest.fn() }));

const profile: UserProfileDto = {
  id: 1,
  user: 42,
  first_name: 'Julia',
  last_name: 'Savran',
  youtube: '',
  instagram: '',
  twitter: '',
  vk: '',
  email_notify_comments: true,
  email_notify_messages: false,
  avatar: null,
  language: 'en',
};

const key = queryKeys.userProfile('42');

describe('profile mutation cache field ownership', () => {
  it.each([
    { fields: ['first_name'] as const, changes: { first_name: 'Updated' } },
    { fields: ['email_notify_messages'] as const, changes: { email_notify_messages: true } },
    { fields: ['avatar'] as const, changes: { avatar: '/media/new-avatar.jpg' } },
  ])('preserves a newer language when only $fields is saved', ({ fields, changes }) => {
    const { queryClient, Wrapper } = createQueryWrapper();
    queryClient.setQueryData(key, profile);
    queryClient.setQueryData(queryKeys.userProfile('43'), { ...profile, user: 43, language: 'be' });
    const { result, unmount } = renderHook(() => useUserProfile(), { wrapper: Wrapper });

    act(() => result.current.setProfile({ ...profile, ...changes, language: 'pl' }, fields));

    expect(queryClient.getQueryData(key)).toEqual({ ...profile, ...changes });
    expect(queryClient.getQueryData(queryKeys.userProfile('43'))).toEqual({ ...profile, user: 43, language: 'be' });
    unmount();
    queryClient.clear();
  });

  it('merges against the latest cache value rather than the value captured on render', () => {
    const { queryClient, Wrapper } = createQueryWrapper();
    queryClient.setQueryData(key, { ...profile, language: 'pl' });
    const { result, unmount } = renderHook(() => useUserProfile(), { wrapper: Wrapper });
    const commit = result.current.setProfile;

    act(() => {
      queryClient.setQueryData(key, { ...profile, instagram: 'new-handle' });
      commit({ ...profile, first_name: 'Updated', language: 'pl', instagram: 'old-handle' }, ['first_name']);
    });

    expect(queryClient.getQueryData(key)).toEqual({ ...profile, first_name: 'Updated', instagram: 'new-handle' });
    unmount();
    queryClient.clear();
  });

  it('retains the existing complete replacement and null clearing contract without a mask', () => {
    const { queryClient, Wrapper } = createQueryWrapper();
    queryClient.setQueryData(key, profile);
    const { result, unmount } = renderHook(() => useUserProfile(), { wrapper: Wrapper });
    const replacement = { ...profile, first_name: 'Replacement', language: 'pl' as const };

    act(() => result.current.setProfile(replacement));
    expect(queryClient.getQueryData(key)).toEqual(replacement);
    act(() => result.current.setProfile(null));
    expect(queryClient.getQueryData(key)).toBeNull();
    unmount();
    queryClient.clear();
  });

  it('uses the complete saved DTO when there is no current cache entry', () => {
    const { queryClient, Wrapper } = createQueryWrapper();
    const { result, unmount } = renderHook(() => useUserProfile(), { wrapper: Wrapper });

    act(() => result.current.setProfile(profile, ['avatar']));

    expect(queryClient.getQueryData(key)).toEqual(profile);
    unmount();
    queryClient.clear();
  });
});
