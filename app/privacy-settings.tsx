import { useCallback, useMemo } from 'react';
import { View, Text, Pressable, Platform, ScrollView } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter, useIsFocused, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { buildLoginHref } from '@/utils/authNavigation';
import EmptyState from '@/components/ui/EmptyState';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useThemedColors } from '@/hooks/useTheme';
import { webTouchScrollStyle } from '@/utils';
import { createSettingsStyles } from '@/components/screens/settings/settings.styles';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl } from '@/utils/seo';
import PrivacySettingsMatrix from '@/components/settings/PrivacySettingsMatrix';
import { translate as i18nT } from '@/i18n'


export default function PrivacySettingsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ from?: string }>();
    const isFocused = useIsFocused();
    const { isAuthenticated, authReady } = useAuth();
    const colors = useThemedColors();
    const styles = useMemo(() => createSettingsStyles(colors), [colors]);
    const cameFromProfile = params.from === 'profile';

    const handleBackToSource = useCallback(() => {
        if (cameFromProfile) {
            router.replace('/profile' as any);
            return true;
        }

        if (router.canGoBack()) {
            router.back();
            return true;
        }

        router.replace('/profile' as any);
        return true;
    }, [cameFromProfile, router]);

    useAndroidBackHandler(undefined, { resolveBack: handleBackToSource });

    if (authReady && !isAuthenticated) {
        return (
            <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
                <EmptyState
                    icon="lock"
                    title={i18nT('profile:app.privacy_settings.voydite_v_akkaunt_df01412b')}
                    description={i18nT('profile:app.privacy_settings.voydite_chtoby_upravlyat_nastroykami_privatn_676e455e')}
                    action={{
                        label: i18nT('profile:app.privacy_settings.voyti_a507295a'),
                        onPress: () =>
                            router.push(buildLoginHref({ redirect: '/privacy-settings', intent: 'settings' }) as any),
                    }}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
            {isFocused && (
                <InstantSEO
                    headKey="privacy-settings"
                    title={i18nT('profile:app.privacy_settings.nastroyki_privatnosti_metravel_8e4a01fc')}
                    description={i18nT('profile:app.privacy_settings.upravlenie_vidimostyu_vashego_kontenta_2bc82426')}
                    canonical={buildCanonicalUrl('/privacy-settings')}
                    robots="noindex, nofollow"
                />
            )}
            <ScrollView style={webTouchScrollStyle} contentContainerStyle={styles.scrollContent}>
                <View style={styles.pageContainer}>
                    <View style={styles.header}>
                        <View style={styles.headerRow}>
                            <View style={styles.headerTitleBlock}>
                                <Text style={styles.title}>{i18nT('profile:app.privacy_settings.privatnost_abbf5093')}</Text>
                                <Text style={styles.subtitle}>{i18nT('profile:app.privacy_settings.kto_vidit_vash_kontent_6ccfac25')}</Text>
                            </View>
                            <Pressable
                                style={[styles.backToProfileButton, globalFocusStyles.focusable]}
                                onPress={handleBackToSource}
                                accessibilityRole="button"
                                accessibilityLabel={i18nT('profile:app.privacy_settings.nazad_577dbd9b')}
                                {...Platform.select({ web: { cursor: 'pointer' } })}
                            >
                                <Feather name="arrow-left" size={16} color={colors.primaryDark} />
                                <Text style={styles.backToProfileButtonText}>{i18nT('profile:app.privacy_settings.nazad_577dbd9b')}</Text>
                            </Pressable>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <PrivacySettingsMatrix />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
