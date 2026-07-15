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
import { translate as i18nT } from '@/i18n'


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
                        <Image source={{ uri: optimizeImageUrl(profile.avatar, { width: 72, height: 72, quality: 70, format: 'auto', fit: 'cover' }) ?? profile.avatar }} style={styles.profileAvatarImage} resizeMode="cover" onError={() => setSettingsAvatarError(true)} />
                    ) : (
                        <Feather name="user" size={18} color={colors.primaryDark} />
                    )}
                </View>
                <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>{derivedDisplayName}</Text>
                    <Text style={styles.cardMeta}>{i18nT('profile:components.settings.ProfileSection.redaktirovanie_profilya_0977cd91')}</Text>
                </View>
                <View style={styles.profileActions}>
                    <Pressable
                        style={[styles.refreshButton, globalFocusStyles.focusable]}
                        onPress={loadProfile}
                        accessibilityRole="button"
                        accessibilityLabel={i18nT('profile:components.settings.ProfileSection.obnovit_profil_0ded90cf')}
                        disabled={profileLoading}
                        {...Platform.select({ web: { cursor: 'pointer' } })}
                    >
                        {profileLoading ? (
                            <ActivityIndicator size="small" color={colors.primaryDark} />
                        ) : (
                            <Feather name="refresh-cw" size={16} color={colors.primaryDark} />
                        )}
                    </Pressable>
                </View>
            </View>

            <View style={styles.formGrid}>
                <View style={[styles.field, styles.fieldHalf]}>
                    <Text style={styles.fieldLabel}>{i18nT('profile:components.settings.ProfileSection.imya_4adb74f5')}</Text>
                    <TextInput
                        value={firstName}
                        onChangeText={setFirstName}
                        style={styles.input}
                        placeholder={i18nT('profile:components.settings.ProfileSection.vvedite_imya_c75a7d42')}
                        placeholderTextColor={colors.textMuted}
                    />
                </View>
                <View style={[styles.field, styles.fieldHalf]}>
                    <Text style={styles.fieldLabel}>{i18nT('profile:components.settings.ProfileSection.familiya_e2b61636')}</Text>
                    <TextInput
                        value={lastName}
                        onChangeText={setLastName}
                        style={styles.input}
                        placeholder={i18nT('profile:components.settings.ProfileSection.vvedite_familiyu_4e0ecd8e')}
                        placeholderTextColor={colors.textMuted}
                    />
                </View>
            </View>

            <View style={styles.divider} />

            <Text style={styles.subsectionTitle}>{i18nT('profile:components.settings.ProfileSection.sotsialnye_seti_6037a0d9')}</Text>
            <View style={styles.formGrid}>
                <View style={[styles.field, styles.fieldHalf]}>
                    <Text style={styles.fieldLabel}>{i18nT('profile:components.settings.ProfileSection.youtube_29434c67')}</Text>
                    <TextInput
                        value={youtube}
                        onChangeText={setYoutube}
                        style={styles.input}
                        placeholder={i18nT('profile:components.settings.ProfileSection.ssylka_20804010')}
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                    />
                </View>
                <View style={[styles.field, styles.fieldHalf]}>
                    <Text style={styles.fieldLabel}>{i18nT('profile:components.settings.ProfileSection.instagram_d26e2d37')}</Text>
                    <TextInput
                        value={instagram}
                        onChangeText={setInstagram}
                        style={styles.input}
                        placeholder={i18nT('profile:components.settings.ProfileSection.ssylka_20804010')}
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                    />
                </View>
                <View style={[styles.field, styles.fieldHalf]}>
                    <Text style={styles.fieldLabel}>{i18nT('profile:components.settings.ProfileSection.twitter_8c8cc55b')}</Text>
                    <TextInput
                        value={twitter}
                        onChangeText={setTwitter}
                        style={styles.input}
                        placeholder={i18nT('profile:components.settings.ProfileSection.ssylka_20804010')}
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                    />
                </View>
                <View style={[styles.field, styles.fieldHalf]}>
                    <Text style={styles.fieldLabel}>{i18nT('profile:components.settings.ProfileSection.vk_97b4803e')}</Text>
                    <TextInput
                        value={vk}
                        onChangeText={setVk}
                        style={styles.input}
                        placeholder={i18nT('profile:components.settings.ProfileSection.ssylka_20804010')}
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                    />
                </View>
            </View>

            <Button
                label={profileSaving ? i18nT('profile:components.settings.ProfileSection.sohranenie_3c530238') : i18nT('profile:components.settings.ProfileSection.sohranit_808daff2')}
                onPress={handleSaveProfile}
                disabled={profileSaving || profileLoading || !hasUnsavedChanges}
                loading={profileSaving}
                fullWidth
                size="md"
            />

            <View style={styles.divider} />

            <Text style={styles.subsectionTitle}>{i18nT('profile:components.settings.ProfileSection.telegram_f725f4ca')}</Text>
            <View style={styles.field}>
                <View style={{ gap: 2 }}>
                    <Text style={styles.fieldLabel}>{i18nT('profile:components.settings.ProfileSection.username_v_telegram_b1a65ab0')}</Text>
                    {telegramVerified ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Feather name="check-circle" size={14} color={colors.success} />
                            <Text style={[styles.settingMeta, { color: colors.success, marginLeft: 4 }]}>
                                {i18nT('profile:components.settings.ProfileSection.verifitsirovan_a8f25e7e')}</Text>
                        </View>
                    ) : (
                        <Text style={styles.settingMeta}>{i18nT('profile:components.settings.ProfileSection.ne_podtverzhden_fba83da1')}</Text>
                    )}
                </View>
                <TextInput
                    value={telegramUsername}
                    onChangeText={setTelegramUsername}
                    style={styles.input}
                    placeholder={i18nT('profile:components.settings.ProfileSection.username_686d6882')}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    editable={!telegramBusy}
                />
            </View>

            <Button
                label={i18nT('profile:components.settings.ProfileSection.sohranit_telegram_feaf26df')}
                onPress={saveTelegramUsername}
                disabled={telegramBusy || !telegramUsernameDirty}
                variant="secondary"
                fullWidth
                size="sm"
            />

            {!telegramVerified ? (
                <View style={{ gap: 8, marginTop: 8 }}>
                    <Button
                        label={i18nT('profile:components.settings.ProfileSection.avtorizovat_cherez_telegram_7b2606d4')}
                        onPress={startTelegramAuth}
                        disabled={telegramBusy}
                        fullWidth
                        size="sm"
                    />
                    {telegramAwaitingConfirm ? (
                        <Button
                            label={i18nT('profile:components.settings.ProfileSection.ya_podtverdil_v_telegram_238debab')}
                            onPress={confirmTelegramAuth}
                            disabled={telegramBusy}
                            variant="secondary"
                            fullWidth
                            size="sm"
                        />
                    ) : null}
                </View>
            ) : null}

            <Text style={[styles.subsectionTitle, { marginTop: 16 }]}>{i18nT('profile:components.settings.ProfileSection.predpochitaemyy_messendzher_8ed5608e')}</Text>
            <View
                style={styles.themeOptions}
                accessibilityRole="radiogroup"
                accessibilityLabel={i18nT('profile:components.settings.ProfileSection.predpochitaemyy_messendzher_8ed5608e')}
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
                                <Feather name="check" size={16} color={colors.primaryDark} />
                            ) : null}
                        </Pressable>
                    );
                })}
            </View>

            <View style={styles.divider} />

            <Text style={styles.subsectionTitle}>{i18nT('profile:components.settings.ProfileSection.email_uvedomleniya_31af8993')}</Text>
            <View style={styles.settingsList}>
                <View style={styles.settingRow}>
                    <View style={styles.settingTextBlock}>
                        <Text style={styles.settingTitle}>{i18nT('profile:components.settings.ProfileSection.otzyvy_32290e8f')}</Text>
                        <Text style={styles.settingMeta}>{i18nT('profile:components.settings.ProfileSection.pisma_o_novyh_kommentariyah_k_vashim_puteshe_72c8e644')}</Text>
                    </View>
                    <Toggle
                        value={emailNotifyComments}
                        onValueChange={handleEmailNotifyCommentsChange}
                        disabled={profileLoading || profileSaving}
                    />
                </View>
                <View style={styles.settingRow}>
                    <View style={styles.settingTextBlock}>
                        <Text style={styles.settingTitle}>{i18nT('profile:components.settings.ProfileSection.soobscheniya_e84e24f0')}</Text>
                        <Text style={styles.settingMeta}>{i18nT('profile:components.settings.ProfileSection.pisma_o_novyh_lichnyh_soobscheniyah_538480ab')}</Text>
                    </View>
                    <Toggle
                        value={emailNotifyMessages}
                        onValueChange={handleEmailNotifyMessagesChange}
                        disabled={profileLoading || profileSaving}
                    />
                </View>
            </View>

            <View style={styles.divider} />

            <Text style={styles.subsectionTitle}>{i18nT('profile:components.settings.ProfileSection.avatar_ffe6816d')}</Text>
            <View style={styles.avatarRow}>
                <View style={styles.avatarField}>
                    <Text style={styles.fieldLabel}>{i18nT('profile:components.settings.ProfileSection.avatar_ffe6816d')}</Text>
                    <View style={styles.avatarPickerRow}>
                        <View style={styles.avatarPreview}>
                            {avatarPreviewUrl ? (
                                <Image source={{ uri: avatarPreviewUrl }} style={styles.avatarPreviewImage} resizeMode="cover" />
                            ) : (
                                <Feather name="image" size={18} color={colors.textMuted} />
                            )}
                        </View>
                        <View style={styles.avatarPickerButtons}>
                            <Button
                                label={i18nT('profile:components.settings.ProfileSection.vybrat_6ed9f43f')}
                                onPress={pickAvatar}
                                disabled={profileLoading || avatarSaving}
                                fullWidth={!isWeb}
                                variant="secondary"
                                size="sm"
                                style={isWeb ? styles.avatarButtonWeb : undefined}
                            />
                            <Button
                                label={avatarSaving ? i18nT('profile:components.settings.ProfileSection.zagruzka_fd7c25e7') : i18nT('profile:components.settings.ProfileSection.zagruzit_d1c4faba')}
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
                                    'aria-label': i18nT('profile:components.settings.ProfileSection.avatar_ffe6816d'),
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
