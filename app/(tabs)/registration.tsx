// app/register.tsx (или соответствующий путь)
import React, { useState } from 'react';
import {
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Image,
} from 'react-native';
import { Button, Card } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Formik, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';

import InstantSEO from '@/components/seo/InstantSEO';
import { registration } from '@/src/api/auth';
import type { FormValues } from '@/src/types/types';
import { registrationSchema } from '@/utils/validation';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей
import FormFieldWithValidation from '@/components/FormFieldWithValidation'; // ✅ ИСПРАВЛЕНИЕ: Импорт улучшенного компонента

const { height } = Dimensions.get('window');

export default function RegisterForm() {
    const [showPass, setShowPass] = useState(false);
    const [generalMsg, setMsg] = useState<{ text: string; error: boolean }>({ text: '', error: false });
    const { redirect, intent } = useLocalSearchParams<{ redirect?: string; intent?: string }>();
    const router = useRouter();

    const isFocused = useIsFocused();
    const pathname = usePathname();
    const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';
    const canonical = `${SITE}${pathname || '/register'}`;

    const onSubmit = async (
        values: FormValues,
        { setSubmitting, resetForm }: FormikHelpers<FormValues>,
    ) => {
        setMsg({ text: '', error: false });
        try {
            const res = await registration(values);
            setMsg({ text: res, error: /ошиб|fail|invalid/i.test(res) });
            if (!/ошиб|fail|invalid/i.test(res)) resetForm();
        } catch (e: any) {
            setMsg({ text: e?.message || 'Не удалось зарегистрироваться.', error: true });
        } finally {
            setSubmitting(false);
        }
    };

    const title = 'Регистрация | Metravel';
    const description =
        'Создайте аккаунт на Metravel, чтобы делиться своими путешествиями, маршрутами и впечатлениями.';

    return (
        <>
            {isFocused && (
                <InstantSEO
                    headKey="register"
                    title={title}
                    description={description}
                    canonical={canonical}
                    image={`${SITE}/og-preview.jpg`}
                    ogType="website"
                />
            )}

            <KeyboardAvoidingView
                style={{ flex: 1, backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {Platform.OS === 'web' && (
                    <Image
                        source={require('../../assets/travel/roulette-map-bg.jpg')}
                        style={styles.mapBackground}
                        resizeMode="cover"
                    />
                )}
                <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                    <View style={styles.bg}>
                        <Formik<FormValues>
                            initialValues={{ username: '', email: '', password: '', confirmPassword: '' }}
                            validationSchema={registrationSchema}
                            onSubmit={onSubmit}
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
                                <View style={styles.center}>
                                    <Card style={styles.card}>
                                        <Card.Content>
                                            {generalMsg.text !== '' && (
                                                <Text
                                                    style={[
                                                        styles.msg,
                                                        generalMsg.error ? styles.err : styles.ok,
                                                    ]}
                                                >
                                                    {generalMsg.text}
                                                </Text>
                                            )}

                                            {/* ✅ ИСПРАВЛЕНИЕ: Используем улучшенный компонент для username */}
                                            <FormFieldWithValidation
                                                label="Имя пользователя"
                                                error={touched.username && errors.username ? errors.username : null}
                                                required
                                            >
                                                <View style={[
                                                    styles.inputWrap,
                                                    touched.username && errors.username && styles.inputWrapError,
                                                ]}>
                                                    <MaterialCommunityIcons 
                                                        name="account" 
                                                        size={20} 
                                                        color={touched.username && errors.username 
                                                            ? DESIGN_TOKENS.colors.danger 
                                                            : DESIGN_TOKENS.colors.textMuted
                                                        } 
                                                    />
                                                    <TextInput
                                                        style={[
                                                            styles.input,
                                                            globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                                                        ]}
                                                        placeholder="Имя пользователя"
                                                        placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
                                                        value={values.username}
                                                        onChangeText={handleChange('username')}
                                                        onBlur={handleBlur('username')}
                                                        autoCapitalize="none"
                                                        returnKeyType="next"
                                                    />
                                                </View>
                                            </FormFieldWithValidation>

                                            {/* ✅ ИСПРАВЛЕНИЕ: Используем улучшенный компонент для email */}
                                            <FormFieldWithValidation
                                                label="Email"
                                                error={touched.email && errors.email ? errors.email : null}
                                                required
                                            >
                                                <View style={[
                                                    styles.inputWrap,
                                                    touched.email && errors.email && styles.inputWrapError,
                                                ]}>
                                                    <MaterialCommunityIcons 
                                                        name="email" 
                                                        size={20} 
                                                        color={touched.email && errors.email 
                                                            ? DESIGN_TOKENS.colors.danger 
                                                            : DESIGN_TOKENS.colors.textMuted
                                                        } 
                                                    />
                                                    <TextInput
                                                        style={[
                                                            styles.input,
                                                            globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                                                        ]}
                                                        placeholder="Email"
                                                        placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
                                                        value={values.email}
                                                        onChangeText={handleChange('email')}
                                                        onBlur={handleBlur('email')}
                                                        keyboardType="email-address"
                                                        autoCapitalize="none"
                                                        returnKeyType="next"
                                                    />
                                                </View>
                                            </FormFieldWithValidation>

                                            {/* ✅ ИСПРАВЛЕНИЕ: Используем улучшенный компонент для пароля */}
                                            <FormFieldWithValidation
                                                label="Пароль"
                                                error={touched.password && errors.password ? errors.password : null}
                                                required
                                            >
                                                <View style={[
                                                    styles.inputWrap,
                                                    touched.password && errors.password && styles.inputWrapError,
                                                ]}>
                                                    <MaterialCommunityIcons 
                                                        name="lock" 
                                                        size={20} 
                                                        color={touched.password && errors.password 
                                                            ? DESIGN_TOKENS.colors.danger 
                                                            : DESIGN_TOKENS.colors.textMuted
                                                        } 
                                                    />
                                                    <TextInput
                                                        style={[
                                                            styles.input,
                                                            globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                                                        ]}
                                                        placeholder="Пароль"
                                                        placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
                                                        value={values.password}
                                                        onChangeText={handleChange('password')}
                                                        onBlur={handleBlur('password')}
                                                        secureTextEntry={!showPass}
                                                        returnKeyType="next"
                                                    />
                                                    <TouchableOpacity 
                                                        onPress={() => setShowPass(v => !v)}
                                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                        style={styles.eyeButton}
                                                    >
                                                        <MaterialCommunityIcons
                                                            name={showPass ? 'eye-off' : 'eye'}
                                                            size={20}
                                                            color={DESIGN_TOKENS.colors.textMuted}
                                                        />
                                                    </TouchableOpacity>
                                                </View>
                                            </FormFieldWithValidation>

                                            {/* ✅ ИСПРАВЛЕНИЕ: Используем улучшенный компонент для подтверждения пароля */}
                                            <FormFieldWithValidation
                                                label="Повторите пароль"
                                                error={touched.confirmPassword && errors.confirmPassword ? errors.confirmPassword : null}
                                                required
                                            >
                                                <View style={[
                                                    styles.inputWrap,
                                                    touched.confirmPassword && errors.confirmPassword && styles.inputWrapError,
                                                ]}>
                                                    <MaterialCommunityIcons 
                                                        name="lock-check" 
                                                        size={20} 
                                                        color={touched.confirmPassword && errors.confirmPassword 
                                                            ? DESIGN_TOKENS.colors.danger 
                                                            : DESIGN_TOKENS.colors.textMuted
                                                        } 
                                                    />
                                                    <TextInput
                                                        style={[
                                                            styles.input,
                                                            globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                                                        ]}
                                                        placeholder="Повторите пароль"
                                                        placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
                                                        value={values.confirmPassword}
                                                        onChangeText={handleChange('confirmPassword')}
                                                        onBlur={handleBlur('confirmPassword')}
                                                        secureTextEntry={!showPass}
                                                        returnKeyType="done"
                                                        onSubmitEditing={() => handleSubmit()}
                                                    />
                                                </View>
                                            </FormFieldWithValidation>

                                            {/* ---------- button ---------- */}
                                            <Button
                                                mode="contained"
                                                onPress={() => handleSubmit()}
                                                disabled={isSubmitting}
                                                loading={isSubmitting}
                                                style={styles.btn}
                                                contentStyle={styles.btnContent}
                                            >
                                                {isSubmitting ? 'Подождите…' : 'Зарегистрироваться'}
                                            </Button>

                                            <TouchableOpacity
                                                onPress={() =>
                                                    router.push(
                                                        (redirect && typeof redirect === 'string')
                                                            ? (`/login?redirect=${encodeURIComponent(redirect)}${intent ? `&intent=${encodeURIComponent(intent)}` : ''}` as any)
                                                            : (`/login${intent ? `?intent=${encodeURIComponent(intent)}` : ''}` as any)
                                                    )
                                                }
                                                disabled={isSubmitting}
                                                style={{ marginTop: 12 }}
                                            >
                                                <Text style={{ textAlign: 'center', color: DESIGN_TOKENS.colors.primary, fontWeight: '600' }}>
                                                    Уже есть аккаунт? Войти
                                                </Text>
                                            </TouchableOpacity>
                                        </Card.Content>
                                    </Card>
                                </View>
                            )}
                        </Formik>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </>
    );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
    bg: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        height,
    },
    mapBackground: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
        opacity: 0.9,
    },
    center: {
        width: '100%',
        maxWidth: 440,
        paddingHorizontal: 16,
    },
    card: {
        padding: 24,
        borderRadius: DESIGN_TOKENS.radii.xl,
        backgroundColor: 'rgba(255,255,255,0.96)',
        ...Platform.select({
            ios: {
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 14 },
                shadowOpacity: 0.16,
                shadowRadius: 24,
            },
            android: {
                elevation: 6,
            },
            web: {
                boxShadow:
                    '0 24px 60px rgba(15, 23, 42, 0.14), 0 8px 24px rgba(15, 23, 42, 0.06)',
            },
        }),
    },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        borderRadius: DESIGN_TOKENS.radii.sm,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        paddingHorizontal: 12,
        marginBottom: 0, // ✅ ИСПРАВЛЕНИЕ: Отступ управляется FormFieldWithValidation
        minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальный размер для touch-целей
        ...Platform.select({
            web: {
                transition: 'border-color 0.2s ease',
            },
        }),
    },
    // ✅ ИСПРАВЛЕНИЕ: Стиль для ошибок в inputWrap
    inputWrapError: {
        borderColor: DESIGN_TOKENS.colors.danger,
        borderWidth: 2,
        backgroundColor: 'rgba(239, 68, 68, 0.05)', // Светло-красный фон для ошибок
    },
    input: { 
        flex: 1, 
        paddingVertical: 10, 
        fontSize: 16,
        color: DESIGN_TOKENS.colors.text,
        minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальный размер для touch-целей
    },
    eyeButton: {
        padding: 4,
        minWidth: 32,
        minHeight: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // ✅ ИСПРАВЛЕНИЕ: Стили больше не используются (ошибки показываются через FormFieldWithValidation)
    err: { color: DESIGN_TOKENS.colors.danger, marginBottom: 6, textAlign: 'left' },
    ok: { 
        color: DESIGN_TOKENS.colors.success, 
        marginBottom: 20, 
        textAlign: 'center', 
        fontWeight: 'bold',
        padding: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderLeftWidth: 3,
        borderLeftColor: DESIGN_TOKENS.colors.success,
    },
    msg: { 
        marginBottom: 20, 
        textAlign: 'center', 
        fontSize: 16,
        padding: 12,
        borderRadius: 8,
        fontWeight: '500',
    },
    btn: {
        backgroundColor: DESIGN_TOKENS.colors.primary,
        borderRadius: DESIGN_TOKENS.radii.lg,
        marginTop: 8,
    },
    btnContent: { paddingVertical: 12 },
});
