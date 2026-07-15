import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  normalizeAvatar,
  updateUserProfile,
  type UpdateUserProfilePayload,
} from '@/api/user';
import { ApiError } from '@/api/client';
import { showToast } from '@/utils/toast';
import { openExternalUrl } from '@/utils/externalLinks';
import type { PreferredMessenger } from '@/api/telegramLink';
import {
  useConfirmTelegramAuth,
  useMyTelegramLink,
  useStartTelegramAuth,
  useUpdateTelegramLink,
} from '@/hooks/useTelegramLinkApi';
import type { useUserProfile } from '@/hooks/useUserProfile';
import { translate as i18nT } from '@/i18n'


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
  // Форма уже гидрирована из профиля хотя бы раз. Без этого флага первичная
  // загрузка блокировалась guard'ом hasUnsavedChanges: пустая форма «грязная»
  // относительно непустого профиля ещё до гидрации.
  const hydratedRef = useRef(false);
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
    // сбросила бы несохранённый ввод. Но первичную гидрацию пропускать нельзя —
    // до неё пустая форма всегда «грязная» относительно непустого профиля.
    if (hydratedRef.current && hasUnsavedChangesRef.current) return;
    setFirstName(normalizeAvatar(profile.first_name) ?? '');
    setLastName(normalizeAvatar(profile.last_name) ?? '');
    setYoutube(profile.youtube || '');
    setInstagram(profile.instagram || '');
    setTwitter(profile.twitter || '');
    setVk(profile.vk || '');
    setEmailNotifyComments(Boolean(profile.email_notify_comments));
    setEmailNotifyMessages(Boolean(profile.email_notify_messages));
    hydratedRef.current = true;
  }, [profile, setAvatarPreviewUrl]);

  const derivedDisplayName = useMemo(() => {
    const first = normalizeAvatar(firstName) ?? '';
    const last = normalizeAvatar(lastName) ?? '';
    const full = `${first} ${last}`.trim();
    return full || username || i18nT('profile:app.tabs.profile.defaultUserName');
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
      showToast({ type: 'success', text1: i18nT('profile:hooks.useSettingsProfileForm.profil_obnovlen_cf1dea9c'), visibilityTime: 3000 });
    } catch (error) {
      if (!mountedRef.current || seq !== saveSeqRef.current) return;
      const message = error instanceof ApiError ? error.message : i18nT('profile:hooks.useSettingsProfileForm.ne_udalos_obnovit_profil_71aacb1a');
      showToast({ type: 'error', text1: i18nT('profile:hooks.useSettingsProfileForm.oshibka_d3c70bab'), text2: message, visibilityTime: 4000 });
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
        showToast({ type: 'success', text1: i18nT('profile:hooks.useSettingsProfileForm.nastroyki_uvedomleniy_sohraneny_9c74887c'), visibilityTime: 2000 });
      } catch (error) {
        if (!mountedRef.current || seq !== saveSeqRef.current) return;
        setEmailNotifyComments(Boolean(profile?.email_notify_comments));
        setEmailNotifyMessages(Boolean(profile?.email_notify_messages));
        const message = error instanceof ApiError ? error.message : i18nT('profile:hooks.useSettingsProfileForm.ne_udalos_obnovit_nastroyki_uvedomleniy_ad5d8355');
        showToast({ type: 'error', text1: i18nT('profile:hooks.useSettingsProfileForm.oshibka_d3c70bab'), text2: message, visibilityTime: 4000 });
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

  // ── Telegram-привязка (FE-421) ────────────────────────────────────────────
  const { data: telegramLink, isLoading: telegramLoading } = useMyTelegramLink();
  const updateTelegram = useUpdateTelegramLink();
  const startTelegram = useStartTelegramAuth();
  const confirmTelegram = useConfirmTelegramAuth();

  const [telegramUsername, setTelegramUsername] = useState('');
  // Токен из последнего deeplink (?start=<token>) для шага подтверждения.
  const [pendingAuthToken, setPendingAuthToken] = useState<string | null>(null);
  const telegramHydratedRef = useRef(false);

  useEffect(() => {
    if (!telegramLink) return;
    // Не затираем несохранённый ввод пользователя после первичной гидрации.
    if (telegramHydratedRef.current) return;
    setTelegramUsername(telegramLink.telegramUsername ?? '');
    telegramHydratedRef.current = true;
  }, [telegramLink]);

  const telegramVerified = telegramLink?.telegramVerified ?? false;
  const preferredMessenger: PreferredMessenger | null = telegramLink?.preferredMessenger ?? null;

  const telegramUsernameDirty = useMemo(() => {
    const norm = (v: unknown) => String(v ?? '').trim().replace(/^@/, '');
    return norm(telegramUsername) !== norm(telegramLink?.telegramUsername);
  }, [telegramUsername, telegramLink?.telegramUsername]);

  const telegramBusy =
    telegramLoading ||
    updateTelegram.isPending ||
    startTelegram.isPending ||
    confirmTelegram.isPending;

  const saveTelegramUsername = useCallback(() => {
    updateTelegram.mutate(
      { telegramUsername },
      {
        onSuccess: () =>
          showToast({ type: 'success', text1: i18nT('profile:hooks.useSettingsProfileForm.telegram_sohranen_2f6d1b99'), visibilityTime: 2000 }),
        onError: (error) => {
          const message = error instanceof ApiError ? error.message : i18nT('profile:hooks.useSettingsProfileForm.ne_udalos_sohranit_telegram_6a429442');
          showToast({ type: 'error', text1: i18nT('profile:hooks.useSettingsProfileForm.oshibka_d3c70bab'), text2: message, visibilityTime: 4000 });
        },
      },
    );
  }, [telegramUsername, updateTelegram]);

  const startTelegramAuth = useCallback(() => {
    startTelegram.mutate(undefined, {
      onSuccess: async ({ deeplink }) => {
        // Достаём токен из ?start=<token> для последующего confirm.
        let token: string | null = null;
        try {
          const startParam = new URL(deeplink).searchParams.get('start');
          token = startParam && startParam.length > 0 ? startParam : null;
        } catch {
          token = null;
        }
        setPendingAuthToken(token);
        await openExternalUrl(deeplink);
      },
      onError: (error) => {
        const message = error instanceof ApiError ? error.message : i18nT('profile:hooks.useSettingsProfileForm.ne_udalos_otkryt_telegram_40f00994');
        showToast({ type: 'error', text1: i18nT('profile:hooks.useSettingsProfileForm.oshibka_d3c70bab'), text2: message, visibilityTime: 4000 });
      },
    });
  }, [startTelegram]);

  const confirmTelegramAuth = useCallback(() => {
    if (!pendingAuthToken) return;
    confirmTelegram.mutate(pendingAuthToken, {
      onSuccess: () => {
        setPendingAuthToken(null);
        showToast({ type: 'success', text1: i18nT('profile:hooks.useSettingsProfileForm.telegram_podtverzhden_b62c389d'), visibilityTime: 2000 });
      },
      onError: (error) => {
        const message = error instanceof ApiError ? error.message : i18nT('profile:hooks.useSettingsProfileForm.ne_udalos_podtverdit_telegram_37c42e4b');
        showToast({ type: 'error', text1: i18nT('profile:hooks.useSettingsProfileForm.oshibka_d3c70bab'), text2: message, visibilityTime: 4000 });
      },
    });
  }, [confirmTelegram, pendingAuthToken]);

  const changePreferredMessenger = useCallback(
    (next: PreferredMessenger) => {
      if (next === preferredMessenger) return;
      updateTelegram.mutate(
        { preferredMessenger: next },
        {
          onError: (error) => {
            const message =
              error instanceof ApiError ? error.message : i18nT('profile:hooks.useSettingsProfileForm.ne_udalos_sohranit_messendzher_51f6dc54');
            showToast({ type: 'error', text1: i18nT('profile:hooks.useSettingsProfileForm.oshibka_d3c70bab'), text2: message, visibilityTime: 4000 });
          },
        },
      );
    },
    [preferredMessenger, updateTelegram],
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
    // Telegram-привязка (FE-421)
    telegramUsername,
    setTelegramUsername,
    telegramVerified,
    preferredMessenger,
    telegramUsernameDirty,
    telegramBusy,
    telegramAwaitingConfirm: pendingAuthToken != null,
    saveTelegramUsername,
    startTelegramAuth,
    confirmTelegramAuth,
    changePreferredMessenger,
  };
}
