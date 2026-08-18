// app/registration.tsx (или соответствующий путь)
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
import { registrationEmailSchema } from '@/utils/validation';
import { getRegistrationPasswordStrengthMeta } from '@/utils/registrationPasswordStrength';
import { deriveUsernameFromEmail } from '@/utils/deriveUsername';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import FormFieldWithValidation from '@/components/forms/FormFieldWithValidation';
import AuthBenefits from '@/components/auth/AuthBenefits';
import { sendAnalyticsEvent } from '@/utils/analytics';
import {
    trackRegistrationFailed,
    trackRegistrationSubmitted,
    trackRegistrationSucceeded,
    trackRegistrationViewed,
} from '@/utils/growthFunnelAnalytics';
import { notifyAuthProgressSaved } from '@/utils/authProgressToast';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { useAuth } from '@/context/AuthContext';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import FacebookAuthFlow from '@/components/auth/FacebookAuthFlow';
import { webTouchScrollStyle } from '@/utils';
import { buildLoginHref, resolvePostAuthPath } from '@/utils/authNavigation';
import { translate as i18nT } from '@/i18n'

// INV2-07: streamlined form collects only email + password. Username is derived
// from the email at submit time and the confirm-password field is removed.
interface RegistrationFormValues {
    email: string;
    password: string;
}

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
    const { loginWithGoogle } = useAuth();
    const colors = useThemedColors();
    const { isMobile } = useResponsive();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const hasReturnContext = Boolean(intent || redirect);

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
        values: RegistrationFormValues,
        { setSubmitting, resetForm }: { setSubmitting: (v: boolean) => void; resetForm: () => void },
    ) => {
        setMsg({ text: '', error: false });
        trackRegistrationSubmitted({ source: 'registration', intent, redirect, method: 'email' });
        try {
            const email = values.email.trim();
            // Backend RegisterSerializer still requires username + confirmPassword;
            // derive the display name from the email and mirror the password so
            // the streamlined 2-field UI stays compatible with the API contract.
            const payload: FormValues = {
                username: deriveUsernameFromEmail(email),
                email,
                password: values.password,
                confirmPassword: values.password,
            };
            const res = await registration(payload);
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

            // AUTH-03: явное welcome-сообщение. Email-регистрация создаёт неактивный
            // аккаунт (нужно подтверждение по почте), поэтому здесь НЕ показываем
            // тост «сохранили прогресс» — сессии ещё нет.
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
                notifyAuthProgressSaved(hasReturnContext);
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

    const handleFacebookAttempt = () => {
        setMsg({ text: '', error: false });
        trackRegistrationSubmitted({ source: 'registration', intent, redirect, method: 'facebook' });
    };

    const handleFacebookAuthenticated = () => {
        trackRegistrationSucceeded({ source: 'registration', intent, redirect, method: 'facebook' });
        if (intent) sendAnalyticsEvent('AuthSuccess', { source: 'facebook', intent });
        setSubmitted(true);
        notifyAuthProgressSaved(hasReturnContext);
        replaceAfterAuth();
    };

    const handleFacebookFailure = (reason: string) => {
        trackRegistrationFailed({
            source: 'registration',
            intent,
            redirect,
            method: 'facebook',
            // The Facebook flow exposes detailed internal error codes (for
            // example completion_start). Growth analytics intentionally keeps a
            // small stable taxonomy, so only the provider category passes
            // through and all handled backend-flow failures normalize to api.
            reason: reason === 'provider' ? 'provider' : 'api',
        });
    };

    const {
        values,
        errors,
        touched,
        isSubmitting,
        handleChange,
        handleBlur,
        handleSubmit,
    } = useYupForm<RegistrationFormValues>({
        initialValues: { email: '', password: '' },
        validationSchema: registrationEmailSchema,
        onSubmit,
    });
    const passwordStrengthMeta = useMemo(
        () => getRegistrationPasswordStrengthMeta(values.password),
        [values.password],
    );

    const title = i18nT('auth:components.auth.RegistrationForm.registratsiya_v_metravel_akkaunt_i_marshruty_94d7b8e7');
    const description =
        i18nT('auth:components.auth.RegistrationForm.sozdayte_akkaunt_v_metravel_chtoby_publikova_7610c3f7');
    const busy = isSubmitting || submitted || googleBusy || facebookBusy;

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
                                {/* ---------- header ---------- */}
                                {Platform.OS === 'web' ? (
                                    React.createElement(
                                        'h1',
                                        { style: { margin: 0, marginBottom: 6, fontSize: 24, lineHeight: '30px', fontWeight: 800, color: colors.text } as any },
                                        i18nT('authStatic:authScreen.register.title'),
                                    )
                                ) : (
                                    <Text style={styles.heading}>
                                        {i18nT('authStatic:authScreen.register.title')}
                                    </Text>
                                )}
                                <Text style={styles.subtitle}>
                                    {i18nT('authStatic:authScreen.register.subtitle')}
                                </Text>

                                {/* ---------- value proposition ---------- */}
                                <AuthBenefits />

                                {generalMsg.text !== '' && (
                                    <Text
                                        style={[
                                            styles.msg,
                                            generalMsg.error ? styles.err : styles.ok,
                                        ]}
                                        accessibilityLiveRegion="polite"
                                    >
                                        {generalMsg.text}
                                    </Text>
                                )}

                                {/* ---------- social first ---------- */}
                                <View style={styles.socialActions}>
                                    <GoogleSignInButton
                                        onSuccess={handleGoogleSignIn}
                                        onError={handleGoogleError}
                                        disabled={busy}
                                    />
                                    <FacebookAuthFlow
                                        onAttempt={handleFacebookAttempt}
                                        onAuthenticated={handleFacebookAuthenticated}
                                        onFailure={handleFacebookFailure}
                                        onBusyChange={setFacebookBusy}
                                        disabled={isSubmitting || submitted || googleBusy}
                                    />
                                </View>

                                <View style={styles.dividerContainer}>
                                    <View style={styles.dividerLine} />
                                    <Text style={styles.dividerText}>{i18nT('authStatic:authScreen.dividerEmail')}</Text>
                                    <View style={styles.dividerLine} />
                                </View>

                                {/* ---------- email + password ---------- */}
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
                                            style={[styles.input, globalFocusStyles.focusable]}
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
                                            style={[styles.input, globalFocusStyles.focusable]}
                                            placeholder={i18nT('auth:components.auth.RegistrationForm.parol_cf3a7cd2')}
                                            placeholderTextColor={colors.textMuted}
                                            value={values.password}
                                            onChangeText={handleChange('password')}
                                            onBlur={handleBlur('password')}
                                            secureTextEntry={!showPass}
                                            autoComplete="new-password"
                                            textContentType="newPassword"
                                            returnKeyType="done"
                                            onSubmitEditing={() => handleSubmit()}
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

                                {/* ---------- button ---------- */}
                                <Button
                                    label={isSubmitting || submitted ? i18nT('auth:components.auth.RegistrationForm.podozhdite_c6f74920') : i18nT('auth:components.auth.RegistrationForm.zaregistrirovatsya_3ca6aeb7')}
                                    onPress={() => handleSubmit()}
                                    disabled={busy}
                                    loading={isSubmitting || submitted}
                                    variant="primary"
                                    size="lg"
                                    style={styles.btn}
                                    accessibilityLabel={i18nT('auth:components.auth.RegistrationForm.zaregistrirovatsya_3ca6aeb7')}
                                />

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
                                        disabled={busy}
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
        paddingVertical: 24,
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
    heading: {
        fontSize: 24,
        lineHeight: 30,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 6,
    },
    subtitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        lineHeight: 20,
        color: colors.textMuted,
        marginBottom: DESIGN_TOKENS.spacing.lg,
    },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: DESIGN_TOKENS.radii.sm,
        backgroundColor: colors.surface,
        paddingHorizontal: 12,
        marginBottom: 0,
        minHeight: 44,
        ...Platform.select({
            web: {
                transition: 'border-color 0.2s ease',
            },
        }),
    },
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
        minHeight: 44,
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
});
