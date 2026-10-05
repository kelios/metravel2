import { useCallback, useMemo } from 'react';
import { View, Text, Pressable, Platform, ScrollView } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter, useIsFocused, type Href } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { buildLoginHref } from '@/utils/authNavigation';
import { goBackOrReplace } from '@/utils/backNavigation';
import EmptyState from '@/components/ui/EmptyState';
import StandaloneScreen from '@/components/layout/StandaloneScreen';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useThemedColors } from '@/hooks/useTheme';
import { webTouchScrollStyle } from '@/utils';
import { useScrollBottomPadding } from '@/components/layout/bottomChromeInset';
import { createSettingsStyles } from '@/components/screens/settings/settings.styles';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl } from '@/utils/seo';
import BlockedUsersList from '@/components/settings/BlockedUsersList';
import { translate as i18nT } from '@/i18n'


// #2134: Настройки → Приватность и данные → Заблокированные (Apple 1.2: список
// блокировок с разблокировкой). Каркас — как у app/privacy-settings.tsx.
export default function BlockedUsersScreen() {
    const router = useRouter();
    const isFocused = useIsFocused();
    const { isAuthenticated, authReady } = useAuth();
    const colors = useThemedColors();
    const dockPadding = useScrollBottomPadding(DESIGN_TOKENS.spacing.xxxl);
    const styles = useMemo(() => createSettingsStyles(colors, dockPadding), [colors, dockPadding]);

    // Экран открывается только из настроек — туда и возврат.
    const handleBackToSource = useCallback(() => {
        goBackOrReplace(router, '/settings');
        return true;
    }, [router]);

    useAndroidBackHandler(undefined, { resolveBack: handleBackToSource });

    if (authReady && !isAuthenticated) {
        return (
            <StandaloneScreen style={styles.container}>
                <EmptyState
                    density="full"
                    icon="lock"
                    title={i18nT('profile:app.blocked_users.loginTitle')}
                    description={i18nT('profile:app.blocked_users.loginDescription')}
                    action={{
                        label: i18nT('profile:app.blocked_users.loginAction'),
                        onPress: () =>
                            router.push(buildLoginHref({ redirect: '/blocked-users', intent: 'settings' }) as Href),
                    }}
                />
            </StandaloneScreen>
        );
    }

    return (
        <StandaloneScreen style={styles.container}>
            {isFocused && (
                <InstantSEO
                    headKey="blocked-users"
                    title={i18nT('profile:app.blocked_users.seoTitle')}
                    description={i18nT('profile:app.blocked_users.seoDescription')}
                    canonical={buildCanonicalUrl('/blocked-users')}
                    robots="noindex, nofollow"
                />
            )}
            <ScrollView style={webTouchScrollStyle} contentContainerStyle={styles.scrollContent}>
                <View style={styles.pageContainer}>
                    <View style={styles.header}>
                        <View style={styles.headerRow}>
                            <View style={styles.headerTitleBlock}>
                                <Text style={styles.title}>{i18nT('profile:app.blocked_users.title')}</Text>
                                <Text style={styles.subtitle}>{i18nT('profile:app.blocked_users.subtitle')}</Text>
                            </View>
                            <Pressable
                                style={[styles.backToProfileButton, globalFocusStyles.focusable]}
                                onPress={handleBackToSource}
                                accessibilityRole="button"
                                accessibilityLabel={i18nT('profile:app.blocked_users.back')}
                                {...Platform.select({ web: { cursor: 'pointer' } })}
                            >
                                <Feather name="arrow-left" size={16} color={colors.primaryDark} />
                                <Text style={styles.backToProfileButtonText}>{i18nT('profile:app.blocked_users.back')}</Text>
                            </Pressable>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <BlockedUsersList />
                    </View>
                </View>
            </ScrollView>
        </StandaloneScreen>
    );
}
