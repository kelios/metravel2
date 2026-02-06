import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, Dimensions } from 'react-native';
import { Button, Card } from '@/ui/paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { confirmAccount } from '@/api/auth';
import { useAuth } from '@/context/AuthContext';
import { useThemedColors } from '@/hooks/useTheme';

const { height } = Dimensions.get('window');

export default function AccountConfirmation() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const { hash } = useLocalSearchParams(); // ✅ заменили useRoute
    const router = useRouter();              // ✅ заменили useNavigation
    const { setIsAuthenticated } = useAuth();

    useEffect(() => {
        const confirm = async () => {
            try {
                const response = await confirmAccount(hash as string);
                if (response.userToken) {
                    setIsAuthenticated(true);
                    router.replace('/'); // ✅ переходим на главную
                } else {
                    setError('Не удалось подтвердить учетную запись. ' + (response as any)?.non_field_errors?.[0]);
                }
            } catch (err: any) {
                setError('Произошла ошибка при подтверждении учетной записи. ' + err.message);
            } finally {
                setLoading(false);
            }
        };

        if (hash) {
            confirm();
        }
    }, [hash, router, setIsAuthenticated]);

    return (
        <View style={styles.container}>
            <Image
                source={require('@/assets/images/media/slider/about.jpg')}
                style={styles.backgroundImage}
            />
            <View style={styles.contentContainer}>
                <Card style={styles.card}>
                    {loading ? (
                        <ActivityIndicator size="large" color={colors.primary} />
                    ) : error ? (
                        <>
                            <Text style={styles.errorText}>{error}</Text>
                            <Button
                                mode="contained"
                                onPress={() => router.replace('/')}
                                style={styles.button}
                                contentStyle={styles.buttonContent}
                            >
                                На главную
                            </Button>
                        </>
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
    },
    backgroundImage: {
        width: '100%',
        height: height * 0.5,
        position: 'absolute',
        top: 0,
        left: 0,
    },
    contentContainer: {
        width: '50%',
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
