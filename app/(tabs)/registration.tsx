// app/register.tsx (или соответствующий путь)
import { useMemo, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    Image,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import Button from '@/components/ui/Button';
import { useYupForm } from '@/hooks/useYupForm';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import { registration } from '@/api/auth';
import type { FormValues } from '@/types/types';
import { registrationSchema } from '@/utils/validation';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей
import FormFieldWithValidation from '@/components/forms/FormFieldWithValidation'; // ✅ ИСПРАВЛЕНИЕ: Импорт улучшенного компонента
import { sendAnalyticsEvent } from '@/utils/analytics';
import { useThemedColors } from '@/hooks/useTheme';

type PasswordStrength = 'weak' | 'medium' | 'strong';

function getPasswordStrength(password: string): PasswordStrength {
    if (!password || password.length < 4) return 'weak';
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (password.length >= 12) score++;
    if (score <= 1) return 'weak';
    if (score <= 3) return 'medium';
    return 'strong';
}

const STRENGTH_CONFIG: Record<PasswordStrength, { label: string; color: string; width: string }> = {
    weak: { label: 'Слабый', color: '#ef4444', width: '33%' },
    medium: { label: 'Средний', color: '#f59e0b', width: '66%' },
    strong: { label: 'Сильный', color: '#22c55e', width: '100%' },
};

export default function RegisterForm() {
    const [showPass, setShowPass] = useState(false);
    const [generalMsg, setMsg] = useState<{ text: string; error: boolean }>({ text: '', error: false });
    const { redirect, intent } = useLocalSearchParams<{ redirect?: string; intent?: string }>();
    const router = useRouter();
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const isFocused = useIsFocused();
    const pathname = usePathname();
    const { buildCanonicalUrl, buildOgImageUrl } = require('@/utils/seo');
    const canonical = buildCanonicalUrl(pathname || '/registration');

    const onSubmit = async (
        values: FormValues,
        { setSubmitting, resetForm }: { setSubmitting: (v: boolean) => void; resetForm: () => void },
    ) => {
        setMsg({ text: '', error: false });
        try {
            const res = await registration(values);
            const ok = typeof res === 'object' && 'ok' in res ? res.ok : false;
            const message = typeof res === 'object' && 'message' in res ? res.message : String(res ?? '');

            if (!ok) {
                setMsg({ text: message || 'Не удалось зарегистрироваться.', error: true });
                return;
            }

            setMsg({ text: message, error: false });
            resetForm();
            if (intent) {
                sendAnalyticsEvent('AuthSuccess', { source: 'home', intent });
            }
            // ✅ Intent-редирект: обработка разных сценариев
            let targetPath = '/';
            if (intent === 'create-book') {
                targetPath = '/travel/new';
            } else if (intent === 'build-pdf') {
                targetPath = '/export';
            } else if (redirect && typeof redirect === 'string' && redirect.startsWith('/')) {
                targetPath = redirect;
            }
            setTimeout(() => {
                router.replace(targetPath as any);
            }, 1000);
        } catch (e: any) {
            setMsg({ text: e?.message || 'Не удалось зарегистрироваться.', error: true });
        } finally {
            setSubmitting(false);
        }
    };

    const {
        values,
        errors,
        touched,
        isSubmitting,
        handleChange,
        handleBlur,
        handleSubmit,
    } = useYupForm<FormValues>({
        initialValues: { username: '', email: '', password: '', confirmPassword: '' },
        validationSchema: registrationSchema,
        onSubmit,
    });

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
                    image={buildOgImageUrl('/og-preview.jpg')}
                    ogType="website"
                    robots="noindex, nofollow"
                />
            )}

            <KeyboardAvoidingView
                style={{ flex: 1, backgroundColor: colors.backgroundSecondary }}
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
                                <View style={styles.center}>
                                    <View style={styles.card}>
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
                                                    <Feather 
                                                        name="user" 
                                                        size={20} 
                                                        color={touched.username && errors.username 
                                                            ? colors.danger
                                                            : colors.textMuted
                                                        } 
                                                    />
                                                    <TextInput
                                                        style={[
                                                            styles.input,
                                                            globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                                                        ]}
                                                        placeholder="Имя пользователя"
                                                        placeholderTextColor={colors.textMuted}
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
                                                    <Feather 
                                                        name="mail" 
                                                        size={20} 
                                                        color={touched.email && errors.email 
                                                            ? colors.danger
                                                            : colors.textMuted
                                                        } 
                                                    />
                                                    <TextInput
                                                        style={[
                                                            styles.input,
                                                            globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                                                        ]}
                                                        placeholder="Email"
                                                        placeholderTextColor={colors.textMuted}
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
                                                    <Feather 
                                                        name="lock" 
                                                        size={20} 
                                                        color={touched.password && errors.password 
                                                            ? colors.danger
                                                            : colors.textMuted
                                                        } 
                                                    />
                                                    <TextInput
                                                        style={[
                                                            styles.input,
                                                            globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                                                        ]}
                                                        placeholder="Пароль"
                                                        placeholderTextColor={colors.textMuted}
                                                        value={values.password}
                                                        onChangeText={handleChange('password')}
                                                        onBlur={handleBlur('password')}
                                                        secureTextEntry={!showPass}
                                                        returnKeyType="next"
                                                    />
                                                    <Pressable
                                                        onPress={() => setShowPass(v => !v)}
                                                        hitSlop={8}
                                                        style={styles.eyeButton}
                                                        accessibilityRole="button"
                                                        accessibilityLabel={showPass ? 'Скрыть пароль' : 'Показать пароль'}
                                                    >
                                                        <Feather
                                                            name={showPass ? 'eye-off' : 'eye'}
                                                            size={20}
                                                            color={colors.textMuted}
                                                        />
                                                    </Pressable>
                                                </View>
                                                {values.password.length > 0 && (
                                                    <View style={styles.strengthContainer}>
                                                        <View style={styles.strengthBarBg}>
                                                            <View
                                                                style={[
                                                                    styles.strengthBarFill,
                                                                    {
                                                                        width: STRENGTH_CONFIG[getPasswordStrength(values.password)].width as any,
                                                                        backgroundColor: STRENGTH_CONFIG[getPasswordStrength(values.password)].color,
                                                                    },
                                                                ]}
                                                            />
                                                        </View>
                                                        <Text
                                                            style={[
                                                                styles.strengthLabel,
                                                                { color: STRENGTH_CONFIG[getPasswordStrength(values.password)].color },
                                                            ]}
                                                        >
                                                            {STRENGTH_CONFIG[getPasswordStrength(values.password)].label}
                                                        </Text>
                                                    </View>
                                                )}
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
                                                    <Feather 
                                                        name="check-circle" 
                                                        size={20} 
                                                        color={touched.confirmPassword && errors.confirmPassword 
                                                            ? colors.danger
                                                            : colors.textMuted
                                                        } 
                                                    />
                                                    <TextInput
                                                        style={[
                                                            styles.input,
                                                            globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                                                        ]}
                                                        placeholder="Повторите пароль"
                                                        placeholderTextColor={colors.textMuted}
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
                                                label={isSubmitting ? 'Подождите…' : 'Зарегистрироваться'}
                                                onPress={() => handleSubmit()}
                                                disabled={isSubmitting}
                                                variant="primary"
                                                size="lg"
                                                style={styles.btn}
                                                accessibilityLabel="Зарегистрироваться"
                                            />

                                            <View style={styles.loginContainer}>
                                                <Text style={styles.loginText}>Уже есть аккаунт? </Text>
                                                <Pressable
                                                    onPress={() =>
                                                        router.push(
                                                            (redirect && typeof redirect === 'string')
                                                                ? (`/login?redirect=${encodeURIComponent(redirect)}${intent ? `&intent=${encodeURIComponent(intent)}` : ''}` as any)
                                                                : (`/login${intent ? `?intent=${encodeURIComponent(intent)}` : ''}` as any)
                                                        )
                                                    }
                                                    disabled={isSubmitting}
                                                    accessibilityRole="button"
                                                    accessibilityLabel="Войти в аккаунт"
                                                >
                                                    <Text style={styles.loginLink}>Войти</Text>
                                                </Pressable>
                                            </View>
                                    </View>
                                </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </>
    );
}

/* ---------- styles ---------- */
const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    bg: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapBackground: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
    center: {
        width: '100%',
        maxWidth: 440,
        paddingHorizontal: 16,
    },
    card: {
        padding: 24,
        borderRadius: DESIGN_TOKENS.radii.xl,
        backgroundColor: colors.surface,
        ...Platform.select({
            ios: {
                shadowColor: colors.shadows.heavy.shadowColor,
                shadowOffset: { width: 0, height: 14 },
                shadowOpacity: 0.16,
                shadowRadius: 24,
            },
            android: {
                elevation: 6,
            },
            web: {
                boxShadow: colors.boxShadows.modal,
            },
        }),
    },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: DESIGN_TOKENS.radii.sm,
        backgroundColor: colors.surface,
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
        borderColor: colors.danger,
        borderWidth: 2,
        backgroundColor: 'rgba(239, 68, 68, 0.05)', // Светло-красный фон для ошибок
    },
    input: { 
        flex: 1, 
        paddingVertical: 10, 
        fontSize: 16,
        color: colors.text,
        minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальный размер для touch-целей
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            },
        }),
    },
    eyeButton: {
        padding: 4,
        minWidth: 32,
        minHeight: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // ✅ ИСПРАВЛЕНИЕ: Стили больше не используются (ошибки показываются через FormFieldWithValidation)
    err: { color: colors.danger, marginBottom: 6, textAlign: 'left' },
    ok: { 
        color: colors.success, 
        marginBottom: 20, 
        textAlign: 'center', 
        fontWeight: 'bold',
        padding: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderLeftWidth: 3,
        borderLeftColor: colors.success,
    },
    msg: { 
        marginBottom: 20, 
        textAlign: 'center', 
        fontSize: 16,
        padding: 12,
        borderRadius: 8,
        fontWeight: '500',
    },
    strengthContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 6,
    },
    strengthBarBg: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.border,
        overflow: 'hidden',
    },
    strengthBarFill: {
        height: '100%',
        borderRadius: 2,
        ...Platform.select({
            web: {
                transition: 'width 0.3s ease, background-color 0.3s ease',
            },
        }),
    },
    strengthLabel: {
        fontSize: 11,
        fontWeight: '600',
        minWidth: 56,
        textAlign: 'right',
    },
    loginContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    loginText: {
        fontSize: 14,
        color: colors.textMuted,
    },
    loginLink: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    btn: {
        backgroundColor: colors.primary,
        borderRadius: DESIGN_TOKENS.radii.lg,
        marginTop: 8,
    },
    btnContent: { paddingVertical: 12 },
});
