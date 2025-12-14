import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable, Platform, ScrollView, TextInput, ActivityIndicator, Alert, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import EmptyState from '@/components/EmptyState';
import Button from '@/components/ui/Button';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { confirmAction } from '@/src/utils/confirmAction';
import { fetchUserProfile, updateUserProfile, uploadUserProfileAvatarFile, type UpdateUserProfilePayload, type UploadUserProfileAvatarFile, type UserProfileDto } from '@/src/api/user';
import { ApiError } from '@/src/api/client';

export default function SettingsScreen() {
    const router = useRouter();
    const { isAuthenticated, logout, username, userId } = useAuth();
    const favoritesContext = typeof useFavorites === 'function' ? useFavorites() : ({} as any);
    const { clearHistory, clearFavorites, favorites, viewHistory } = favoritesContext as any;

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
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Не удалось загрузить профиль';
            Alert.alert('Ошибка', message);
        } finally {
            setProfileLoading(false);
        }
    }, [cleanText, userId]);

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
            Alert.alert('Готово', 'Профиль обновлён');
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Не удалось обновить профиль';
            Alert.alert('Ошибка', message);
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
                Alert.alert('Разрешение', 'Нужен доступ к галерее');
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
        } catch (error) {
            Alert.alert('Ошибка', 'Не удалось выбрать изображение');
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
            Alert.alert('Ошибка', 'Сначала выберите изображение');
            return;
        }

        setAvatarSaving(true);
        try {
            const saved = await uploadUserProfileAvatarFile(userId, avatarFile);
            setProfile(saved);
            setAvatarPreviewUrl(saved.avatar || avatarPreviewUrl);
            setAvatarFile(null);
            Alert.alert('Готово', 'Аватар обновлён');
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Не удалось обновить аватар';
            Alert.alert('Ошибка', message);
        } finally {
            setAvatarSaving(false);
        }
    }, [avatarFile, avatarPreviewUrl, userId]);

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
        } catch (error) {
            console.error('Error clearing history:', error);
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
        } catch (error) {
            console.error('Error clearing favorites:', error);
        }
    }, [clearFavorites]);

    if (!isAuthenticated) {
        return (
            <SafeAreaView style={styles.container}>
                <EmptyState
                    icon="settings"
                    title="Войдите в аккаунт"
                    description="Войдите, чтобы управлять настройками и данными аккаунта."
                    action={{
                        label: 'Войти',
                        onPress: () => router.push('/login'),
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
                                {profile?.avatar ? (
                                    <Image source={{ uri: profile.avatar }} style={styles.profileAvatarImage} />
                                ) : (
                                    <Feather name="user" size={18} color={DESIGN_TOKENS.colors.primary} />
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
                                        <ActivityIndicator size="small" color={DESIGN_TOKENS.colors.primary} />
                                    ) : (
                                        <Feather name="refresh-cw" size={16} color={DESIGN_TOKENS.colors.primary} />
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
                                    placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
                                />
                            </View>
                            <View style={[styles.field, styles.fieldHalf]}>
                                <Text style={styles.fieldLabel}>Фамилия</Text>
                                <TextInput
                                    value={lastName}
                                    onChangeText={setLastName}
                                    style={styles.input}
                                    placeholder="Введите фамилию"
                                    placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
                                />
                            </View>
                            <View style={[styles.field, styles.fieldHalf]}>
                                <Text style={styles.fieldLabel}>YouTube</Text>
                                <TextInput
                                    value={youtube}
                                    onChangeText={setYoutube}
                                    style={styles.input}
                                    placeholder="Ссылка"
                                    placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
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
                                    placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
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
                                    placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
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
                                    placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>

                        <Button
                            label={profileSaving ? 'Сохранение…' : 'Сохранить'}
                            onPress={handleSaveProfile}
                            disabled={profileSaving || profileLoading}
                            loading={profileSaving}
                            fullWidth
                            size="md"
                        />

                        <View style={styles.divider} />

                        <View style={styles.avatarRow}>
                            <View style={styles.avatarField}>
                                <Text style={styles.fieldLabel}>Аватар</Text>
                                <View style={styles.avatarPickerRow}>
                                    <View style={styles.avatarPreview}>
                                        {avatarPreviewUrl ? (
                                            <Image source={{ uri: avatarPreviewUrl }} style={styles.avatarPreviewImage} />
                                        ) : (
                                            <Feather name="image" size={18} color={DESIGN_TOKENS.colors.textMuted} />
                                        )}
                                    </View>
                                    <View style={styles.avatarPickerButtons}>
                                        <Button
                                            label="Выбрать"
                                            onPress={handlePickAvatar}
                                            disabled={profileLoading || avatarSaving}
                                            fullWidth
                                            variant="secondary"
                                            size="sm"
                                        />
                                        <Button
                                            label={avatarSaving ? 'Загрузка…' : 'Загрузить'}
                                            onPress={handleUploadAvatar}
                                            disabled={profileLoading || avatarSaving || !avatarFile}
                                            loading={avatarSaving}
                                            fullWidth
                                            size="sm"
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

                    <Text style={styles.sectionTitle}>Аккаунт</Text>

                    <View style={styles.card}>
                        <View style={styles.cardRow}>
                            <View style={styles.cardIcon}>
                                <Feather name="user" size={18} color={DESIGN_TOKENS.colors.primary} />
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
                            <Feather name="log-out" size={18} color={DESIGN_TOKENS.colors.danger} />
                            <Text style={styles.dangerButtonText}>Выйти</Text>
                        </Pressable>
                    </View>

                    <Text style={styles.sectionTitle}>Данные</Text>

                    <View style={styles.card}>
                        <View style={styles.cardRow}>
                            <View style={styles.cardIcon}>
                                <Feather name="heart" size={18} color={DESIGN_TOKENS.colors.primary} />
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
                            <Feather name="trash-2" size={18} color={DESIGN_TOKENS.colors.danger} />
                            <Text style={styles.dangerButtonText}>Очистить избранное</Text>
                        </Pressable>
                    </View>

                    <View style={styles.card}>
                        <View style={styles.cardRow}>
                            <View style={styles.cardIcon}>
                                <Feather name="clock" size={18} color={DESIGN_TOKENS.colors.primary} />
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
                            <Feather name="trash-2" size={18} color={DESIGN_TOKENS.colors.danger} />
                            <Text style={styles.dangerButtonText}>Очистить историю</Text>
                        </Pressable>
                    </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: DESIGN_TOKENS.colors.mutedBackground,
    },
    scrollContent: {
        paddingBottom: 24,
    },
    pageContainer: {
        width: '100%',
        paddingHorizontal: 16,
        ...Platform.select({
            web: {
                maxWidth: 920,
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
        color: DESIGN_TOKENS.colors.text,
    },
    subtitle: {
        marginTop: 4,
        fontSize: 13,
        color: DESIGN_TOKENS.colors.textMuted,
    },
    section: {
        paddingHorizontal: 16,
        paddingTop: 6,
        paddingBottom: 24,
        gap: 12,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.text,
    },
    card: {
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderRadius: DESIGN_TOKENS.radii.lg,
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        padding: 14,
        gap: 12,
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
        backgroundColor: DESIGN_TOKENS.colors.primarySoft,
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
        borderColor: DESIGN_TOKENS.colors.border,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            web: {
                cursor: 'pointer',
            },
        }),
    },
    cardIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: DESIGN_TOKENS.colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardText: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.text,
    },
    cardMeta: {
        marginTop: 2,
        fontSize: 12,
        color: DESIGN_TOKENS.colors.textMuted,
    },
    formGrid: {
        gap: 12,
        ...Platform.select({
            web: {
                flexDirection: 'row',
                flexWrap: 'wrap',
                columnGap: 12,
                rowGap: 12,
            },
        }),
    },
    field: {
        gap: 6,
    },
    fieldHalf: {
        ...Platform.select({
            web: {
                flexBasis: 'calc(50% - 6px)',
                flexGrow: 1,
                minWidth: 240,
            },
        }),
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.text,
    },
    input: {
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: DESIGN_TOKENS.colors.text,
    },
    divider: {
        height: 1,
        backgroundColor: DESIGN_TOKENS.colors.border,
        marginVertical: 8,
    },
    avatarRow: {
        gap: 12,
        ...Platform.select({
            web: {
                flexDirection: 'row',
                alignItems: 'flex-end',
            },
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
        borderColor: DESIGN_TOKENS.colors.border,
        backgroundColor: DESIGN_TOKENS.colors.surface,
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
        flex: 1,
        gap: 10,
        ...Platform.select({
            web: {
                flexDirection: 'row',
                alignItems: 'center',
            },
        }),
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
        borderColor: DESIGN_TOKENS.colors.danger,
        backgroundColor: DESIGN_TOKENS.colors.surface,
    },
    dangerButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: DESIGN_TOKENS.colors.danger,
    },
});
