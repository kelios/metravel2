import { useMemo } from 'react';
import { View, Text, Pressable, Platform, ScrollView } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter, useIsFocused } from 'expo-router';
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
import SecurityJournalList from '@/components/settings/SecurityJournalList';
import { translate as i18nT } from '@/i18n'


export default function SecurityJournalScreen() {
    useAndroidBackHandler();
    const router = useRouter();
    const isFocused = useIsFocused();
    const { isAuthenticated, authReady } = useAuth();
    const colors = useThemedColors();
    const styles = useMemo(() => createSettingsStyles(colors), [colors]);

    if (authReady && !isAuthenticated) {
        return (
            <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
                <EmptyState
                    icon="shield"
                    title={i18nT('profile:app.security_journal.voydite_v_akkaunt_711b2a4a')}
                    description={i18nT('profile:app.security_journal.voydite_chtoby_posmotret_zhurnal_bezopasnost_64d43a76')}
                    action={{
                        label: i18nT('profile:app.security_journal.voyti_b31df6e4'),
                        onPress: () =>
                            router.push(buildLoginHref({ redirect: '/security-journal', intent: 'settings' }) as any),
                    }}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
            {isFocused && (
                <InstantSEO
                    headKey="security-journal"
                    title={i18nT('profile:app.security_journal.zhurnal_bezopasnosti_metravel_5eeea6db')}
                    description={i18nT('profile:app.security_journal.istoriya_sobytiy_bezopasnosti_vashego_akkaun_3c92b399')}
                    canonical={buildCanonicalUrl('/security-journal')}
                    robots="noindex, nofollow"
                />
            )}
            <ScrollView style={webTouchScrollStyle} contentContainerStyle={styles.scrollContent}>
                <View style={styles.pageContainer}>
                    <View style={styles.header}>
                        <View style={styles.headerRow}>
                            <View style={styles.headerTitleBlock}>
                                <Text style={styles.title}>{i18nT('profile:app.security_journal.zhurnal_bezopasnosti_2276b85a')}</Text>
                                <Text style={styles.subtitle}>{i18nT('profile:app.security_journal.sobytiya_vashego_akkaunta_3b4dcd0b')}</Text>
                            </View>
                            <Pressable
                                style={[styles.backToProfileButton, globalFocusStyles.focusable]}
                                onPress={() => router.back()}
                                accessibilityRole="button"
                                accessibilityLabel={i18nT('profile:app.security_journal.nazad_2e1d6be6')}
                                {...Platform.select({ web: { cursor: 'pointer' } })}
                            >
                                <Feather name="arrow-left" size={16} color={colors.primaryDark} />
                                <Text style={styles.backToProfileButtonText}>{i18nT('profile:app.security_journal.nazad_2e1d6be6')}</Text>
                            </Pressable>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <SecurityJournalList />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
