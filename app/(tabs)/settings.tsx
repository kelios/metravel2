import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, Platform, ScrollView, TextInput, ActivityIndicator, Image } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { buildLoginHref } from '@/utils/authNavigation';
import { useFavorites } from '@/context/FavoritesContext';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { globalFocusStyles } from '@/styles/globalFocus';
import { confirmAction } from '@/utils/confirmAction';
import { deleteCurrentUserAccount } from '@/api/user';
import { ApiError } from '@/api/client';
import { optimizeImageUrl } from '@/utils/imageOptimization';
import { useSettingsProfileForm } from '@/hooks/useSettingsProfileForm';
import { Theme, useTheme, useThemedColors } from '@/hooks/useTheme';
import { showToast } from '@/utils/toast';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl } from '@/utils/seo';
import { useIsFocused } from '@react-navigation/native';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { webTouchScrollStyle } from '@/utils';
import { createSettingsStyles } from './settings.styles';

export default function SettingsScreen() {
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
            <SafeAreaView style={styles.container}>
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
            <SafeAreaView style={styles.container}>
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
        <SafeAreaView style={styles.container}>
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
                                <Text style={styles.title}>Настройки</Text>
                                <Text style={styles.subtitle}>Профиль</Text>
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

                    <View style={styles.card}>
                        <View style={styles.profileHeaderRow}>
                            <View style={styles.profileAvatar}>
                                {profile?.avatar && !settingsAvatarError ? (
                                    <Image source={{ uri: optimizeImageUrl(profile.avatar, { width: 72, height: 72, quality: 70, format: 'auto', fit: 'cover' }) ?? profile.avatar }} style={styles.profileAvatarImage} onError={() => setSettingsAvatarError(true)} />
                                ) : (
                                    <Feather name="user" size={18} color={colors.primary} />
                                )}
                            </View>
                            <View style={styles.cardText}>
                                <Text style={styles.cardTitle}>{derivedDisplayName}</Text>
                                <Text style={styles.cardMeta}>Редактирование профиля</Text>
                            </View>
                            <View style={styles.profileActions}>
                                <Pressable
                                    style={[styles.refreshButton, globalFocusStyles.focusable]}
                                    onPress={loadProfile}
                                    accessibilityRole="button"
                                    accessibilityLabel="Обновить профиль"
                                    disabled={profileLoading}
                                    {...Platform.select({ web: { cursor: 'pointer' } })}
                                >
                                    {profileLoading ? (
                                        <ActivityIndicator size="small" color={colors.primary} />
                                    ) : (
                                        <Feather name="refresh-cw" size={16} color={colors.primary} />
                                    )}
                                </Pressable>
                            </View>
                        </View>

                        <View style={styles.formGrid}>
                            <View style={[styles.field, styles.fieldHalf]}>
                                <Text style={styles.fieldLabel}>Имя</Text>
                                <TextInput
                                    value={firstName}
                                    onChangeText={setFirstName}
                                    style={styles.input}
                                    placeholder="Введите имя"
                                    placeholderTextColor={colors.textMuted}
                                />
                            </View>
                            <View style={[styles.field, styles.fieldHalf]}>
                                <Text style={styles.fieldLabel}>Фамилия</Text>
                                <TextInput
                                    value={lastName}
                                    onChangeText={setLastName}
                                    style={styles.input}
                                    placeholder={username || 'Введите фамилию'}
                                    placeholderTextColor={colors.textMuted}
                                />
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <Text style={styles.subsectionTitle}>Социальные сети</Text>
                        <View style={styles.formGrid}>
                            <View style={[styles.field, styles.fieldHalf]}>
                                <Text style={styles.fieldLabel}>YouTube</Text>
                                <TextInput
                                    value={youtube}
                                    onChangeText={setYoutube}
                                    style={styles.input}
                                    placeholder="Ссылка"
                                    placeholderTextColor={colors.textMuted}
                                    autoCapitalize="none"
                                />
                            </View>
                            <View style={[styles.field, styles.fieldHalf]}>
                                <Text style={styles.fieldLabel}>Instagram</Text>
                                <TextInput
                                    value={instagram}
                                    onChangeText={setInstagram}
                                    style={styles.input}
                                    placeholder="Ссылка"
                                    placeholderTextColor={colors.textMuted}
                                    autoCapitalize="none"
                                />
                            </View>
                            <View style={[styles.field, styles.fieldHalf]}>
                                <Text style={styles.fieldLabel}>Twitter</Text>
                                <TextInput
                                    value={twitter}
                                    onChangeText={setTwitter}
                                    style={styles.input}
                                    placeholder="Ссылка"
                                    placeholderTextColor={colors.textMuted}
                                    autoCapitalize="none"
                                />
                            </View>
                            <View style={[styles.field, styles.fieldHalf]}>
                                <Text style={styles.fieldLabel}>VK</Text>
                                <TextInput
                                    value={vk}
                                    onChangeText={setVk}
                                    style={styles.input}
                                    placeholder="Ссылка"
                                    placeholderTextColor={colors.textMuted}
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>

                        <Button
                            label={profileSaving ? 'Сохранение…' : 'Сохранить'}
                            onPress={handleSaveProfile}
                            disabled={profileSaving || profileLoading || !hasUnsavedChanges}
                            loading={profileSaving}
                            fullWidth
                            size="md"
                        />

                        <View style={styles.divider} />

                        <Text style={styles.subsectionTitle}>Email-уведомления</Text>
                        <View style={styles.settingsList}>
                            <View style={styles.settingRow}>
                                <View style={styles.settingTextBlock}>
                                    <Text style={styles.settingTitle}>Отзывы</Text>
                                    <Text style={styles.settingMeta}>Письма о новых комментариях к вашим путешествиям</Text>
                                </View>
                                <Toggle
                                    value={emailNotifyComments}
                                    onValueChange={handleEmailNotifyCommentsChange}
                                    disabled={profileLoading || profileSaving}
                                />
                            </View>
                            <View style={styles.settingRow}>
                                <View style={styles.settingTextBlock}>
                                    <Text style={styles.settingTitle}>Сообщения</Text>
                                    <Text style={styles.settingMeta}>Письма о новых личных сообщениях</Text>
                                </View>
                                <Toggle
                                    value={emailNotifyMessages}
                                    onValueChange={handleEmailNotifyMessagesChange}
                                    disabled={profileLoading || profileSaving}
                                />
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <Text style={styles.subsectionTitle}>Аватар</Text>
                        <View style={styles.avatarRow}>
                            <View style={styles.avatarField}>
                                <Text style={styles.fieldLabel}>Аватар</Text>
                                <View style={styles.avatarPickerRow}>
                                    <View style={styles.avatarPreview}>
                                        {avatarPreviewUrl ? (
                                            <Image source={{ uri: avatarPreviewUrl }} style={styles.avatarPreviewImage} />
                                        ) : (
                                            <Feather name="image" size={18} color={colors.textMuted} />
                                        )}
                                    </View>
                                    <View style={styles.avatarPickerButtons}>
                                        <Button
                                            label="Выбрать"
                                            onPress={pickAvatar}
                                            disabled={profileLoading || avatarSaving}
                                            fullWidth={!isWeb}
                                            variant="secondary"
                                            size="sm"
                                            style={isWeb ? styles.avatarButtonWeb : undefined}
                                        />
                                        <Button
                                            label={avatarSaving ? 'Загрузка…' : 'Загрузить'}
                                            onPress={() => uploadAvatar()}
                                            disabled={profileLoading || avatarSaving || !avatarFile}
                                            loading={avatarSaving}
                                            fullWidth={!isWeb}
                                            size="sm"
                                            style={isWeb ? styles.avatarButtonWeb : undefined}
                                        />
                                    </View>
                                </View>

                                {Platform.OS === 'web' ? (
                                    <View style={{ height: 0, width: 0, overflow: 'hidden' } as any}>
                                        {
                                            (React.createElement('input', {
                                                ref: webFileInputRef,
                                                type: 'file',
                                                accept: 'image/*',
                                                onChange: handleWebFileSelected,
                                            }) as any)
                                        }
                                    </View>
                                ) : null}
                            </View>
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>Тема</Text>

                    <View style={styles.card}>
                        <View style={styles.cardRow}>
                            <View style={styles.cardIcon}>
                                <Feather name="sun" size={18} color={colors.primary} />
                            </View>
                            <View style={styles.cardText}>
                                <Text style={styles.cardTitle}>Тема оформления</Text>
                                <Text style={styles.cardMeta}>По умолчанию светлая</Text>
                            </View>
                        </View>

                        <View
                            style={styles.themeOptions}
                            accessibilityRole="radiogroup"
                            accessibilityLabel="Выбор темы оформления"
                        >
                            {themeOptions.map((option) => {
                                const isSelected = theme === option.value;
                                return (
                                    <Pressable
                                        key={option.value}
                                        onPress={() => setTheme(option.value)}
                                        style={({ pressed }) => [
                                            styles.themeOption,
                                            isSelected && styles.themeOptionActive,
                                            pressed && styles.themeOptionPressed,
                                        ]}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected: isSelected }}
                                        accessibilityLabel={option.label}
                                        {...Platform.select({ web: { cursor: 'pointer' } })}
                                    >
                                        <View style={[styles.themeOptionIcon, isSelected && styles.themeOptionIconActive]}>
                                            <Feather name={option.icon} size={16} color={colors.primary} />
                                        </View>
                                        <View style={styles.themeOptionText}>
                                            <Text style={styles.themeOptionTitle}>{option.label}</Text>
                                            <Text style={styles.themeOptionDescription}>{option.description}</Text>
                                        </View>
                                        {isSelected ? (
                                            <Feather name="check" size={16} color={colors.primary} />
                                        ) : null}
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                    {/* AND-17: Biometric authentication toggle (native only) */}
                    {showBiometricToggle ? (
                        <>
                            <Text style={styles.sectionTitle}>Безопасность</Text>
                            <View style={styles.card}>
                                <View style={styles.settingRow}>
                                    <View style={styles.settingTextBlock}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Feather name="lock" size={16} color={colors.primary} />
                                            <Text style={styles.settingTitle}>Вход по биометрии</Text>
                                        </View>
                                        <Text style={styles.settingMeta}>
                                            Используйте отпечаток пальца или Face ID для быстрого входа
                                        </Text>
                                    </View>
                                    <Toggle
                                        value={biometric.isEnabled}
                                        onValueChange={async (val) => {
                                            if (val) await biometric.enable();
                                            else await biometric.disable();
                                        }}
                                        disabled={biometric.isChecking}
                                    />
                                </View>
                            </View>
                        </>
                    ) : null}

                    <Text style={styles.sectionTitle}>Сообщения</Text>

                    <Pressable
                        style={[styles.card, globalFocusStyles.focusable]}
                        onPress={() => router.push('/messages' as any)}
                        accessibilityRole="button"
                        accessibilityLabel="Перейти к сообщениям"
                        {...Platform.select({ web: { cursor: 'pointer' } })}
                    >
                        <View style={styles.cardRow}>
                            <View style={styles.cardIcon}>
                                <Feather name="mail" size={18} color={colors.primary} />
                            </View>
                            <View style={styles.cardText}>
                                <Text style={styles.cardTitle}>Личные сообщения</Text>
                                <Text style={styles.cardMeta}>Переписка с авторами путешествий</Text>
                            </View>
                            <Feather name="chevron-right" size={18} color={colors.textMuted} />
                        </View>
                    </Pressable>

                    <Text style={styles.sectionTitle}>Аккаунт</Text>

                    <View style={styles.card}>
                        <View style={styles.cardRow}>
                            <View style={styles.cardIcon}>
                                <Feather name="user" size={18} color={colors.primary} />
                            </View>
                            <View style={styles.cardText}>
                                <Text style={styles.cardTitle}>{username || 'Пользователь'}</Text>
                                <Text style={styles.cardMeta}>Вы вошли в аккаунт</Text>
                            </View>
                        </View>

                        <Pressable
                            style={[styles.dangerButton, globalFocusStyles.focusable]}
                            onPress={handleLogout}
                            accessibilityRole="button"
                            accessibilityLabel="Выйти из аккаунта"
                            {...Platform.select({ web: { cursor: 'pointer' } })}
                        >
                            <Feather name="log-out" size={18} color={colors.danger} />
                            <Text style={styles.dangerButtonText}>Выйти</Text>
                        </Pressable>

                        <Pressable
                            style={[styles.dangerButton, styles.deleteAccountButton, globalFocusStyles.focusable]}
                            onPress={handleDeleteAccount}
                            accessibilityRole="button"
                            accessibilityLabel="Удалить аккаунт"
                            {...Platform.select({ web: { cursor: 'pointer' } })}
                        >
                            <Feather name="user-x" size={18} color={colors.textOnPrimary} />
                            <Text style={styles.deleteAccountButtonText}>Удалить аккаунт</Text>
                        </Pressable>
                    </View>

                    <Text style={styles.sectionTitle}>Данные</Text>

                    <View style={styles.card}>
                        <View style={styles.cardRow}>
                            <View style={styles.cardIcon}>
                                <Feather name="heart" size={18} color={colors.primary} />
                            </View>
                            <View style={styles.cardText}>
                                <Text style={styles.cardTitle}>Избранное</Text>
                                <Text style={styles.cardMeta}>{Array.isArray(favorites) ? favorites.length : 0} шт.</Text>
                            </View>
                        </View>

                        <Pressable
                            style={[styles.dangerButton, globalFocusStyles.focusable]}
                            onPress={handleClearFavorites}
                            accessibilityRole="button"
                            accessibilityLabel="Очистить избранное"
                            {...Platform.select({ web: { cursor: 'pointer' } })}
                        >
                            <Feather name="trash-2" size={18} color={colors.danger} />
                            <Text style={styles.dangerButtonText}>Очистить избранное</Text>
                        </Pressable>
                    </View>

                    <View style={styles.card}>
                        <View style={styles.cardRow}>
                            <View style={styles.cardIcon}>
                                <Feather name="clock" size={18} color={colors.primary} />
                            </View>
                            <View style={styles.cardText}>
                                <Text style={styles.cardTitle}>История просмотров</Text>
                                <Text style={styles.cardMeta}>{Array.isArray(viewHistory) ? viewHistory.length : 0} шт.</Text>
                            </View>
                        </View>

                        <Pressable
                            style={[styles.dangerButton, globalFocusStyles.focusable]}
                            onPress={handleClearHistory}
                            accessibilityRole="button"
                            accessibilityLabel="Очистить историю просмотров"
                            {...Platform.select({ web: { cursor: 'pointer' } })}
                        >
                            <Feather name="trash-2" size={18} color={colors.danger} />
                            <Text style={styles.dangerButtonText}>Очистить историю</Text>
                        </Pressable>
                    </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
