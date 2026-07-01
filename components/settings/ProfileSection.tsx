import React from 'react';
import { View, Text, Pressable, Platform, TextInput, ActivityIndicator, Image } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import Button from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { globalFocusStyles } from '@/styles/globalFocus';
import { optimizeImageUrl } from '@/utils/imageOptimization';
import type { useThemedColors } from '@/hooks/useTheme';
import type { createSettingsStyles } from '@/components/screens/settings/settings.styles';
import type { PreferredMessenger } from '@/api/telegramLink';

type Colors = ReturnType<typeof useThemedColors>;
type Styles = ReturnType<typeof createSettingsStyles>;

interface MessengerOption {
    value: PreferredMessenger;
    label: string;
}

interface ProfileSectionProps {
    styles: Styles;
    colors: Colors;
    isWeb: boolean;
    username?: string | null;
    profile: { avatar?: string | null } | null | undefined;
    profileLoading: boolean;
    loadProfile: () => void;
    settingsAvatarError: boolean;
    setSettingsAvatarError: (value: boolean) => void;
    derivedDisplayName: string;
    firstName: string;
    setFirstName: (value: string) => void;
    lastName: string;
    setLastName: (value: string) => void;
    youtube: string;
    setYoutube: (value: string) => void;
    instagram: string;
    setInstagram: (value: string) => void;
    twitter: string;
    setTwitter: (value: string) => void;
    vk: string;
    setVk: (value: string) => void;
    profileSaving: boolean;
    hasUnsavedChanges: boolean;
    handleSaveProfile: () => void;
    telegramUsername: string;
    setTelegramUsername: (value: string) => void;
    telegramVerified: boolean;
    telegramBusy: boolean;
    telegramUsernameDirty: boolean;
    telegramAwaitingConfirm: boolean;
    saveTelegramUsername: () => void;
    startTelegramAuth: () => void;
    confirmTelegramAuth: () => void;
    preferredMessenger: PreferredMessenger | null;
    changePreferredMessenger: (next: PreferredMessenger) => void;
    messengerOptions: MessengerOption[];
    emailNotifyComments: boolean;
    emailNotifyMessages: boolean;
    handleEmailNotifyCommentsChange: (value: boolean) => void;
    handleEmailNotifyMessagesChange: (value: boolean) => void;
    avatarPreviewUrl: string;
    avatarFile: unknown;
    avatarSaving: boolean;
    pickAvatar: () => void;
    uploadAvatar: () => void;
    handleWebFileSelected: (event: any) => void;
    webFileInputRef: React.Ref<any>;
}

export default function ProfileSection({
    styles,
    colors,
    isWeb,
    username,
    profile,
    profileLoading,
    loadProfile,
    settingsAvatarError,
    setSettingsAvatarError,
    derivedDisplayName,
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
    profileSaving,
    hasUnsavedChanges,
    handleSaveProfile,
    telegramUsername,
    setTelegramUsername,
    telegramVerified,
    telegramBusy,
    telegramUsernameDirty,
    telegramAwaitingConfirm,
    saveTelegramUsername,
    startTelegramAuth,
    confirmTelegramAuth,
    preferredMessenger,
    changePreferredMessenger,
    messengerOptions,
    emailNotifyComments,
    emailNotifyMessages,
    handleEmailNotifyCommentsChange,
    handleEmailNotifyMessagesChange,
    avatarPreviewUrl,
    avatarFile,
    avatarSaving,
    pickAvatar,
    uploadAvatar,
    handleWebFileSelected,
    webFileInputRef,
}: ProfileSectionProps) {
    return (
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

            <Text style={styles.subsectionTitle}>Telegram</Text>
            <View style={styles.field}>
                <View style={{ gap: 2 }}>
                    <Text style={styles.fieldLabel}>Username в Telegram</Text>
                    {telegramVerified ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Feather name="check-circle" size={14} color={colors.success} />
                            <Text style={[styles.settingMeta, { color: colors.success, marginLeft: 4 }]}>
                                верифицирован
                            </Text>
                        </View>
                    ) : (
                        <Text style={styles.settingMeta}>не подтверждён</Text>
                    )}
                </View>
                <TextInput
                    value={telegramUsername}
                    onChangeText={setTelegramUsername}
                    style={styles.input}
                    placeholder="@username"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    editable={!telegramBusy}
                />
            </View>

            <Button
                label="Сохранить Telegram"
                onPress={saveTelegramUsername}
                disabled={telegramBusy || !telegramUsernameDirty}
                variant="secondary"
                fullWidth
                size="sm"
            />

            {!telegramVerified ? (
                <View style={{ gap: 8, marginTop: 8 }}>
                    <Button
                        label="Авторизовать через Telegram"
                        onPress={startTelegramAuth}
                        disabled={telegramBusy}
                        fullWidth
                        size="sm"
                    />
                    {telegramAwaitingConfirm ? (
                        <Button
                            label="Я подтвердил в Telegram"
                            onPress={confirmTelegramAuth}
                            disabled={telegramBusy}
                            variant="secondary"
                            fullWidth
                            size="sm"
                        />
                    ) : null}
                </View>
            ) : null}

            <Text style={[styles.subsectionTitle, { marginTop: 16 }]}>Предпочитаемый мессенджер</Text>
            <View
                style={styles.themeOptions}
                accessibilityRole="radiogroup"
                accessibilityLabel="Предпочитаемый мессенджер"
            >
                {messengerOptions.map((option) => {
                    const isSelected = preferredMessenger === option.value;
                    return (
                        <Pressable
                            key={option.value}
                            onPress={() => changePreferredMessenger(option.value)}
                            disabled={telegramBusy}
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
                            <View style={styles.themeOptionText}>
                                <Text style={styles.themeOptionTitle}>{option.label}</Text>
                            </View>
                            {isSelected ? (
                                <Feather name="check" size={16} color={colors.primary} />
                            ) : null}
                        </Pressable>
                    );
                })}
            </View>

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
    );
}
