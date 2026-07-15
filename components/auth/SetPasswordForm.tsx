import { useEffect, useMemo, useRef, useState } from 'react'
import {Image, StyleSheet, TextInput, View, Platform, Text} from 'react-native'
import Button from '@/components/ui/Button'
import {useNavigation} from 'expo-router'
import {useRoute} from 'expo-router';
import {useAuth} from "@/context/AuthContext";
import { useYupForm } from '@/hooks/useYupForm';
import {setNewPasswordSchema} from '@/utils/validation';
import FormFieldWithValidation from '@/components/forms/FormFieldWithValidation'; // ✅ ИСПРАВЛЕНИЕ: Импорт улучшенного компонента
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей
import { useThemedColors } from '@/hooks/useTheme';
import { useIsFocused } from 'expo-router';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl } from '@/utils/seo';
import { translate as i18nT } from '@/i18n'



interface SetPasswordFormValues {
    password: string;
    confirmPassword: string;
}

export default function SetPassword() {
    const navigation = useNavigation();
    const route = useRoute();
    const isFocused = useIsFocused();
    const { setNewPassword } = useAuth();
    const [msg, setMsg] = useState<{ text: string; error: boolean }>({ text: '', error: false });
    const [done, setDone] = useState(false);
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const routeParams = route.params as { password_reset_token?: string } || {};
    const { password_reset_token } = routeParams;
    const hasToken = Boolean(password_reset_token);

    useEffect(() => {
        return () => {
            if (navTimeoutRef.current) {
                clearTimeout(navTimeoutRef.current);
            }
        };
    }, []);

    const handleResetPassword = async (
        values: SetPasswordFormValues,
        { setSubmitting }: { setSubmitting: (v: boolean) => void }
    ) => {
        try {
            const success = await setNewPassword(password_reset_token as string, values.password);
            if (success) {
                setDone(true);
                setMsg({ text: i18nT('auth:components.auth.SetPasswordForm.parol_uspeshno_izmenen_3d2b96b5'), error: false });
                navTimeoutRef.current = setTimeout(() => {
                    navigation.navigate('login' as never);
                }, 1500);
            } else {
                setMsg({ text: i18nT('auth:components.auth.SetPasswordForm.ne_udalos_izmenit_parol_dd091b55'), error: true });
            }
        } catch (e: any) {
            setMsg({ text: e?.message || i18nT('authStatic:password.changeFailed'), error: true });
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
    } = useYupForm<SetPasswordFormValues>({
        initialValues: { password: '', confirmPassword: '' },
        validationSchema: setNewPasswordSchema,
        onSubmit: handleResetPassword,
    });

    return (
        <View style={styles.container}>
            {isFocused && (
                <InstantSEO
                    headKey="set-password"
                    title={i18nT('auth:components.auth.SetPasswordForm.smena_parolya_metravel_bf28783a')}
                    description={i18nT('auth:components.auth.SetPasswordForm.smena_parolya_341ef61e')}
                    canonical={buildCanonicalUrl('/set-password')}
                    robots="noindex, nofollow"
                />
            )}
            <View style={styles.heroWrapper}>
                <Image
                    source={require('@/assets/images/media/slider/about.jpg')}
                    style={styles.topImage}
                />
            </View>
            <View style={styles.card}>
                    {!hasToken && (
                        <Text style={[styles.message, styles.err]}>
                            {i18nT('auth:components.auth.SetPasswordForm.ssylka_nedeystvitelna_ili_ustarela_d7694ae3')}</Text>
                    )}
                    {msg.text !== '' && (
                        <Text style={[styles.message, msg.error ? styles.err : styles.ok]}>
                            {msg.text}
                        </Text>
                    )}

                                {/* ✅ ИСПРАВЛЕНИЕ: Используем улучшенный компонент для пароля */}
                                <FormFieldWithValidation
                                    label={i18nT('auth:components.auth.SetPasswordForm.novyy_parol_e22841c5')}
                                    error={touched.password && errors.password ? errors.password : null}
                                    required
                                >
                                    <TextInput
                                        style={[
                                            styles.input,
                                            touched.password && errors.password && styles.inputError,
                                            globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                                        ]}
                                        placeholder={i18nT('auth:components.auth.SetPasswordForm.novyy_parol_e22841c5')}
                                        placeholderTextColor={colors.textMuted}
                                        secureTextEntry
                                        value={values.password}
                                        onChangeText={handleChange('password')}
                                        onBlur={handleBlur('password')}
                                    />
                                </FormFieldWithValidation>

                                {/* ✅ ИСПРАВЛЕНИЕ: Используем улучшенный компонент для подтверждения пароля */}
                                <FormFieldWithValidation
                                    label={i18nT('auth:components.auth.SetPasswordForm.podtverdite_parol_4e3ca96e')}
                                    error={touched.confirmPassword && errors.confirmPassword ? errors.confirmPassword : null}
                                    required
                                >
                                    <TextInput
                                        style={[
                                            styles.input,
                                            touched.confirmPassword && errors.confirmPassword && styles.inputError,
                                            globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                                        ]}
                                        placeholder={i18nT('auth:components.auth.SetPasswordForm.podtverdite_parol_4e3ca96e')}
                                        placeholderTextColor={colors.textMuted}
                                        secureTextEntry
                                        value={values.confirmPassword}
                                        onChangeText={handleChange('confirmPassword')}
                                        onBlur={handleBlur('confirmPassword')}
                                    />
                                </FormFieldWithValidation>

                                <Button
                                    label={done ? i18nT('auth:components.auth.SetPasswordForm.gotovo_fbee8536') : isSubmitting ? i18nT('auth:components.auth.SetPasswordForm.izmenenie_80fe5ee5') : i18nT('auth:components.auth.SetPasswordForm.smenit_parol_5237ebd6')}
                                    onPress={() => handleSubmit()}
                                    disabled={isSubmitting || done || !hasToken}
                                    variant="primary"
                                    size="lg"
                                    style={styles.applyButton}
                                    accessibilityLabel={i18nT('auth:components.auth.SetPasswordForm.smenit_parol_5237ebd6')}
                                />
            </View>
        </View>
    )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    heroWrapper: {
        width: '100%',
        overflow: 'hidden',
        height: 220,
    },
    card: {
        width: '90%',
        maxWidth: 480,
        backgroundColor: colors.surface,
        marginTop: -60,
        borderRadius: DESIGN_TOKENS.radii.lg,
        padding: 32,
        ...Platform.select({
            web: {
                boxShadow: colors.boxShadows.modal,
            },
            ios: {
                shadowColor: colors.shadows.medium.shadowColor,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.10,
                shadowRadius: 12,
            },
            android: {
                elevation: 6,
            },
            default: {
                shadowColor: colors.shadows.medium.shadowColor,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.10,
                shadowRadius: 12,
                elevation: 6,
            },
        }),
        zIndex: 1,
    },
    topImage: {
        width: '100%',
        height: 280,
        resizeMode: 'cover',
    },
    input: {
        marginBottom: 0, // ✅ ИСПРАВЛЕНИЕ: Отступ управляется FormFieldWithValidation
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: DESIGN_TOKENS.radii.sm,
        padding: 12,
        width: '100%',
        fontSize: 16,
        backgroundColor: colors.surface,
        color: colors.text,
        minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальный размер для touch-целей
        ...Platform.select({
            web: {
                transition: 'border-color 0.2s ease',
                outlineStyle: 'none',
            },
        }),
    },
    container: {
        flex: 1,
        alignItems: 'center',
        width: '100%',
        backgroundColor: colors.background,
        paddingBottom: 40,
    },
    applyButton: {
        backgroundColor: colors.primary
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
        color: colors.dangerDark,
        backgroundColor: colors.dangerSoft,
        borderLeftWidth: 3,
        borderLeftColor: colors.danger,
    },
    ok: {
        color: colors.success,
        backgroundColor: colors.successSoft,
        borderLeftWidth: 3,
        borderLeftColor: colors.success,
    },
    inputError: {
        borderColor: colors.danger,
        borderWidth: 2,
        backgroundColor: colors.dangerSoft,
    },
})
