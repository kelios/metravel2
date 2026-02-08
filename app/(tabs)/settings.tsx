import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable, Platform, ScrollView, TextInput, ActivityIndicator, Image } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '@/context/AuthContext';
import { buildLoginHref } from '@/utils/authNavigation';
import { useFavorites } from '@/context/FavoritesContext';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { confirmAction } from '@/utils/confirmAction';
import { fetchUserProfile, updateUserProfile, uploadUserProfileAvatarFile, type UpdateUserProfilePayload, type UploadUserProfileAvatarFile, type UserProfileDto } from '@/api/user';
import { ApiError } from '@/api/client';
import { removeStorageBatch, setStorageBatch } from '@/utils/storageBatch';
import { Theme, useTheme, useThemedColors } from '@/hooks/useTheme';
import { showToast } from '@/utils/toast';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';

export default function SettingsScreen() {
    const router = useRouter();
    const { isAuthenticated, authReady, logout, username, userId, triggerProfileRefresh, setUserAvatar } = useAuth();
    const isWeb = Platform.OS === 'web';
    const favoritesContext = useFavorites();
    const { theme, setTheme } = useTheme();
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const {
        clearHistory = async () => {},
        clearFavorites = async () => {},
        favorites = [],
        viewHistory = [],
    } = favoritesContext ?? {};

    const [profile, setProfile] = useState<UserProfileDto | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileSaving, setProfileSaving] = useState(false);
    const [avatarSaving, setAvatarSaving] = useState(false);

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [youtube, setYoutube] = useState('');
    const [instagram, setInstagram] = useState('');
    const [twitter, setTwitter] = useState('');
    const [vk, setVk] = useState('');
    const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string>('');
    const [avatarFile, setAvatarFile] = useState<UploadUserProfileAvatarFile | null>(null);
    const [settingsAvatarError, setSettingsAvatarError] = useState(false);
    const webFileInputRef = useRef<any>(null);

    const cleanText = useCallback((value: unknown) => {
        const v = String(value ?? '').trim();
        if (!v) return '';
        const lower = v.toLowerCase();
        if (lower === 'null' || lower === 'undefined') return '';
        return v;
    }, []);

    const derivedDisplayName = useMemo(() => {
        const full = `${cleanText(firstName)} ${cleanText(lastName)}`.trim();
        return full || username || 'Пользователь';
    }, [cleanText, firstName, lastName, username]);

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

    const hasUnsavedChanges = useMemo(() => {
        if (!profile) return false;
        const normalize = (v: unknown) => String(v ?? '').trim();
        return (
            normalize(firstName) !== normalize(profile.first_name) ||
            normalize(lastName) !== normalize(profile.last_name) ||
            normalize(youtube) !== normalize(profile.youtube) ||
            normalize(instagram) !== normalize(profile.instagram) ||
            normalize(twitter) !== normalize(profile.twitter) ||
            normalize(vk) !== normalize(profile.vk)
        );
    }, [firstName, instagram, lastName, profile, twitter, vk, youtube]);

    const loadProfile = useCallback(async () => {
        if (!userId) return;
        setProfileLoading(true);
        try {
            const data = await fetchUserProfile(userId);
            setProfile(data);
            setFirstName(cleanText(data.first_name));
            setLastName(cleanText(data.last_name));
            setYoutube(data.youtube || '');
            setInstagram(data.instagram || '');
            setTwitter(data.twitter || '');
            setVk(data.vk || '');
            setAvatarPreviewUrl(data.avatar || '');
            setAvatarFile(null);

            // Sync avatar to auth store & storage so header always shows it
            const rawAvatar = String(data.avatar ?? '').trim();
            const lowerAvatar = rawAvatar.toLowerCase();
            const normalizedAvatar =
                rawAvatar && lowerAvatar !== 'null' && lowerAvatar !== 'undefined'
                    ? rawAvatar
                    : null;
            setUserAvatar(normalizedAvatar);
            if (normalizedAvatar) {
                setStorageBatch([['userAvatar', normalizedAvatar]]).catch(() => undefined);
            } else {
                removeStorageBatch(['userAvatar']).catch(() => undefined);
            }
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Не удалось загрузить профиль';
            showToast({ type: 'error', text1: 'Ошибка', text2: message, visibilityTime: 4000 });
        } finally {
            setProfileLoading(false);
        }
    }, [cleanText, setUserAvatar, userId]);

    useEffect(() => {
        if (!isAuthenticated) return;
        loadProfile();
    }, [isAuthenticated, loadProfile]);

    const handleSaveProfile = useCallback(async () => {
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
    }, [firstName, instagram, lastName, twitter, userId, vk, youtube]);

    const handlePickAvatar = useCallback(async () => {
        try {
            if (Platform.OS === 'web') {
                if (webFileInputRef.current && typeof webFileInputRef.current.click === 'function') {
                    webFileInputRef.current.click();
                }
                return;
            }

            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                showToast({ type: 'warning', text1: 'Разрешение', text2: 'Нужен доступ к галерее', visibilityTime: 3000 });
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.85,
                allowsMultipleSelection: false,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                const file: UploadUserProfileAvatarFile = {
                    uri: asset.uri,
                    name: asset.fileName || `avatar_${Date.now()}.jpg`,
                    type: asset.type === 'image' ? 'image/jpeg' : 'image/jpeg',
                };
                setAvatarFile(file);
                setAvatarPreviewUrl(asset.uri);
            }
        } catch {
            showToast({ type: 'error', text1: 'Ошибка', text2: 'Не удалось выбрать изображение', visibilityTime: 3000 });
        }
    }, []);

    const handleWebAvatarSelected = useCallback((e: any) => {
        const file = e?.target?.files?.[0];
        if (!file) return;
        setAvatarFile(file);
        try {
            const url = URL.createObjectURL(file);
            setAvatarPreviewUrl(url);
        } catch {
            setAvatarPreviewUrl('');
        }
    }, []);

    const handleUploadAvatar = useCallback(async () => {
        if (!userId) return;
        if (!avatarFile) {
            showToast({ type: 'warning', text1: 'Выберите изображение', text2: 'Сначала выберите фото для аватара', visibilityTime: 3000 });
            return;
        }

        setAvatarSaving(true);
        try {
            const saved = await uploadUserProfileAvatarFile(userId, avatarFile);
            setProfile(saved);
            setAvatarPreviewUrl(saved.avatar || avatarPreviewUrl);
            setAvatarFile(null);

            const rawAvatar = String((saved as any)?.avatar ?? '').trim();
            const lowerAvatar = rawAvatar.toLowerCase();
            const normalizedAvatar =
                rawAvatar && lowerAvatar !== 'null' && lowerAvatar !== 'undefined'
                    ? rawAvatar
                    : null;

            setUserAvatar(normalizedAvatar);
            if (normalizedAvatar) {
                await setStorageBatch([['userAvatar', normalizedAvatar]]);
            } else {
                await removeStorageBatch(['userAvatar']);
            }

            triggerProfileRefresh();
            showToast({ type: 'success', text1: 'Аватар обновлён', visibilityTime: 3000 });
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Не удалось обновить аватар';
            showToast({ type: 'error', text1: 'Ошибка', text2: message, visibilityTime: 4000 });
        } finally {
            setAvatarSaving(false);
        }
    }, [avatarFile, avatarPreviewUrl, setUserAvatar, triggerProfileRefresh, userId]);

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

    if (!authReady) {
        return (
            <SafeAreaView style={styles.container}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.pageContainer}>
                        <View style={styles.header}>
                            <SkeletonLoader width={140} height={22} borderRadius={4} />
                            <SkeletonLoader width={180} height={14} borderRadius={4} style={{ marginTop: 6 }} />
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
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.pageContainer}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Настройки</Text>
                        <Text style={styles.subtitle}>Аккаунт и данные</Text>
                    </View>

                    <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Профиль</Text>

                    <View style={styles.card}>
                        <View style={styles.profileHeaderRow}>
                            <View style={styles.profileAvatar}>
                                {profile?.avatar && !settingsAvatarError ? (
                                    <Image source={{ uri: profile.avatar }} style={styles.profileAvatarImage} onError={() => setSettingsAvatarError(true)} />
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
                                            onPress={handlePickAvatar}
                                            disabled={profileLoading || avatarSaving}
                                            fullWidth={!isWeb}
                                            variant="secondary"
                                            size="sm"
                                            style={isWeb ? styles.avatarButtonWeb : undefined}
                                        />
                                        <Button
                                            label={avatarSaving ? 'Загрузка…' : 'Загрузить'}
                                            onPress={handleUploadAvatar}
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
                                                onChange: handleWebAvatarSelected,
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

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.mutedBackground,
    },
    scrollContent: {
        paddingBottom: 24,
    },
    pageContainer: {
        width: '100%',
        paddingHorizontal: 16,
        ...Platform.select({
            web: {
                maxWidth: 760,
                marginLeft: 'auto',
                marginRight: 'auto',
                paddingHorizontal: 20,
            },
        }),
    },
    header: {
        paddingTop: 16,
        paddingBottom: 10,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
    },
    subtitle: {
        marginTop: 4,
        fontSize: 13,
        color: colors.textMuted,
    },
    section: {
        paddingTop: 6,
        paddingBottom: 24,
        gap: 14,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.text,
    },
    subsectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: DESIGN_TOKENS.radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        gap: 12,
        ...Platform.select({
            web: {
                boxShadow: colors.boxShadows.light,
            },
            ios: {
                shadowColor: colors.shadows.light.shadowColor,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    profileHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    profileActions: {
        marginLeft: 'auto',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    profileAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    profileAvatarImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    refreshButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            web: {
                cursor: 'pointer',
            } as any,
        }),
    },
    cardIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardText: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
    },
    cardMeta: {
        marginTop: 2,
        fontSize: 12,
        color: colors.textMuted,
    },
    themeOptions: {
        gap: 10,
    },
    themeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    themeOptionActive: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    themeOptionPressed: {
        opacity: 0.9,
    },
    themeOptionIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    themeOptionIconActive: {
        backgroundColor: colors.surface,
    },
    themeOptionText: {
        flex: 1,
    },
    themeOptionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    themeOptionDescription: {
        marginTop: 2,
        fontSize: 12,
        color: colors.textMuted,
    },
    formGrid: {
        gap: 12,
        ...Platform.select({
            web: {
                flexDirection: 'row',
                flexWrap: 'wrap',
                columnGap: 12,
                rowGap: 12,
            } as any,
        }),
    },
    field: {
        gap: 6,
    },
    fieldHalf: {
        ...Platform.select({
            web: {
                flexBasis: 'calc(50% - 6px)' as any,
                flexGrow: 1,
                minWidth: 240,
            } as any,
        }),
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.text,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: colors.text,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 8,
    },
    avatarRow: {
        gap: 12,
        ...Platform.select({
            web: {
                flexDirection: 'row',
                alignItems: 'flex-end',
            } as any,
        }),
    },
    avatarField: {
        flex: 1,
        minWidth: 240,
        gap: 6,
    },
    avatarPickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
    },
    avatarPreview: {
        width: 64,
        height: 64,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarPreviewImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    avatarPickerButtons: {
        gap: 10,
        ...Platform.select({
            web: {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-start',
            } as any,
        }),
    },
    avatarButtonWeb: {
        minWidth: 160,
    },
    avatarAction: {
        ...Platform.select({
            web: {
                width: 180,
            },
        }),
    },
    dangerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.danger,
        backgroundColor: colors.surface,
    },
    dangerButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.danger,
    },
});
