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
import { useResponsive } from '@/hooks/useResponsive';
import { Theme, useTheme, useThemedColors } from '@/hooks/useTheme';
import { showToast } from '@/utils/toast';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl } from '@/utils/seo';
import { useIsFocused } from 'expo-router';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { getAppVersionInfo, webTouchScrollStyle } from '@/utils';
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
import AppVersionSection from '@/components/settings/AppVersionSection';
import LanguageSection from '@/components/settings/LanguageSection';
import { translate as i18nT } from '@/i18n'


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
    const { isMobile, isHydrated } = useResponsive();
    // На мобильном web стики-бар (HeaderContextBar) уже показывает «← Настройки» —
    // страничный заголовок с кнопкой «Назад» дублировал бы его; оставляем только desktop.
    const showPageHeader = isWeb && !(isHydrated && isMobile);
    const favoritesContext = useFavorites();
    const { theme, setTheme } = useTheme();
    const colors = useThemedColors();
    const styles = useMemo(() => createSettingsStyles(colors), [colors]);
    const appVersionInfo = useMemo(() => getAppVersionInfo(), []);
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
                label: i18nT('profile:app.tabs.settings.svetlaya_5011d52d'),
                description: i18nT('profile:app.tabs.settings.po_umolchaniyu_70591a06'),
                icon: 'sun' as const,
            },
            {
                value: 'dark' as Theme,
                label: i18nT('profile:app.tabs.settings.temnaya_f8f50e31'),
                description: i18nT('profile:app.tabs.settings.komfortno_v_temnote_cdb57379'),
                icon: 'moon' as const,
            },
            {
                value: 'auto' as Theme,
                label: i18nT('profile:app.tabs.settings.sistemnaya_c4a54d45'),
                description: i18nT('profile:app.tabs.settings.sledovat_nastroykam_ustroystva_3f8a9b61'),
                icon: 'smartphone' as const,
            },
        ],
        []
    );

    const messengerOptions = useMemo(
        () => [
            { value: 'telegram' as const, label: i18nT('profile:app.tabs.settings.telegram_d271f81b') },
            { value: 'whatsapp' as const, label: i18nT('profile:app.tabs.settings.whatsapp_b09b7709') },
            { value: 'other' as const, label: i18nT('profile:app.tabs.settings.drugoy_8bd505f6') },
        ],
        []
    );

    const handleDeleteAccount = useCallback(async () => {
        try {
            const confirmed = await confirmAction({
                title: i18nT('profile:app.tabs.settings.udalit_akkaunt_bb9a5af4'),
                message: i18nT('profile:app.tabs.settings.akkaunt_i_vashi_puteshestviya_budut_udaleny__4fb3eb8e'),
                confirmText: i18nT('profile:app.tabs.settings.udalit_67c7c30f'),
                cancelText: i18nT('profile:app.tabs.settings.otmena_0a594e8d'),
            });
            if (!confirmed) return;

            await deleteCurrentUserAccount();
            await logout();
            showToast({ type: 'success', text1: i18nT('profile:app.tabs.settings.akkaunt_udalen_faef461b'), visibilityTime: 3000 });
            router.replace('/login');
        } catch (error) {
            const message = error instanceof ApiError ? error.message : i18nT('profile:app.tabs.settings.ne_udalos_udalit_akkaunt_18ea0cfd');
            showToast({ type: 'error', text1: i18nT('profile:app.tabs.settings.oshibka_54cdc7a4'), text2: message, visibilityTime: 4000 });
        }
    }, [logout, router]);

    const handleLogout = useCallback(async () => {
        try {
            const confirmed = await confirmAction({
                title: i18nT('profile:app.tabs.settings.vyhod_iz_akkaunta_001b3d7a'),
                message: i18nT('profile:app.tabs.settings.vyyti_iz_akkaunta_6cb6575a'),
                confirmText: i18nT('profile:app.tabs.settings.vyyti_63a0b3ce'),
                cancelText: i18nT('profile:app.tabs.settings.otmena_0a594e8d'),
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
                title: i18nT('profile:app.tabs.settings.ochistit_istoriyu_6ea9b985'),
                message: i18nT('profile:app.tabs.settings.ochistit_istoriyu_prosmotrov_c3bd1dea'),
                confirmText: i18nT('profile:app.tabs.settings.ochistit_7b65714a'),
                cancelText: i18nT('profile:app.tabs.settings.otmena_0a594e8d'),
            });
            if (!confirmed) return;

            await clearHistory();
            showToast({ type: 'success', text1: i18nT('profile:app.tabs.settings.istoriya_ochischena_c41440c0'), visibilityTime: 2000 });
        } catch (error) {
            console.error('Error clearing history:', error);
            showToast({ type: 'error', text1: i18nT('profile:app.tabs.settings.oshibka_54cdc7a4'), text2: i18nT('profile:app.tabs.settings.ne_udalos_ochistit_istoriyu_213a57c4'), visibilityTime: 3000 });
        }
    }, [clearHistory]);

    const handleClearFavorites = useCallback(async () => {
        try {
            if (typeof clearFavorites !== 'function') return;

            const confirmed = await confirmAction({
                title: i18nT('profile:app.tabs.settings.ochistit_hochu_poehat_dbb86f70'),
                message: i18nT('profile:app.tabs.settings.ochistit_hochu_poehat_92eed92a'),
                confirmText: i18nT('profile:app.tabs.settings.ochistit_7b65714a'),
                cancelText: i18nT('profile:app.tabs.settings.otmena_0a594e8d'),
            });
            if (!confirmed) return;

            await clearFavorites();
            showToast({ type: 'success', text1: i18nT('profile:app.tabs.settings.hochu_poehat_ochischen_24932af0'), visibilityTime: 2000 });
        } catch (error) {
            console.error('Error clearing favorites:', error);
            showToast({ type: 'error', text1: i18nT('profile:app.tabs.settings.oshibka_54cdc7a4'), text2: i18nT('profile:app.tabs.settings.ne_udalos_ochistit_hochu_poehat_d7481335'), visibilityTime: 3000 });
        }
    }, [clearFavorites]);

    const handleBackToProfile = useCallback(() => {
        router.back();
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
                    title={i18nT('profile:app.tabs.settings.voydite_v_akkaunt_d3790281')}
                    description={i18nT('profile:app.tabs.settings.voydite_chtoby_upravlyat_nastroykami_i_danny_d8ac08ea')}
                    action={{
                        label: i18nT('profile:app.tabs.settings.voyti_41ef2155'),
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
                    title={i18nT('profile:app.tabs.settings.nastroyki_metravel_4f02399c')}
                    description={i18nT('profile:app.tabs.settings.nastroyki_akkaunta_f3ca340a')}
                    canonical={buildCanonicalUrl('/settings')}
                    robots="noindex, nofollow"
                />
            )}
            <ScrollView style={webTouchScrollStyle} contentContainerStyle={styles.scrollContent}>
                <View style={styles.pageContainer}>
                    {/* На native заголовок «Настройки» и кнопка «Назад» уже есть в нативной шапке экрана,
                        на мобильном web — в стики-баре HeaderContextBar; не дублируем */}
                    {showPageHeader && (
                        <View style={styles.header}>
                            <View style={styles.headerRow}>
                                <View style={styles.headerTitleBlock}>
                                    <Text style={styles.title}>{i18nT('profile:app.tabs.settings.nastroyki_bc351c51')}</Text>
                                </View>
                                <Pressable
                                    style={[styles.backToProfileButton, globalFocusStyles.focusable]}
                                    onPress={handleBackToProfile}
                                    accessibilityRole="button"
                                    accessibilityLabel={i18nT('profile:app.tabs.settings.nazad_5e0a7fb4')}
                                    {...Platform.select({ web: { cursor: 'pointer' } })}
                                >
                                    <Feather name="arrow-left" size={16} color={colors.primaryDark} />
                                    <Text style={styles.backToProfileButtonText}>{i18nT('profile:app.tabs.settings.nazad_5e0a7fb4')}</Text>
                                </Pressable>
                            </View>
                        </View>
                    )}

                    <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{i18nT('profile:app.tabs.settings.profil_e0a36973')}</Text>

                    <ProfileSection
                        styles={styles}
                        colors={colors}
                        isWeb={isWeb}
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

                    <Text style={styles.sectionTitle}>{i18nT('common:language.settingTitle')}</Text>

                    <LanguageSection styles={styles} colors={colors} />

                    <Text style={styles.sectionTitle}>{i18nT('profile:app.tabs.settings.tema_920e1112')}</Text>

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
                            <Text style={styles.sectionTitle}>{i18nT('profile:app.tabs.settings.bezopasnost_e58cbb03')}</Text>
                            <BiometricSection styles={styles} colors={colors} biometric={biometric} />
                        </>
                    ) : null}

                    {STRAVA_SETTINGS_ENABLED ? <StravaSettingsSection /> : null}

                    <Text style={styles.sectionTitle}>{i18nT('profile:app.tabs.settings.soobscheniya_79276690')}</Text>

                    <NavCardSection
                        styles={styles}
                        colors={colors}
                        icon="mail"
                        title={i18nT('profile:app.tabs.settings.lichnye_soobscheniya_478df083')}
                        meta={i18nT('profile:app.tabs.settings.perepiska_s_avtorami_puteshestviy_07268df1')}
                        accessibilityLabel={i18nT('profile:app.tabs.settings.pereyti_k_soobscheniyam_86385403')}
                        onPress={() => router.push('/messages' as any)}
                    />

                    <Text style={styles.sectionTitle}>{i18nT('profile:app.tabs.settings.privatnost_i_dannye_1e79e641')}</Text>

                    <NavCardSection
                        styles={styles}
                        colors={colors}
                        icon="eye"
                        title={i18nT('profile:app.tabs.settings.nastroyki_privatnosti_9f69f2ff')}
                        meta={i18nT('profile:app.tabs.settings.kto_vidit_vashi_puteshestviya_marshruty_i_ko_5154416c')}
                        accessibilityLabel={i18nT('profile:app.tabs.settings.nastroyki_privatnosti_9f69f2ff')}
                        onPress={() => router.push('/privacy-settings' as any)}
                    />

                    <DataOwnershipSection />

                    <NavCardSection
                        styles={styles}
                        colors={colors}
                        icon="shield"
                        title={i18nT('profile:app.tabs.settings.zhurnal_bezopasnosti_90168d71')}
                        meta={i18nT('profile:app.tabs.settings.istoriya_vhodov_i_deystviy_s_akkauntom_e7295184')}
                        accessibilityLabel={i18nT('profile:app.tabs.settings.zhurnal_bezopasnosti_90168d71')}
                        onPress={() => router.push('/security-journal' as any)}
                    />

                    <Text style={styles.sectionTitle}>{i18nT('profile:app.tabs.settings.akkaunt_72bc7b11')}</Text>

                    <AccountSection
                        styles={styles}
                        colors={colors}
                        username={username}
                        handleLogout={handleLogout}
                        handleDeleteAccount={handleDeleteAccount}
                    />

                    <Text style={styles.sectionTitle}>{i18nT('profile:app.tabs.settings.dannye_f2b03773')}</Text>

                    <DataManagementSection
                        styles={styles}
                        colors={colors}
                        favorites={favorites}
                        viewHistory={viewHistory}
                        handleClearFavorites={handleClearFavorites}
                        handleClearHistory={handleClearHistory}
                    />

                    <Text style={styles.sectionTitle}>{i18nT('profile:app.tabs.settings.prilozhenie_853a0313')}</Text>

                    <AppVersionSection
                        styles={styles}
                        colors={colors}
                        versionInfo={appVersionInfo}
                    />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
