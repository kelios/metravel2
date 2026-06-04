import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const mountedRef = useRef(true);
  // Монотонный счётчик сохранений: после await коммитит только последнее,
  // чтобы поздний ответ saveProfile/saveEmailNotifications не затирал другую секцию.
  const saveSeqRef = useRef(0);
  // «Грязное» состояние и актуальные значения тоглов — для чтения из эффекта/хендлеров
  // без перезапуска эффекта на каждое нажатие.
  const hasUnsavedChangesRef = useRef(false);
  const emailNotifyCommentsRef = useRef(false);
  const emailNotifyMessagesRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!profile) return;
    // Аватар не редактируется в текстовых полях — синхронизируем всегда.
    setAvatarPreviewUrl(profile.avatar || '');
    // Не затираем поля, которые пользователь отредактировал, но не сохранил:
    // загрузка аватара на этом же экране триггерит refresh профиля и иначе
    // сбросила бы несохранённый ввод.
    if (hasUnsavedChangesRef.current) return;
    setFirstName(normalizeAvatar(profile.first_name) ?? '');
    setLastName(normalizeAvatar(profile.last_name) ?? '');
    setYoutube(profile.youtube || '');
    setInstagram(profile.instagram || '');
    setTwitter(profile.twitter || '');
    setVk(profile.vk || '');
    setEmailNotifyComments(Boolean(profile.email_notify_comments));
    setEmailNotifyMessages(Boolean(profile.email_notify_messages));
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

  // Render-phase «latest»-снимки: эффект/хендлеры читают актуальные значения без
  // повторного запуска эффекта на каждое нажатие.
  hasUnsavedChangesRef.current = hasUnsavedChanges;
  emailNotifyCommentsRef.current = emailNotifyComments;
  emailNotifyMessagesRef.current = emailNotifyMessages;

  const saveProfile = useCallback(async () => {
    if (!userId) return;
    const seq = ++saveSeqRef.current;
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
      // Вытеснено более новым сохранением или unmount — не коммитим (иначе устаревший
      // ответ затрёт другую секцию).
      if (!mountedRef.current || seq !== saveSeqRef.current) return;
      setProfile(saved);
      showToast({ type: 'success', text1: 'Профиль обновлён', visibilityTime: 3000 });
    } catch (error) {
      if (!mountedRef.current || seq !== saveSeqRef.current) return;
      const message = error instanceof ApiError ? error.message : 'Не удалось обновить профиль';
      showToast({ type: 'error', text1: 'Ошибка', text2: message, visibilityTime: 4000 });
    } finally {
      if (mountedRef.current && seq === saveSeqRef.current) setProfileSaving(false);
    }
  }, [emailNotifyComments, emailNotifyMessages, firstName, instagram, lastName, setProfile, twitter, userId, vk, youtube]);

  const saveEmailNotifications = useCallback(
    async (nextComments: boolean, nextMessages: boolean) => {
      if (!userId) return;
      setEmailNotifyComments(nextComments);
      setEmailNotifyMessages(nextMessages);
      const seq = ++saveSeqRef.current;
      setProfileSaving(true);
      try {
        const saved = await updateUserProfile(userId, {
          email_notify_comments: nextComments,
          email_notify_messages: nextMessages,
        });
        if (!mountedRef.current || seq !== saveSeqRef.current) return;
        setProfile(saved);
        showToast({ type: 'success', text1: 'Настройки уведомлений сохранены', visibilityTime: 2000 });
      } catch (error) {
        if (!mountedRef.current || seq !== saveSeqRef.current) return;
        setEmailNotifyComments(Boolean(profile?.email_notify_comments));
        setEmailNotifyMessages(Boolean(profile?.email_notify_messages));
        const message = error instanceof ApiError ? error.message : 'Не удалось обновить настройки уведомлений';
        showToast({ type: 'error', text1: 'Ошибка', text2: message, visibilityTime: 4000 });
      } finally {
        if (mountedRef.current && seq === saveSeqRef.current) setProfileSaving(false);
      }
    },
    [profile?.email_notify_comments, profile?.email_notify_messages, setProfile, userId],
  );

  const handleEmailNotifyCommentsChange = useCallback(
    (nextValue: boolean) => {
      // Берём актуальное значение соседнего тогла из ref (а не из stale-замыкания).
      void saveEmailNotifications(nextValue, emailNotifyMessagesRef.current);
    },
    [saveEmailNotifications],
  );

  const handleEmailNotifyMessagesChange = useCallback(
    (nextValue: boolean) => {
      void saveEmailNotifications(emailNotifyCommentsRef.current, nextValue);
    },
    [saveEmailNotifications],
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
