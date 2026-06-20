import React, { useMemo } from 'react';
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
                    title="Войдите в аккаунт"
                    description="Войдите, чтобы посмотреть журнал безопасности."
                    action={{
                        label: 'Войти',
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
                    title="Журнал безопасности | Metravel"
                    description="История событий безопасности вашего аккаунта"
                    canonical={buildCanonicalUrl('/security-journal')}
                    robots="noindex, nofollow"
                />
            )}
            <ScrollView style={webTouchScrollStyle} contentContainerStyle={styles.scrollContent}>
                <View style={styles.pageContainer}>
                    <View style={styles.header}>
                        <View style={styles.headerRow}>
                            <View style={styles.headerTitleBlock}>
                                <Text style={styles.title}>Журнал безопасности</Text>
                                <Text style={styles.subtitle}>События вашего аккаунта</Text>
                            </View>
                            <Pressable
                                style={[styles.backToProfileButton, globalFocusStyles.focusable]}
                                onPress={() => router.back()}
                                accessibilityRole="button"
                                accessibilityLabel="Назад"
                                {...Platform.select({ web: { cursor: 'pointer' } })}
                            >
                                <Feather name="arrow-left" size={16} color={colors.primary} />
                                <Text style={styles.backToProfileButtonText}>Назад</Text>
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
