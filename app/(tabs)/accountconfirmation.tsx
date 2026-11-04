import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { Button, Card } from '@/ui/paper';
import { useIsFocused, useRouter } from 'expo-router';
import { confirmAccount } from '@/api/auth';
import { useAuth } from '@/context/AuthContext';
import { useThemedColors } from '@/hooks/useTheme';
import { useSecretLinkParam } from '@/hooks/useSecretLinkParam';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl } from '@/utils/seo';
import { useTranslation } from '@/i18n/LocaleProvider';
import { queueAnalyticsEvent } from '@/utils/analytics'
import { parseQuestHandoff } from '@/utils/questGuestHandoff'
import { staticRouteMetadata } from '@/utils/seoRoutes/routeMetadata'


export default function AccountConfirmation() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ hash: string; error: string | null } | null>(null);
    const isFocused = useIsFocused();
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Секрет уходит из адресной строки сразу после посадки (#2145).
    const hash = useSecretLinkParam('/accountconfirmation', 'hash');
    const router = useRouter();
    const { applyConfirmedAccountSession } = useAuth();
    const requestInFlight = useRef(false);
    const activeHash = useRef<string | null>(null);

    useEffect(() => {
        activeHash.current = isFocused ? hash : null;
        return () => { activeHash.current = null; };
    }, [hash, isFocused]);

    const confirm = async (approvedHash: string) => {
        if (requestInFlight.current || result?.hash === approvedHash) return;
        requestInFlight.current = true;
        setLoading(true);
        try {
            const response = await confirmAccount(approvedHash);
            const confirmedUserId = response.userId;
            if (!response.userToken || confirmedUserId == null || String(confirmedUserId).trim() === '') {
                setResult({
                    hash: approvedHash,
                    error: t('authStatic:accountConfirmation.failed', { details: (response as any)?.non_field_errors?.[0] ?? '' }),
                });
                return;
            }

            // The approved request can install credentials even if the route
            // changes while it runs. Keep the app identity in sync either way.
            applyConfirmedAccountSession({ userId: confirmedUserId, userName: response.userName });
            setResult({ hash: approvedHash, error: null });
            const questHandoff = parseQuestHandoff(response.quest_handoff);
            if (questHandoff) {
                queueAnalyticsEvent('quest_guest_progress_migrated', {
                    quest_id: questHandoff.questId,
                    answered: questHandoff.answered,
                    source: 'server_handoff',
                });
            }
            if (activeHash.current === approvedHash) {
                router.replace((questHandoff?.redirectPath ?? '/') as never);
            }
        } catch (error) {
            setResult({
                hash: approvedHash,
                error: t('authStatic:accountConfirmation.error', { details: error instanceof Error ? error.message : '' }),
            });
        } finally {
            requestInFlight.current = false;
            setLoading(false);
        }
    };

    const currentError = hash === ''
        ? t('auth:app.tabs.accountconfirmation.ssylka_podtverzhdeniya_nedeystvitelna_ili_us_529ee053')
        : hash === result?.hash ? result.error : null;

    return (
        <View style={styles.container}>
            {isFocused && (
                <InstantSEO
                    headKey="account-confirmation"
                    title={t('auth:app.tabs.accountconfirmation.podtverzhdenie_akkaunta_metravel_61934574')}
                    description={t('auth:app.tabs.accountconfirmation.podtverzhdenie_uchetnoy_zapisi_0b22626c')}
                    canonical={buildCanonicalUrl('/accountconfirmation')}
                    robots="noindex, nofollow"
                />
            )}
            <Image
                source={require('@/assets/images/media/slider/about.jpg')}
                style={styles.backgroundImage}
                resizeMode="cover"
            />
            <View style={styles.backgroundScrim} />
            <View style={styles.contentContainer}>
                <Card style={styles.card}>
                    {hash === null || loading ? (
                        <ActivityIndicator size="large" color={colors.primaryDark} />
                    ) : currentError ? (
                        <View>
                            <Text style={styles.errorText}>{currentError}</Text>
                            <Button
                                mode="contained"
                                onPress={() => router.replace('/')}
                                style={styles.button}
                                contentStyle={styles.buttonContent}
                            >
                                {t('auth:app.tabs.accountconfirmation.na_glavnuyu_80e75d20')}</Button>
                        </View>
                    ) : hash && hash !== result?.hash ? (
                        <View>
                            <Text style={styles.confirmationText}>{t('authStatic:accountConfirmation.signInNotice')}</Text>
                            <Button
                                mode="contained"
                                onPress={() => void confirm(hash)}
                                style={styles.button}
                                contentStyle={styles.buttonContent}
                            >
                                {t('authStatic:accountConfirmation.confirmAndSignIn')}
                            </Button>
                        </View>
                    ) : (
                        <Text style={styles.successText}>{t('auth:app.tabs.accountconfirmation.uchetnaya_zapis_uspeshno_podtverzhdena_cf1db801')}</Text>
                    )}
                </Card>
            </View>
        </View>
    );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    backgroundImage: {
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
    },
    backgroundScrim: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    contentContainer: {
        width: '90%',
        maxWidth: 480,
        position: 'absolute',
        top: '30%',
        alignItems: 'center',
    },
    card: {
        width: '100%',
        padding: 20,
        borderRadius: 8,
        backgroundColor: colors.surface,
        ...colors.shadows.medium,
    },
    confirmationText: {
        color: colors.text,
        marginBottom: 20,
        textAlign: 'center',
    },
    errorText: {
        color: colors.dangerDark,
        marginBottom: 20,
        textAlign: 'center',
    },
    successText: {
        color: colors.success,
        marginBottom: 20,
        textAlign: 'center',
        fontWeight: 'bold',
    },
    button: {
        backgroundColor: colors.primary,
        borderRadius: 5,
    },
    buttonContent: {
        paddingVertical: 10,
    },
});

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); значения — общая таблица
// utils/seoRoutes/staticRoutes.js, та же, что у SSG-генератора.
export function generateMetadata() {
  return staticRouteMetadata('/accountconfirmation')
}
