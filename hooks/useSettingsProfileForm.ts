import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  normalizeAvatar,
  updateUserProfile,
  type UpdateUserProfilePayload,
} from '@/api/user';
import { ApiError } from '@/api/client';
import { showToast } from '@/utils/toast';
import type { useUserProfile } from '@/hooks/useUserProfile';

type UserProfile = ReturnType<typeof useUserProfile>['profile'];

interface UseSettingsProfileFormArgs {
  userId?: string | null;
  username?: string | null;
  profile: UserProfile;
  setProfile: (next: UserProfile) => void;
  setAvatarPreviewUrl: (url: string) => void;
}

export function useSettingsProfileForm({
  userId,
  username,
  profile,
  setProfile,
  setAvatarPreviewUrl,
}: UseSettingsProfileFormArgs) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [youtube, setYoutube] = useState('');
  const [instagram, setInstagram] = useState('');
  const [twitter, setTwitter] = useState('');
  const [vk, setVk] = useState('');
  const [emailNotifyComments, setEmailNotifyComments] = useState(false);
  const [emailNotifyMessages, setEmailNotifyMessages] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFirstName(normalizeAvatar(profile.first_name) ?? '');
    setLastName(normalizeAvatar(profile.last_name) ?? '');
    setYoutube(profile.youtube || '');
    setInstagram(profile.instagram || '');
    setTwitter(profile.twitter || '');
    setVk(profile.vk || '');
    setEmailNotifyComments(Boolean(profile.email_notify_comments));
    setEmailNotifyMessages(Boolean(profile.email_notify_messages));
    setAvatarPreviewUrl(profile.avatar || '');
  }, [profile, setAvatarPreviewUrl]);

  const derivedDisplayName = useMemo(() => {
    const first = normalizeAvatar(firstName) ?? '';
    const last = normalizeAvatar(lastName) ?? '';
    const full = `${first} ${last}`.trim();
    return full || username || 'Пользователь';
  }, [firstName, lastName, username]);

  const hasUnsavedChanges = useMemo(() => {
    if (!profile) return false;
    const norm = (v: unknown) => String(v ?? '').trim();
    return (
      norm(firstName) !== norm(profile.first_name) ||
      norm(lastName) !== norm(profile.last_name) ||
      norm(youtube) !== norm(profile.youtube) ||
      norm(instagram) !== norm(profile.instagram) ||
      norm(twitter) !== norm(profile.twitter) ||
      norm(vk) !== norm(profile.vk) ||
      emailNotifyComments !== Boolean(profile.email_notify_comments) ||
      emailNotifyMessages !== Boolean(profile.email_notify_messages)
    );
  }, [emailNotifyComments, emailNotifyMessages, firstName, instagram, lastName, profile, twitter, vk, youtube]);

  const saveProfile = useCallback(async () => {
    if (!userId) return;
    setProfileSaving(true);
    try {
      const payload: UpdateUserProfilePayload = {
        first_name: firstName,
        last_name: lastName,
        youtube,
        instagram,
        twitter,
        vk,
        email_notify_comments: emailNotifyComments,
        email_notify_messages: emailNotifyMessages,
      };
      const saved = await updateUserProfile(userId, payload);
      setProfile(saved);
      showToast({ type: 'success', text1: 'Профиль обновлён', visibilityTime: 3000 });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Не удалось обновить профиль';
      showToast({ type: 'error', text1: 'Ошибка', text2: message, visibilityTime: 4000 });
    } finally {
      setProfileSaving(false);
    }
  }, [emailNotifyComments, emailNotifyMessages, firstName, instagram, lastName, setProfile, twitter, userId, vk, youtube]);

  const saveEmailNotifications = useCallback(
    async (nextComments: boolean, nextMessages: boolean) => {
      if (!userId) return;
      setEmailNotifyComments(nextComments);
      setEmailNotifyMessages(nextMessages);
      setProfileSaving(true);
      try {
        const saved = await updateUserProfile(userId, {
          email_notify_comments: nextComments,
          email_notify_messages: nextMessages,
        });
        setProfile(saved);
        showToast({ type: 'success', text1: 'Настройки уведомлений сохранены', visibilityTime: 2000 });
      } catch (error) {
        setEmailNotifyComments(Boolean(profile?.email_notify_comments));
        setEmailNotifyMessages(Boolean(profile?.email_notify_messages));
        const message = error instanceof ApiError ? error.message : 'Не удалось обновить настройки уведомлений';
        showToast({ type: 'error', text1: 'Ошибка', text2: message, visibilityTime: 4000 });
      } finally {
        setProfileSaving(false);
      }
    },
    [profile?.email_notify_comments, profile?.email_notify_messages, setProfile, userId],
  );

  const handleEmailNotifyCommentsChange = useCallback(
    (nextValue: boolean) => {
      void saveEmailNotifications(nextValue, emailNotifyMessages);
    },
    [emailNotifyMessages, saveEmailNotifications],
  );

  const handleEmailNotifyMessagesChange = useCallback(
    (nextValue: boolean) => {
      void saveEmailNotifications(emailNotifyComments, nextValue);
    },
    [emailNotifyComments, saveEmailNotifications],
  );

  return {
    firstName,
    setFirstName,
    lastName,
    setLastName,
    youtube,
    setYoutube,
    instagram,
    setInstagram,
    twitter,
    setTwitter,
    vk,
    setVk,
    emailNotifyComments,
    emailNotifyMessages,
    profileSaving,
    derivedDisplayName,
    hasUnsavedChanges,
    saveProfile,
    handleEmailNotifyCommentsChange,
    handleEmailNotifyMessagesChange,
  };
}
