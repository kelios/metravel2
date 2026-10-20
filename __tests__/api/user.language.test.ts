import { apiClient } from '@/api/client';
import { fetchUserProfile, updateUserProfile, type UserProfileDto } from '@/api/user';
import type { SupportedLocale } from '@/i18n/config';

jest.mock('@/api/client', () => ({ apiClient: { get: jest.fn(), put: jest.fn() } }));
jest.mock('@/api/achievements', () => ({ mapRank: jest.fn() }));

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
};

const getProfile = jest.mocked(apiClient.get);
const putProfile = jest.mocked(apiClient.put);

beforeEach(() => jest.clearAllMocks());

describe('owner profile language contract', () => {
  it.each<SupportedLocale>(['ru', 'be', 'uk', 'pl', 'en'])(
    'preserves %s through profile GET and owner PUT',
    async (language) => {
      getProfile.mockResolvedValueOnce({ ...profile, language });
      putProfile.mockResolvedValueOnce({ ...profile, language });

      expect(await fetchUserProfile('42')).toEqual({ ...profile, language });
      expect(await updateUserProfile('42', { language })).toEqual({ ...profile, language });
      expect(getProfile).toHaveBeenCalledWith('/user/42/profile/', expect.any(Number));
      expect(putProfile).toHaveBeenCalledWith('/user/42/profile/update/', { language });
    },
  );

  it('preserves explicit null without converting it to a fallback language', async () => {
    getProfile.mockResolvedValueOnce({ ...profile, language: null });
    putProfile.mockResolvedValueOnce({ ...profile, language: null });

    expect((await fetchUserProfile(42)).language).toBeNull();
    expect((await updateUserProfile(42, { language: null })).language).toBeNull();
    expect(putProfile).toHaveBeenCalledWith('/user/42/profile/update/', { language: null });
  });

  it('does not invent language for an older profile response or an unrelated update', async () => {
    getProfile.mockResolvedValueOnce(profile);
    putProfile.mockResolvedValueOnce({ ...profile, first_name: 'Updated' });

    expect(await fetchUserProfile(42)).not.toHaveProperty('language');
    expect(await updateUserProfile(42, { first_name: 'Updated' })).not.toHaveProperty('language');
    expect(putProfile).toHaveBeenCalledWith('/user/42/profile/update/', { first_name: 'Updated' });
  });
});
