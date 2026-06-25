import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, Platform, ScrollView } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { buildLoginHref } from '@/utils/authNavigation';
import { useFavorites } from '@/context/FavoritesContext';
import EmptyState from '@/components/ui/EmptyState';
import { globalFocusStyles } from '@/styles/globalFocus';
import { confirmAction } from '@/utils/confirmAction';
import { deleteCurrentUserAccount } from '@/api/user';
import { ApiError } from '@/api/client';
import { useSettingsProfileForm } from '@/hooks/useSettingsProfileForm';
import { Theme, useTheme, useThemedColors } from '@/hooks/useTheme';
import { showToast } from '@/utils/toast';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl } from '@/utils/seo';
import { useIsFocused } from 'expo-router';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { webTouchScrollStyle } from '@/utils';
import { createSettingsStyles } from '@/components/screens/settings/settings.styles';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import StravaSettingsSection from '@/components/settings/StravaSettingsSection';
import DataOwnershipSection from '@/components/settings/DataOwnershipSection';
import ProfileSection from '@/components/settings/ProfileSection';
import ThemeSection from '@/components/settings/ThemeSection';
import BiometricSection from '@/components/settings/BiometricSection';
import AccountSection from '@/components/settings/AccountSection';
import DataManagementSection from '@/components/settings/DataManagementSection';
import NavCardSection from '@/components/settings/NavCardSection';

// Keep the Strava implementation for a future backend rollout, but hide the settings UI for now.
const STRAVA_SETTINGS_ENABLED = false;

export default function SettingsScreen() {
    // Android: hardware Back возвращает на предыдущий экран (Профиль), а не
    // сбрасывает Tab-навигатор на главную. Хук гейтит по Platform.OS === 'android'.
    useAndroidBackHandler();
    const router = useRouter();
    const isFocused = useIsFocused();
    const { isAuthenticated, authReady, logout, username, userId } = useAuth();
    const isWeb = Platform.OS === 'web';
    const favoritesContext = useFavorites();
    const { theme, setTheme } = useTheme();
    const colors = useThemedColors();
    const styles = useMemo(() => createSettingsStyles(colors), [colors]);
    const {
        clearHistory = async () => {},
        clearFavorites = async () => {},
        favorites = [],
        viewHistory = [],
    } = favoritesContext ?? {};

    const { profile, setProfile, isLoading: profileLoading, loadProfile, fullName: _fullName } = useUserProfile();
    const {
        avatarFile,
        avatarPreviewUrl,
        setAvatarPreviewUrl,
        isUploading: avatarSaving,
        pickAvatar,
        uploadAvatar,
        handleWebFileSelected,
        webFileInputRef,
    } = useAvatarUpload({ onSuccess: (updated) => setProfile(updated) });

    // AND-17: Biometric auth toggle (native only)
    const biometric = useBiometricAuth();
    const showBiometricToggle = !isWeb && biometric.isAvailable && biometric.isEnrolled && isAuthenticated;

    const [settingsAvatarError, setSettingsAvatarError] = useState(false);

    const {
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
        saveProfile: handleSaveProfile,
        handleEmailNotifyCommentsChange,
        handleEmailNotifyMessagesChange,
        telegramUsername,
        setTelegramUsername,
        telegramVerified,
        preferredMessenger,
        telegramUsernameDirty,
        telegramBusy,
        telegramAwaitingConfirm,
        saveTelegramUsername,
        startTelegramAuth,
        confirmTelegramAuth,
        changePreferredMessenger,
    } = useSettingsProfileForm({
        userId,
        username,
        profile,
        setProfile,
        setAvatarPreviewUrl,
    });

    const themeOptions = useMemo(
        () => [
            {
                value: 'light' as Theme,
                label: 'Светлая',
                description: 'По умолчанию',
                icon: 'sun' as const,
            },
            {
                value: 'dark' as Theme,
                label: 'Тёмная',
                description: 'Комфортно в темноте',
                icon: 'moon' as const,
            },
            {
                value: 'auto' as Theme,
                label: 'Системная',
                description: 'Следовать настройкам устройства',
                icon: 'smartphone' as const,
            },
        ],
        []
    );

    const messengerOptions = useMemo(
        () => [
            { value: 'telegram' as const, label: 'Telegram' },
            { value: 'whatsapp' as const, label: 'WhatsApp' },
            { value: 'other' as const, label: 'Другой' },
        ],
        []
    );

    const handleDeleteAccount = useCallback(async () => {
        try {
            const confirmed = await confirmAction({
                title: 'Удалить аккаунт',
                message: 'Аккаунт и ваши путешествия будут удалены без возможности восстановления. Продолжить?',
                confirmText: 'Удалить',
                cancelText: 'Отмена',
            });
            if (!confirmed) return;

            await deleteCurrentUserAccount();
            await logout();
            showToast({ type: 'success', text1: 'Аккаунт удалён', visibilityTime: 3000 });
            router.replace('/login');
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Не удалось удалить аккаунт';
            showToast({ type: 'error', text1: 'Ошибка', text2: message, visibilityTime: 4000 });
        }
    }, [logout, router]);

    const handleLogout = useCallback(async () => {
        try {
            const confirmed = await confirmAction({
                title: 'Выход из аккаунта',
                message: 'Выйти из аккаунта?',
                confirmText: 'Выйти',
                cancelText: 'Отмена',
            });
            if (!confirmed) return;

            await logout();
            router.replace('/login');
        } catch (error) {
            console.error('Error logging out:', error);
        }
    }, [logout, router]);

    const handleClearHistory = useCallback(async () => {
        try {
            if (typeof clearHistory !== 'function') return;

            const confirmed = await confirmAction({
                title: 'Очистить историю',
                message: 'Очистить историю просмотров?',
                confirmText: 'Очистить',
                cancelText: 'Отмена',
            });
            if (!confirmed) return;

            await clearHistory();
            showToast({ type: 'success', text1: 'История очищена', visibilityTime: 2000 });
        } catch (error) {
            console.error('Error clearing history:', error);
            showToast({ type: 'error', text1: 'Ошибка', text2: 'Не удалось очистить историю', visibilityTime: 3000 });
        }
    }, [clearHistory]);

    const handleClearFavorites = useCallback(async () => {
        try {
            if (typeof clearFavorites !== 'function') return;

            const confirmed = await confirmAction({
                title: 'Очистить избранное',
                message: 'Очистить избранное?',
                confirmText: 'Очистить',
                cancelText: 'Отмена',
            });
            if (!confirmed) return;

            await clearFavorites();
            showToast({ type: 'success', text1: 'Избранное очищено', visibilityTime: 2000 });
        } catch (error) {
            console.error('Error clearing favorites:', error);
            showToast({ type: 'error', text1: 'Ошибка', text2: 'Не удалось очистить избранное', visibilityTime: 3000 });
        }
    }, [clearFavorites]);

    const handleBackToProfile = useCallback(() => {
        router.push('/profile' as any);
    }, [router]);

    if (!authReady) {
        return (
            <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
                <ScrollView style={webTouchScrollStyle} contentContainerStyle={styles.scrollContent}>
                    <View style={styles.pageContainer}>
                        <View style={styles.header}>
                            <View style={styles.headerRow}>
                                <View style={styles.headerTitleBlock}>
                                    <SkeletonLoader width={140} height={22} borderRadius={4} />
                                    <SkeletonLoader width={180} height={14} borderRadius={4} style={{ marginTop: 6 }} />
                                </View>
                                <SkeletonLoader width={110} height={40} borderRadius={10} />
                            </View>
                        </View>
                        <View style={{ gap: 14 }}>
                            <SkeletonLoader width="100%" height={180} borderRadius={12} />
                            <SkeletonLoader width="100%" height={120} borderRadius={12} />
                            <SkeletonLoader width="100%" height={100} borderRadius={12} />
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    if (!isAuthenticated) {
        return (
            <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
                <EmptyState
                    icon="settings"
                    title="Войдите в аккаунт"
                    description="Войдите, чтобы управлять настройками и данными аккаунта."
                    action={{
                        label: 'Войти',
                        onPress: () => router.push(buildLoginHref({ redirect: '/settings', intent: 'settings' }) as any),
                    }}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
            {isFocused && (
                <InstantSEO
                    headKey="settings"
                    title="Настройки | Metravel"
                    description="Настройки аккаунта"
                    canonical={buildCanonicalUrl('/settings')}
                    robots="noindex, nofollow"
                />
            )}
            <ScrollView style={webTouchScrollStyle} contentContainerStyle={styles.scrollContent}>
                <View style={styles.pageContainer}>
                    <View style={styles.header}>
                        <View style={styles.headerRow}>
                            <View style={styles.headerTitleBlock}>
                                {/* На native заголовок «Настройки» уже есть в шапке экрана — не дублируем */}
                                {Platform.OS === 'web' && <Text style={styles.title}>Настройки</Text>}
                            </View>
                            <Pressable
                                style={[styles.backToProfileButton, globalFocusStyles.focusable]}
                                onPress={handleBackToProfile}
                                accessibilityRole="button"
                                accessibilityLabel="Перейти в профиль"
                                {...Platform.select({ web: { cursor: 'pointer' } })}
                            >
                                <Feather name="user" size={16} color={colors.primary} />
                                <Text style={styles.backToProfileButtonText}>В профиль</Text>
                            </Pressable>
                        </View>
                    </View>

                    <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Профиль</Text>

                    <ProfileSection
                        styles={styles}
                        colors={colors}
                        isWeb={isWeb}
                        username={username}
                        profile={profile}
                        profileLoading={profileLoading}
                        loadProfile={loadProfile}
                        settingsAvatarError={settingsAvatarError}
                        setSettingsAvatarError={setSettingsAvatarError}
                        derivedDisplayName={derivedDisplayName}
                        firstName={firstName}
                        setFirstName={setFirstName}
                        lastName={lastName}
                        setLastName={setLastName}
                        youtube={youtube}
                        setYoutube={setYoutube}
                        instagram={instagram}
                        setInstagram={setInstagram}
                        twitter={twitter}
                        setTwitter={setTwitter}
                        vk={vk}
                        setVk={setVk}
                        profileSaving={profileSaving}
                        hasUnsavedChanges={hasUnsavedChanges}
                        handleSaveProfile={handleSaveProfile}
                        telegramUsername={telegramUsername}
                        setTelegramUsername={setTelegramUsername}
                        telegramVerified={telegramVerified}
                        telegramBusy={telegramBusy}
                        telegramUsernameDirty={telegramUsernameDirty}
                        telegramAwaitingConfirm={telegramAwaitingConfirm}
                        saveTelegramUsername={saveTelegramUsername}
                        startTelegramAuth={startTelegramAuth}
                        confirmTelegramAuth={confirmTelegramAuth}
                        preferredMessenger={preferredMessenger}
                        changePreferredMessenger={changePreferredMessenger}
                        messengerOptions={messengerOptions}
                        emailNotifyComments={emailNotifyComments}
                        emailNotifyMessages={emailNotifyMessages}
                        handleEmailNotifyCommentsChange={handleEmailNotifyCommentsChange}
                        handleEmailNotifyMessagesChange={handleEmailNotifyMessagesChange}
                        avatarPreviewUrl={avatarPreviewUrl}
                        avatarFile={avatarFile}
                        avatarSaving={avatarSaving}
                        pickAvatar={pickAvatar}
                        uploadAvatar={uploadAvatar}
                        handleWebFileSelected={handleWebFileSelected}
                        webFileInputRef={webFileInputRef}
                    />

                    <Text style={styles.sectionTitle}>Тема</Text>

                    <ThemeSection
                        styles={styles}
                        colors={colors}
                        theme={theme}
                        setTheme={setTheme}
                        themeOptions={themeOptions}
                    />

                    {/* AND-17: Biometric authentication toggle (native only) */}
                    {showBiometricToggle ? (
                        <>
                            <Text style={styles.sectionTitle}>Безопасность</Text>
                            <BiometricSection styles={styles} colors={colors} biometric={biometric} />
                        </>
                    ) : null}

                    {STRAVA_SETTINGS_ENABLED ? <StravaSettingsSection /> : null}

                    <Text style={styles.sectionTitle}>Сообщения</Text>

                    <NavCardSection
                        styles={styles}
                        colors={colors}
                        icon="mail"
                        title="Личные сообщения"
                        meta="Переписка с авторами путешествий"
                        accessibilityLabel="Перейти к сообщениям"
                        onPress={() => router.push('/messages' as any)}
                    />

                    <Text style={styles.sectionTitle}>Приватность и данные</Text>

                    <NavCardSection
                        styles={styles}
                        colors={colors}
                        icon="eye"
                        title="Настройки приватности"
                        meta="Кто видит ваши путешествия, маршруты и контакты"
                        accessibilityLabel="Настройки приватности"
                        onPress={() => router.push('/privacy-settings' as any)}
                    />

                    <DataOwnershipSection />

                    <NavCardSection
                        styles={styles}
                        colors={colors}
                        icon="shield"
                        title="Журнал безопасности"
                        meta="История входов и действий с аккаунтом"
                        accessibilityLabel="Журнал безопасности"
                        onPress={() => router.push('/security-journal' as any)}
                    />

                    <Text style={styles.sectionTitle}>Аккаунт</Text>

                    <AccountSection
                        styles={styles}
                        colors={colors}
                        username={username}
                        handleLogout={handleLogout}
                        handleDeleteAccount={handleDeleteAccount}
                    />

                    <Text style={styles.sectionTitle}>Данные</Text>

                    <DataManagementSection
                        styles={styles}
                        colors={colors}
                        favorites={favorites}
                        viewHistory={viewHistory}
                        handleClearFavorites={handleClearFavorites}
                        handleClearHistory={handleClearHistory}
                    />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
