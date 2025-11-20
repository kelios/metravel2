// app/login.tsx (или соответствующий путь)
import React, { useRef, useState } from 'react';
import {
    Dimensions,
    ImageBackground,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Button, Card } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useIsFocused } from '@react-navigation/native';
import { usePathname, useRouter } from 'expo-router';

import InstantSEO from '@/components/seo/InstantSEO';
import { useAuth } from '@/context/AuthContext';
import { loginSchema } from '@/utils/validation';
import { Formik, FormikHelpers } from 'formik';
import FormFieldWithValidation from '@/components/FormFieldWithValidation'; // ✅ ИСПРАВЛЕНИЕ: Импорт улучшенного компонента
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей

const { height } = Dimensions.get('window');

interface LoginFormValues {
    email: string;
    password: string;
}

export default function Login() {
    /* ---------- state ---------- */
    const [msg, setMsg] = useState<{ text: string; error: boolean }>({ text: '', error: false });
    const passwordRef = useRef<TextInput>(null);

    /* ---------- helpers ---------- */
    const navigation = useNavigation();
    const router = useRouter();
    const { login, sendPassword } = useAuth();

    const isFocused = useIsFocused();
    const pathname = usePathname();
    const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';
    const canonical = `${SITE}${pathname || '/login'}`;

    const showMsg = (text: string, error = false) => setMsg({ text, error });

    /* ---------- actions ---------- */
    const handleResetPassword = async (email: string) => {
        // ✅ ИСПРАВЛЕНИЕ: Валидация email перед отправкой запроса
        const trimmedEmail = email.trim();
        
        if (!trimmedEmail) {
            showMsg('Введите email адрес', true);
            return;
        }
        
        // Проверка формата email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            showMsg('Введите корректный email адрес', true);
            return;
        }
        
        try {
            const res = await sendPassword(trimmedEmail);
            showMsg(res, /ошиб|не удалось/i.test(res));
        } catch (e: any) {
            showMsg(e?.message || 'Ошибка при сбросе пароля.', true);
        }
    };

    const handleLogin = async (
        values: LoginFormValues,
        { setSubmitting }: FormikHelpers<LoginFormValues>
    ) => {
        try {
            showMsg('');
            const ok = await login(values.email.trim(), values.password);
            if (ok) {
                // ✅ ИСПРАВЛЕНИЕ: Используем router вместо navigation для Expo Router
                router.replace('/');
            } else {
                showMsg('Неверный email или пароль.', true);
            }
        } catch (e: any) {
            showMsg(e?.message || 'Ошибка при входе.', true);
        } finally {
            setSubmitting(false);
        }
    };

    const title = 'Вход | Metravel';
    const description =
        'Войдите в свой аккаунт на Metravel, чтобы управлять путешествиями, создавать маршруты и сохранять избранное.';

    /* ---------- render ---------- */
    return (
        <>
            {isFocused && (
                <InstantSEO
                    headKey="login"
                    title={title}
                    description={description}
                    canonical={canonical}
                    image={`${SITE}/og-preview.jpg`}
                    ogType="website"
                />
            )}

            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollViewContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <ImageBackground
                        source={require('@/assets/images/media/slider/about.jpg')}
                        style={styles.bg}
                        blurRadius={3}
                    >
                        <View style={styles.inner}>
                            <Card style={styles.card}>
                                <Card.Content>
                                    {msg.text !== '' && (
                                        <Text
                                            style={[
                                                styles.message,
                                                msg.error ? styles.err : styles.ok,
                                            ]}
                                        >
                                            {msg.text}
                                        </Text>
                                    )}

                                    <Formik
                                        initialValues={{ email: '', password: '' }}
                                        validationSchema={loginSchema}
                                        onSubmit={handleLogin}
                                    >
                                        {({
                                            handleChange,
                                            handleBlur,
                                            handleSubmit,
                                            values,
                                            errors,
                                            touched,
                                            isSubmitting,
                                        }) => (
                                            <>
                                                {/* ✅ ИСПРАВЛЕНИЕ: Используем улучшенный компонент для email */}
                                                <FormFieldWithValidation
                                                    label="Email"
                                                    error={touched.email && errors.email ? errors.email : null}
                                                    required
                                                >
                                                    <TextInput
                                                        style={[
                                                            styles.input,
                                                            touched.email && errors.email && styles.inputError,
                                                            globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                                                        ]}
                                                        placeholder="Email"
                                                        value={values.email}
                                                        onChangeText={handleChange('email')}
                                                        onBlur={handleBlur('email')}
                                                        keyboardType="email-address"
                                                        autoCapitalize="none"
                                                        placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
                                                        returnKeyType="next"
                                                        blurOnSubmit={false}
                                                        onSubmitEditing={() => passwordRef.current?.focus()}
                                                    />
                                                </FormFieldWithValidation>

                                                {/* ✅ ИСПРАВЛЕНИЕ: Используем улучшенный компонент для пароля */}
                                                <FormFieldWithValidation
                                                    label="Пароль"
                                                    error={touched.password && errors.password ? errors.password : null}
                                                    required
                                                >
                                                    <TextInput
                                                        ref={passwordRef}
                                                        style={[
                                                            styles.input,
                                                            touched.password && errors.password && styles.inputError,
                                                            globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                                                        ]}
                                                        placeholder="Пароль"
                                                        value={values.password}
                                                        onChangeText={handleChange('password')}
                                                        onBlur={handleBlur('password')}
                                                        secureTextEntry
                                                        placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
                                                        returnKeyType="done"
                                                        onSubmitEditing={handleSubmit}
                                                    />
                                                </FormFieldWithValidation>

                                                <Button
                                                    mode="contained"
                                                    onPress={handleSubmit}
                                                    disabled={isSubmitting}
                                                    loading={isSubmitting}
                                                    style={styles.btn}
                                                    contentStyle={styles.btnContent}
                                                >
                                                    {isSubmitting ? 'Подождите…' : 'Войти'}
                                                </Button>

                                                <TouchableOpacity 
                                                    onPress={() => handleResetPassword(values.email)} 
                                                    disabled={isSubmitting}
                                                >
                                                    <Text style={styles.forgot}>Забыли пароль?</Text>
                                                </TouchableOpacity>
                                            </>
                                        )}
                                    </Formik>

                                    <View style={styles.registerContainer}>
                                        <Text style={styles.registerText}>Нет аккаунта? </Text>
                                        <TouchableOpacity 
                                            onPress={() => router.push('/registration' as any)} 
                                            disabled={isSubmitting}
                                        >
                                            <Text style={styles.registerLink}>Зарегистрируйтесь</Text>
                                        </TouchableOpacity>
                                    </View>
                                </Card.Content>
                            </Card>
                        </View>
                    </ImageBackground>
                </ScrollView>
            </KeyboardAvoidingView>
        </>
    );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollViewContent: { flexGrow: 1 },
    bg: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', height },
    inner: { width: '80%', maxWidth: 400 },
    card: {
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 12,
        padding: 20,
        elevation: 5,
    },
    input: {
        marginBottom: 0, // ✅ ИСПРАВЛЕНИЕ: Отступ управляется FormFieldWithValidation
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        borderRadius: DESIGN_TOKENS.radii.sm,
        padding: 12,
        fontSize: 16,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        color: DESIGN_TOKENS.colors.text,
        minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальный размер для touch-целей
        ...Platform.select({
            web: {
                transition: 'border-color 0.2s ease',
            },
        }),
    },
    btn: { backgroundColor: '#6aaaaa', borderRadius: 8, marginTop: 4 },
    btnContent: { paddingVertical: 12 },
    forgot: {
        color: '#0066ff',
        textDecorationLine: 'underline',
        marginTop: 15,
        textAlign: 'center',
        fontSize: 16,
    },
    registerContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    registerText: {
        fontSize: 15,
        color: '#666',
    },
    registerLink: {
        fontSize: 15,
        color: '#4a8c8c',
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    message: { 
        marginBottom: 15, 
        textAlign: 'center', 
        fontSize: 16,
        padding: 12,
        borderRadius: 8,
        fontWeight: '500',
    },
    err: { 
        color: DESIGN_TOKENS.colors.danger,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderLeftWidth: 3,
        borderLeftColor: DESIGN_TOKENS.colors.danger,
    },
    ok: { 
        color: DESIGN_TOKENS.colors.success,
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderLeftWidth: 3,
        borderLeftColor: DESIGN_TOKENS.colors.success,
    },
    inputError: {
        borderColor: DESIGN_TOKENS.colors.danger,
        borderWidth: 2,
        backgroundColor: 'rgba(239, 68, 68, 0.05)', // ✅ ИСПРАВЛЕНИЕ: Светло-красный фон для ошибок
    },
    // ✅ ИСПРАВЛЕНИЕ: Стиль больше не используется (ошибки показываются через FormFieldWithValidation)
    errorText: {
        color: DESIGN_TOKENS.colors.danger,
        fontSize: 12,
        marginTop: -10,
        marginBottom: 10,
        marginLeft: 4,
    },
});
