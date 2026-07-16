// app/register.tsx (или соответствующий путь)
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useIsFocused, useLocalSearchParams, usePathname, useRouter } from 'expo-router';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import { registration } from '@/api/auth';
import type { FormValues } from '@/types/types';
import { registrationSchema } from '@/utils/validation';
import { getRegistrationPasswordStrengthMeta } from '@/utils/registrationPasswordStrength';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей
import FormFieldWithValidation from '@/components/forms/FormFieldWithValidation'; // ✅ ИСПРАВЛЕНИЕ: Импорт улучшенного компонента
import { sendAnalyticsEvent } from '@/utils/analytics';
import {
    trackRegistrationFailed,
    trackRegistrationSubmitted,
    trackRegistrationSucceeded,
    trackRegistrationViewed,
} from '@/utils/growthFunnelAnalytics';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { useAuth } from '@/context/AuthContext';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import FacebookSignInButton from '@/components/auth/FacebookSignInButton';
import { webTouchScrollStyle } from '@/utils';
import { buildLoginHref, resolvePostAuthPath } from '@/utils/authNavigation';
import { translate as i18nT } from '@/i18n'


export default function RegisterForm() {
    const [showPass, setShowPass] = useState(false);
    const [generalMsg, setMsg] = useState<{ text: string; error: boolean }>({ text: '', error: false });
    // Держим кнопки заблокированными до фактической навигации после успеха,
    // чтобы за 1с окна до router.replace нельзя было повторно отправить форму.
    const [submitted, setSubmitted] = useState(false);
    const [googleBusy, setGoogleBusy] = useState(false);
    const [facebookBusy, setFacebookBusy] = useState(false);
    const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (navTimerRef.current) {
                clearTimeout(navTimerRef.current);
                navTimerRef.current = null;
            }
        };
    }, []);
    const { redirect, intent } = useLocalSearchParams<{ redirect?: string; intent?: string }>();
    const isFocused = useIsFocused();
    const router = useRouter();
    const { loginWithGoogle, loginWithFacebook } = useAuth();
    const colors = useThemedColors();
    const { isMobile } = useResponsive();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const pathname = usePathname();
    const { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } = require('@/utils/seo');
    const canonical = buildCanonicalUrl(pathname || '/registration');
    const replaceAfterAuth = () => {
        router.replace(resolvePostAuthPath({ redirect, intent }) as any);
    };

    useEffect(() => {
        if (!isFocused) return;
        trackRegistrationViewed({ source: 'registration', intent, redirect });
    }, [intent, isFocused, redirect]);

    const onSubmit = async (
        values: FormValues,
        { setSubmitting, resetForm }: { setSubmitting: (v: boolean) => void; resetForm: () => void },
    ) => {
        setMsg({ text: '', error: false });
        trackRegistrationSubmitted({ source: 'registration', intent, redirect, method: 'email' });
        try {
            const res = await registration(values);
            const ok = typeof res === 'object' && 'ok' in res ? res.ok : false;
            const message = typeof res === 'object' && 'message' in res ? res.message : String(res ?? '');

            if (!ok) {
                trackRegistrationFailed({
                    source: 'registration',
                    intent,
                    redirect,
                    method: 'email',
                    reason: 'api',
                });
                setMsg({ text: message || i18nT('authStatic:registration.failed'), error: true });
                return;
            }

            // AUTH-03: Явное welcome-сообщение
            setMsg({ text: i18nT('auth:components.auth.RegistrationForm.dobro_pozhalovat_akkaunt_sozdan_proverte_poc_7c94e26e'), error: false });
            resetForm();
            // Не разблокируем кнопку на успехе (finally вызовет setSubmitting(false)):
            // submitted держит её disabled до фактического router.replace.
            setSubmitted(true);
            trackRegistrationSucceeded({ source: 'registration', intent, redirect, method: 'email' });
            if (intent) {
                sendAnalyticsEvent('AuthSuccess', { source: 'home', intent });
            }
            if (navTimerRef.current) clearTimeout(navTimerRef.current);
            navTimerRef.current = setTimeout(() => {
                navTimerRef.current = null;
                replaceAfterAuth();
            }, 1000);
        } catch (e: any) {
            trackRegistrationFailed({
                source: 'registration',
                intent,
                redirect,
                method: 'email',
                reason: 'exception',
            });
            setMsg({ text: e?.message || i18nT('authStatic:registration.failed'), error: true });
        } finally {
            setSubmitting(false);
        }
    };

    const handleGoogleSignIn = async (credential: string) => {
        if (googleBusy || facebookBusy || submitted) return;
        setGoogleBusy(true);
        let navigating = false;
        try {
            setMsg({ text: '', error: false });
            trackRegistrationSubmitted({ source: 'registration', intent, redirect, method: 'google' });
            const ok = await loginWithGoogle(credential);
            if (ok) {
                trackRegistrationSucceeded({ source: 'registration', intent, redirect, method: 'google' });
                if (intent) {
                    sendAnalyticsEvent('AuthSuccess', { source: 'google', intent });
                }
                navigating = true;
                setSubmitted(true);
                replaceAfterAuth();
            } else {
                trackRegistrationFailed({
                    source: 'registration',
                    intent,
                    redirect,
                    method: 'google',
                    reason: 'api',
                });
                setMsg({ text: i18nT('auth:components.auth.RegistrationForm.ne_udalos_voyti_cherez_google_549109b3'), error: true });
            }
        } catch (e: any) {
            trackRegistrationFailed({
                source: 'registration',
                intent,
                redirect,
                method: 'google',
                reason: 'exception',
            });
            setMsg({ text: e?.message || i18nT('authStatic:google.signInFailed'), error: true });
        } finally {
            // На успехе оставляем заблокированным до размонтирования (идёт навигация).
            if (!navigating) setGoogleBusy(false);
        }
    };

    const handleGoogleError = (error: string) => {
        trackRegistrationFailed({
            source: 'registration',
            intent,
            redirect,
            method: 'google',
            reason: 'provider',
        });
        setMsg({ text: error, error: true });
    };

    const handleFacebookSignIn = async (credential: string) => {
        if (facebookBusy || googleBusy || submitted) return;
        setFacebookBusy(true);
        let navigating = false;
        try {
            setMsg({ text: '', error: false });
            trackRegistrationSubmitted({ source: 'registration', intent, redirect, method: 'facebook' });
            const ok = await loginWithFacebook(credential);
            if (ok) {
                trackRegistrationSucceeded({ source: 'registration', intent, redirect, method: 'facebook' });
                if (intent) sendAnalyticsEvent('AuthSuccess', { source: 'facebook', intent });
                navigating = true;
                setSubmitted(true);
                replaceAfterAuth();
            } else {
                trackRegistrationFailed({
                    source: 'registration',
                    intent,
                    redirect,
                    method: 'facebook',
                    reason: 'api',
                });
                setMsg({ text: i18nT('authStatic:facebook.signInFailed'), error: true });
            }
        } catch (e: unknown) {
            trackRegistrationFailed({
                source: 'registration',
                intent,
                redirect,
                method: 'facebook',
                reason: 'exception',
            });
            setMsg({ text: e instanceof Error ? e.message : i18nT('authStatic:facebook.signInFailed'), error: true });
        } finally {
            if (!navigating) setFacebookBusy(false);
        }
    };

    const handleFacebookError = (error: string) => {
        trackRegistrationFailed({
            source: 'registration',
            intent,
            redirect,
            method: 'facebook',
            reason: 'provider',
        });
        setMsg({ text: error, error: true });
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
    const passwordStrengthMeta = useMemo(
        () => getRegistrationPasswordStrengthMeta(values.password),
        [values.password],
    );

    const title = i18nT('auth:components.auth.RegistrationForm.registratsiya_v_metravel_akkaunt_i_marshruty_94d7b8e7');
    const description =
        i18nT('auth:components.auth.RegistrationForm.sozdayte_akkaunt_v_metravel_chtoby_publikova_7610c3f7');

    return (
        <>
            {isFocused ? (
                <InstantSEO
                    headKey="register"
                    title={title}
                    description={description}
                    canonical={canonical}
                    image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
                    ogType="website"
                    robots="noindex, nofollow"
                />
            ) : null}

            <KeyboardAvoidingView
                style={{ flex: 1, backgroundColor: colors.backgroundSecondary }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {Platform.OS === 'web' && !isMobile && (
                    <Image
                        source={require('../../assets/travel/roulette-map-bg.jpg')}
                        style={styles.mapBackground}
                        resizeMode="cover"
                    />
                )}
                <ScrollView style={webTouchScrollStyle} contentContainerStyle={{ flexGrow: 1 }}>
                    <View style={styles.bg}>
                                <View style={styles.center}>
                                    <View style={styles.card}>
                                            {Platform.OS === 'web' &&
                                                React.createElement(
                                                    'h1',
                                                    {
                                                        style: {
                                                            position: 'absolute' as const,
                                                            width: 1,
                                                            height: 1,
                                                            padding: 0,
                                                            margin: -1,
                                                            overflow: 'hidden' as const,
                                                            clip: 'rect(0,0,0,0)',
                                                            whiteSpace: 'nowrap',
                                                            borderWidth: 0,
                                                        } as any,
                                                    },
                                                    title
                                                )}
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
                                                label={i18nT('auth:components.auth.RegistrationForm.imya_polzovatelya_f7321ed7')}
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
                                                        placeholder={i18nT('auth:components.auth.RegistrationForm.imya_polzovatelya_f7321ed7')}
                                                        placeholderTextColor={colors.textMuted}
                                                        value={values.username}
                                                        onChangeText={handleChange('username')}
                                                        onBlur={handleBlur('username')}
                                                        autoCapitalize="none"
                                                        autoComplete="username"
                                                        textContentType="username"
                                                        returnKeyType="next"
                                                    />
                                                </View>
                                            </FormFieldWithValidation>

                                            {/* ✅ ИСПРАВЛЕНИЕ: Используем улучшенный компонент для email */}
                                            <FormFieldWithValidation
                                                label={i18nT('auth:components.auth.RegistrationForm.email_7e1a2f1e')}
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
                                                        placeholder={i18nT('auth:components.auth.RegistrationForm.email_7e1a2f1e')}
                                                        placeholderTextColor={colors.textMuted}
                                                        value={values.email}
                                                        onChangeText={handleChange('email')}
                                                        onBlur={handleBlur('email')}
                                                        keyboardType="email-address"
                                                        autoCapitalize="none"
                                                        autoComplete="email"
                                                        textContentType="emailAddress"
                                                        returnKeyType="next"
                                                    />
                                                </View>
                                            </FormFieldWithValidation>

                                            {/* ✅ ИСПРАВЛЕНИЕ: Используем улучшенный компонент для пароля */}
                                            <FormFieldWithValidation
                                                label={i18nT('auth:components.auth.RegistrationForm.parol_cf3a7cd2')}
                                                error={touched.password && errors.password ? errors.password : null}
                                                hint={i18nT('auth:components.auth.RegistrationForm.minimum_8_simvolov_luchshe_ispolzovat_bukvy__47013a93')}
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
                                                        placeholder={i18nT('auth:components.auth.RegistrationForm.parol_cf3a7cd2')}
                                                        placeholderTextColor={colors.textMuted}
                                                        value={values.password}
                                                        onChangeText={handleChange('password')}
                                                        onBlur={handleBlur('password')}
                                                        secureTextEntry={!showPass}
                                                        autoComplete="new-password"
                                                        textContentType="newPassword"
                                                        returnKeyType="next"
                                                    />
                                                    <Pressable
                                                        onPress={() => setShowPass(v => !v)}
                                                        hitSlop={8}
                                                        style={styles.eyeButton}
                                                        accessibilityRole="button"
                                                        accessibilityLabel={showPass ? i18nT('auth:components.auth.RegistrationForm.skryt_parol_69667518') : i18nT('auth:components.auth.RegistrationForm.pokazat_parol_63d309f3')}
                                                    >
                                                        <Feather
                                                            name={showPass ? 'eye-off' : 'eye'}
                                                            size={20}
                                                            color={colors.textMuted}
                                                        />
                                                    </Pressable>
                                                </View>
                                                <Text style={styles.passwordHint}>
                                                    {i18nT('auth:components.auth.RegistrationForm.minimum_8_simvolov_luchshe_dobavit_tsifru_i__b3e7b48b')}</Text>
                                                {passwordStrengthMeta && (
                                                    <View
                                                        style={styles.strengthContainer}
                                                        accessibilityRole="progressbar"
                                                        accessibilityValue={{
                                                            min: 0,
                                                            max: 100,
                                                            now: passwordStrengthMeta.progress,
                                                            text: i18nT('auth:components.auth.RegistrationForm.nadezhnost_parolya_value1_d7238316', { value1: passwordStrengthMeta.label }),
                                                        }}
                                                        accessibilityLabel={i18nT('auth:components.auth.RegistrationForm.nadezhnost_parolya_da369b84')}
                                                    >
                                                        <View style={styles.strengthBarBg}>
                                                            <View
                                                                style={[
                                                                    styles.strengthBarFill,
                                                                    {
                                                                        width: passwordStrengthMeta.width,
                                                                        backgroundColor: passwordStrengthMeta.color,
                                                                    },
                                                                ]}
                                                            />
                                                        </View>
                                                        <Text
                                                            style={[
                                                                styles.strengthLabel,
                                                                { color: passwordStrengthMeta.color },
                                                            ]}
                                                        >
                                                            {passwordStrengthMeta.label}
                                                        </Text>
                                                    </View>
                                                )}
                                            </FormFieldWithValidation>

                                            {/* ✅ ИСПРАВЛЕНИЕ: Используем улучшенный компонент для подтверждения пароля */}
                                            <FormFieldWithValidation
                                                label={i18nT('auth:components.auth.RegistrationForm.povtorite_parol_1e4f5f06')}
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
                                                        placeholder={i18nT('auth:components.auth.RegistrationForm.povtorite_parol_1e4f5f06')}
                                                        placeholderTextColor={colors.textMuted}
                                                        value={values.confirmPassword}
                                                        onChangeText={handleChange('confirmPassword')}
                                                        onBlur={handleBlur('confirmPassword')}
                                                        secureTextEntry={!showPass}
                                                        autoComplete="new-password"
                                                        textContentType="newPassword"
                                                        returnKeyType="done"
                                                        onSubmitEditing={() => handleSubmit()}
                                                    />
                                                </View>
                                            </FormFieldWithValidation>

                                            {/* ---------- button ---------- */}
                                            <Button
                                                label={isSubmitting || submitted ? i18nT('auth:components.auth.RegistrationForm.podozhdite_c6f74920') : i18nT('auth:components.auth.RegistrationForm.zaregistrirovatsya_3ca6aeb7')}
                                                onPress={() => handleSubmit()}
                                                disabled={isSubmitting || submitted || googleBusy || facebookBusy}
                                                loading={isSubmitting || submitted}
                                                variant="primary"
                                                size="lg"
                                                style={styles.btn}
                                                accessibilityLabel={i18nT('auth:components.auth.RegistrationForm.zaregistrirovatsya_3ca6aeb7')}
                                            />

                                            <View style={styles.dividerContainer}>
                                                <View style={styles.dividerLine} />
                                                <Text style={styles.dividerText}>{i18nT('auth:components.auth.RegistrationForm.ili_956a0bdd')}</Text>
                                                <View style={styles.dividerLine} />
                                            </View>

                                            <View style={styles.socialActions}>
                                                <GoogleSignInButton
                                                    onSuccess={handleGoogleSignIn}
                                                    onError={handleGoogleError}
                                                    disabled={isSubmitting || submitted || googleBusy || facebookBusy}
                                                />
                                                <FacebookSignInButton
                                                    onSuccess={handleFacebookSignIn}
                                                    onError={handleFacebookError}
                                                    disabled={isSubmitting || submitted || googleBusy || facebookBusy}
                                                />
                                            </View>

                                            <View style={styles.loginContainer}>
                                                <Text style={styles.loginText}>{i18nT('auth:components.auth.RegistrationForm.uzhe_est_akkaunt_3eaf8790')}</Text>
                                                <Pressable
                                                    onPress={() =>
                                                        router.push(
                                                            (redirect && typeof redirect === 'string')
                                                                ? (buildLoginHref({ redirect, intent }) as any)
                                                                : (`/login${intent ? `?intent=${encodeURIComponent(intent)}` : ''}` as any)
                                                        )
                                                    }
                                                    disabled={isSubmitting || submitted || googleBusy || facebookBusy}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={i18nT('auth:components.auth.RegistrationForm.voyti_v_akkaunt_c9c50168')}
                                                >
                                                    <Text style={styles.loginLink}>{i18nT('auth:components.auth.RegistrationForm.voyti_4b1b46b3')}</Text>
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
        backgroundColor: colors.dangerSoft,
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
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    passwordHint: {
        marginTop: 6,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        lineHeight: 16,
        color: colors.textMuted,
    },
    // ✅ ИСПРАВЛЕНИЕ: Стили больше не используются (ошибки показываются через FormFieldWithValidation)
    err: { color: colors.dangerDark, marginBottom: 6, textAlign: 'left' },
    ok: { 
        color: colors.success, 
        marginBottom: 20, 
        textAlign: 'center', 
        fontWeight: 'bold',
        padding: 12,
        borderRadius: 8,
        backgroundColor: colors.successSoft,
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
    socialActions: {
        gap: 12,
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
        color: colors.primaryText,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    btn: {
        backgroundColor: colors.primary,
        borderRadius: DESIGN_TOKENS.radii.lg,
        marginTop: 8,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border,
    },
    dividerText: {
        marginHorizontal: 16,
        fontSize: 14,
        color: colors.textMuted,
        fontWeight: '500',
    },
});
