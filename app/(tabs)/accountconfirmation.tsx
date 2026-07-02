import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { Button, Card } from '@/ui/paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { confirmAccount } from '@/api/auth';
import { useAuth } from '@/context/AuthContext';
import { useThemedColors } from '@/hooks/useTheme';
import { useIsFocused } from 'expo-router';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl } from '@/utils/seo';

export default function AccountConfirmation() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const isFocused = useIsFocused();
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const { hash } = useLocalSearchParams(); // ✅ заменили useRoute
    const router = useRouter();              // ✅ заменили useNavigation
    const { setIsAuthenticated } = useAuth();
    const confirmedHashRef = useRef<string | null>(null);

    useEffect(() => {
        const hashStr = Array.isArray(hash) ? hash[0] : hash;
        if (!hashStr) {
            // Нет/невалидный hash — не оставляем бесконечный спиннер.
            setError('Ссылка подтверждения недействительна или устарела.');
            setLoading(false);
            return;
        }
        // Токен подтверждения одноразовый: не вызываем confirmAccount повторно
        // (StrictMode double-invoke / нестабильный router в deps).
        if (confirmedHashRef.current === hashStr) return;
        confirmedHashRef.current = hashStr;

        let active = true;
        const confirm = async () => {
            try {
                const response = await confirmAccount(hashStr);
                if (!active) return;
                if (response.userToken) {
                    setIsAuthenticated(true);
                    router.replace('/'); // ✅ переходим на главную
                } else {
                    setError('Не удалось подтвердить учетную запись. ' + ((response as any)?.non_field_errors?.[0] ?? ''));
                }
            } catch (err: any) {
                if (!active) return;
                setError('Произошла ошибка при подтверждении учетной записи. ' + (err?.message ?? ''));
            } finally {
                if (active) setLoading(false);
            }
        };

        confirm();
        return () => { active = false; };
        // router/setIsAuthenticated намеренно вне deps: эффект должен выполниться
        // один раз на hash, иначе одноразовый токен будет израсходован повторно.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hash]);

    return (
        <View style={styles.container}>
            {isFocused && (
                <InstantSEO
                    headKey="account-confirmation"
                    title="Подтверждение аккаунта | Metravel"
                    description="Подтверждение учётной записи"
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
                    {loading ? (
                        <ActivityIndicator size="large" color={colors.primaryDark} />
                    ) : error ? (
                        <View>
                            <Text style={styles.errorText}>{error}</Text>
                            <Button
                                mode="contained"
                                onPress={() => router.replace('/')}
                                style={styles.button}
                                contentStyle={styles.buttonContent}
                            >
                                На главную
                            </Button>
                        </View>
                    ) : (
                        <Text style={styles.successText}>Учетная запись успешно подтверждена!</Text>
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
        ...StyleSheet.absoluteFillObject,
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
    errorText: {
        color: colors.danger,
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
