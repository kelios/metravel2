// app/login.tsx (или соответствующий путь)
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
import { useIsFocused } from 'expo-router';
import { Link, useLocalSearchParams, usePathname, useRouter } from 'expo-router';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import { useAuth } from '@/context/AuthContext';
import { loginSchema } from '@/utils/validation';
import { useYupForm } from '@/hooks/useYupForm';
import FormFieldWithValidation from '@/components/forms/FormFieldWithValidation';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { sendAnalyticsEvent } from '@/utils/analytics';
import { trackRegisterCtaClicked } from '@/utils/growthFunnelAnalytics';
import { notifyAuthProgressSaved } from '@/utils/authProgressToast';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import type { AppleCredentialPayload } from '@/api/appleAuth';
import AppleSignInButton from '@/components/auth/AppleSignInButton';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import FacebookAuthFlow from '@/components/auth/FacebookAuthFlow';
import { webTouchScrollStyle } from '@/utils';
import { buildRegistrationHref, resolvePostAuthPath } from '@/utils/authNavigation';
import { translate as i18nT } from '@/i18n'


interface LoginFormValues {
    email: string;
    password: string;
}

export const resolveLoginKeyboardAvoidingBehavior = (platform: typeof Platform.OS) =>
    platform === 'ios' ? 'height' as const : undefined;

const getErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && typeof error.message === 'string' && error.message.trim()) {
        return error.message;
    }
    return fallback;
};

export default function Login() {
    /* ---------- state ---------- */
    const [msg, setMsg] = useState<{ text: string; error: boolean }>({ text: '', error: false });
    const [showPassword, setShowPassword] = useState(false);
    // Держим кнопки заблокированными до фактической навигации после успеха,
    // чтобы окно до router.replace не позволяло повторную/конкурирующую авторизацию.
    const [submitted, setSubmitted] = useState(false);
    const [googleBusy, setGoogleBusy] = useState(false);
    const [facebookBusy, setFacebookBusy] = useState(false);
    const [appleBusy, setAppleBusy] = useState(false);
    const passwordRef = useRef<TextInput>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);

    /* ---------- helpers ---------- */
    const router = useRouter();
    const { login, loginWithGoogle, loginWithApple, sendPassword, isAuthenticated } = useAuth();
    const { redirect, intent } = useLocalSearchParams<{ redirect?: string; intent?: string }>();

    const isFocused = useIsFocused();
    const pathname = usePathname();
    const { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } = require('@/utils/seo');
    const canonical = buildCanonicalUrl(pathname || '/login');
    const colors = useThemedColors();
    const { isMobile } = useResponsive();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const hasReturnContext = Boolean(intent || redirect);

    const showMsg = (text: string, error = false) => {
        if (!mountedRef.current) return;
        setMsg({ text, error });
    };
    const replaceAfterAuth = () => {
        router.replace(resolvePostAuthPath({ redirect, intent }) as any);
    };

    React.useEffect(() => {
        if (!isFocused) return;
        if (!intent) return;
        sendAnalyticsEvent('AuthViewed', { source: String(intent || 'unknown'), intent });
    }, [intent, isFocused]);

    // Native fix (#670): /login is a tab route, so on native the screen stays
    // MOUNTED after a successful login navigates away (router.replace never
    // unmounts a tab screen). The `submitted`/`googleBusy` latches — which are
    // set on success and intentionally never reset (they rely on unmount) — then
    // stay `true`. After logout the user returns to the same mounted instance and
    // every auth button is permanently disabled/loading ("Подождите…"), and the
    // Google handler early-returns on `submitted`. Clear the latches whenever the
    // screen regains focus while unauthenticated, so a second login can proceed.
    // On web this is a harmless no-op: the component remounts fresh on navigation.
    React.useEffect(() => {
        if (isFocused && !isAuthenticated) {
            setSubmitted(false);
            setGoogleBusy(false);
            setFacebookBusy(false);
            setAppleBusy(false);
        }
    }, [isFocused, isAuthenticated]);

    /* ---------- actions ---------- */
    const handleResetPassword = async (email: string) => {
        // ✅ ИСПРАВЛЕНИЕ: Валидация email перед отправкой запроса
        const trimmedEmail = email.trim();

        if (!trimmedEmail) {
            showMsg(i18nT('auth:components.auth.LoginForm.vvedite_email_adres_51fd4d2d'), true);
            return;
        }

        // Проверка формата email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            showMsg(i18nT('auth:components.auth.LoginForm.vvedite_korrektnyy_email_adres_04386f4a'), true);
            return;
        }

        try {
            const res = await sendPassword(trimmedEmail);
            showMsg(res, /ошиб|не удалось/i.test(res));
        } catch (error) {
            showMsg(getErrorMessage(error, i18nT('auth:components.auth.LoginForm.oshibka_pri_sbrose_parolya_2500a38a')), true);
        }
    };

    const handleLogin = async (
        values: LoginFormValues,
        { setSubmitting }: { setSubmitting: (v: boolean) => void }
    ) => {
        try {
            showMsg('');
            const ok = await login(values.email.trim(), values.password);
            if (ok) {
                sendAnalyticsEvent('login_success', { method: 'email', intent: String(intent || '') });
                if (intent) {
                    sendAnalyticsEvent('AuthSuccess', { source: String(intent || 'unknown'), intent });
                }
                // Держим форму заблокированной до фактической навигации (finally вызовет
                // setSubmitting(false), но submitted оставляет кнопки disabled).
                setSubmitted(true);
                notifyAuthProgressSaved(hasReturnContext);
                replaceAfterAuth();
            } else {
                showMsg(i18nT('auth:components.auth.LoginForm.nevernyy_email_ili_parol_18c8d999'), true);
            }
        } catch (error) {
            showMsg(getErrorMessage(error, i18nT('auth:components.auth.LoginForm.oshibka_pri_vhode_e41ad402')), true);
        } finally {
            setSubmitting(false);
        }
    };

    const handleGoogleSignIn = async (credential: string) => {
        if (googleBusy || facebookBusy || appleBusy || submitted) return;
        setGoogleBusy(true);
        let navigating = false;
        try {
            showMsg('');
            const ok = await loginWithGoogle(credential);
            if (ok) {
                sendAnalyticsEvent('login_success', { method: 'google', intent: String(intent || '') });
                if (intent) {
                    sendAnalyticsEvent('AuthSuccess', { source: 'google', intent });
                }
                navigating = true;
                setSubmitted(true);
                notifyAuthProgressSaved(hasReturnContext);
                replaceAfterAuth();
            } else {
                showMsg(i18nT('auth:components.auth.LoginForm.ne_udalos_voyti_cherez_google_0930989b'), true);
            }
        } catch (error) {
            showMsg(getErrorMessage(error, i18nT('auth:components.auth.LoginForm.oshibka_pri_vhode_cherez_google_e89e4a9b')), true);
        } finally {
            // На успехе оставляем заблокированным до размонтирования (идёт навигация).
            if (!navigating && mountedRef.current) setGoogleBusy(false);
        }
    };

    const handleGoogleError = (error: string) => {
        showMsg(error, true);
    };

    // IOS-05: Apple отдаёт credential, серверную проверку делает #1412.
    const handleAppleSignIn = async (credential: AppleCredentialPayload) => {
        if (googleBusy || facebookBusy || appleBusy || submitted) return;
        setAppleBusy(true);
        let navigating = false;
        try {
            showMsg('');
            const result = await loginWithApple(credential);
            if (result.status === 'authenticated') {
                sendAnalyticsEvent('login_success', { method: 'apple', intent: String(intent || '') });
                if (intent) {
                    sendAnalyticsEvent('AuthSuccess', { source: 'apple', intent });
                }
                navigating = true;
                setSubmitted(true);
                notifyAuthProgressSaved(hasReturnContext);
                replaceAfterAuth();
            } else {
                showMsg(result.message || i18nT('authStatic:apple.signInFailed'), true);
            }
        } catch (error) {
            showMsg(getErrorMessage(error, i18nT('authStatic:apple.signInFailed')), true);
        } finally {
            // На успехе оставляем заблокированным до размонтирования (идёт навигация).
            if (!navigating && mountedRef.current) setAppleBusy(false);
        }
    };

    const handleAppleError = (error: string) => {
        showMsg(error, true);
    };

    const handleFacebookAuthenticated = () => {
        sendAnalyticsEvent('login_success', { method: 'facebook', intent: String(intent || '') });
        if (intent) sendAnalyticsEvent('AuthSuccess', { source: 'facebook', intent });
        setSubmitted(true);
        notifyAuthProgressSaved(hasReturnContext);
        replaceAfterAuth();
    };

    const {
        values,
        errors,
        touched,
        isSubmitting,
        handleChange,
        handleBlur,
        handleSubmit,
    } = useYupForm<LoginFormValues>({
        initialValues: { email: '', password: '' },
        validationSchema: loginSchema,
        onSubmit: handleLogin,
    });

    const title = i18nT('auth:components.auth.LoginForm.vhod_v_metravel_akkaunt_marshruty_i_hochu_po_bf2420aa');
    const description =
        i18nT('auth:components.auth.LoginForm.voydite_v_akkaunt_metravel_chtoby_sohranyat__2df803f3');
    const busy = isSubmitting || submitted || googleBusy || facebookBusy || appleBusy;

    /* ---------- render ---------- */
    return (
        <>
            {isFocused ? (
                <InstantSEO
                    headKey="login"
                    title={title}
                    description={description}
                    canonical={canonical}
                    image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
                    ogType="website"
                    robots="noindex, nofollow"
                />
            ) : null}

            <KeyboardAvoidingView
                testID="login-keyboard-avoiding-view"
                style={styles.container}
                behavior={resolveLoginKeyboardAvoidingBehavior(Platform.OS)}
            >
                {Platform.OS === 'web' && !isMobile && (
                    <Image
                        source={require('../../assets/travel/roulette-map-bg.jpg')}
                        style={styles.mapBackground}
                        resizeMode="cover"
                    />
                )}
                <ScrollView
                    testID="login-scroll-view"
                    style={[styles.scrollView, webTouchScrollStyle]}
                    contentContainerStyle={styles.scrollViewContent}
                    keyboardShouldPersistTaps="handled"
                    automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                >
                    <View testID="login-scroll-content" style={styles.bg}>
                        <View style={styles.inner}>
                            <View style={styles.card}>
                                {/* ---------- header ---------- */}
                                {Platform.OS === 'web' ? (
                                    React.createElement(
                                        'h1',
                                        { style: { margin: 0, marginBottom: 6, fontSize: 24, lineHeight: '30px', fontWeight: 800, color: colors.text } as any },
                                        i18nT('authStatic:authScreen.login.title'),
                                    )
                                ) : (
                                    <Text style={styles.heading}>
                                        {i18nT('authStatic:authScreen.login.title')}
                                    </Text>
                                )}
                                <Text style={styles.subtitle}>
                                    {i18nT('authStatic:authScreen.login.subtitle')}
                                </Text>

                                {msg.text !== '' && (
                                    <Text
                                        style={[
                                            styles.message,
                                            msg.error ? styles.err : styles.ok,
                                        ]}
                                        accessibilityLiveRegion="polite"
                                    >
                                        {msg.text}
                                    </Text>
                                )}

                                {/* ---------- social first ---------- */}
                                <View style={styles.socialActions}>
                                    {/* Apple первым: HIG требует показывать Sign in with Apple
                                        не менее заметно, чем прочие провайдеры. */}
                                    <AppleSignInButton
                                        onSuccess={handleAppleSignIn}
                                        onError={handleAppleError}
                                        disabled={busy}
                                    />
                                    <GoogleSignInButton
                                        onSuccess={handleGoogleSignIn}
                                        onError={handleGoogleError}
                                        disabled={busy}
                                    />
                                    <FacebookAuthFlow
                                        onAuthenticated={handleFacebookAuthenticated}
                                        onBusyChange={setFacebookBusy}
                                        disabled={isSubmitting || submitted || googleBusy || appleBusy}
                                    />
                                </View>

                                <View style={styles.dividerContainer}>
                                    <View style={styles.dividerLine} />
                                    <Text style={styles.dividerText}>{i18nT('authStatic:authScreen.dividerEmail')}</Text>
                                    <View style={styles.dividerLine} />
                                </View>

                                {/* ---------- email + password ---------- */}
                                <FormFieldWithValidation
                                    label={i18nT('auth:components.auth.LoginForm.email_c5e1625d')}
                                    error={touched.email && errors.email ? errors.email : null}
                                    required
                                >
                                    <TextInput
                                        style={[
                                            styles.input,
                                            touched.email && errors.email && styles.inputError,
                                            globalFocusStyles.focusable,
                                        ]}
                                        placeholder={i18nT('auth:components.auth.LoginForm.email_c5e1625d')}
                                        value={values.email}
                                        onChangeText={handleChange('email')}
                                        onBlur={handleBlur('email')}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoComplete="email"
                                        textContentType="emailAddress"
                                        placeholderTextColor={colors.textMuted}
                                        returnKeyType="next"
                                        blurOnSubmit={false}
                                        onSubmitEditing={() => passwordRef.current?.focus()}
                                    />
                                </FormFieldWithValidation>

                                <FormFieldWithValidation
                                    label={i18nT('auth:components.auth.LoginForm.parol_288eb6a9')}
                                    error={touched.password && errors.password ? errors.password : null}
                                    required
                                >
                                    <View style={styles.passwordContainer}>
                                        <TextInput
                                            ref={passwordRef}
                                            style={[
                                                styles.input,
                                                styles.passwordInput,
                                                touched.password && errors.password && styles.inputError,
                                                globalFocusStyles.focusable,
                                            ]}
                                            placeholder={i18nT('auth:components.auth.LoginForm.parol_288eb6a9')}
                                            value={values.password}
                                            onChangeText={handleChange('password')}
                                            onBlur={handleBlur('password')}
                                            secureTextEntry={!showPassword}
                                            autoComplete="current-password"
                                            textContentType="password"
                                            placeholderTextColor={colors.textMuted}
                                            returnKeyType="done"
                                            onSubmitEditing={() => handleSubmit()}
                                        />
                                        <Pressable
                                            onPress={() => setShowPassword((v) => !v)}
                                            style={[styles.eyeButton, globalFocusStyles.focusable]}
                                            accessibilityRole="button"
                                            accessibilityLabel={showPassword ? i18nT('auth:components.auth.LoginForm.skryt_parol_406391d8') : i18nT('auth:components.auth.LoginForm.pokazat_parol_cfedfb8e')}
                                            hitSlop={8}
                                        >
                                            <Feather
                                                name={showPassword ? 'eye-off' : 'eye'}
                                                size={20}
                                                color={colors.textMuted}
                                            />
                                        </Pressable>
                                    </View>
                                </FormFieldWithValidation>

                                <Button
                                    label={isSubmitting || submitted ? i18nT('auth:components.auth.LoginForm.podozhdite_113cf4cf') : i18nT('auth:components.auth.LoginForm.voyti_608953ec')}
                                    onPress={() => handleSubmit()}
                                    disabled={busy}
                                    loading={isSubmitting || submitted}
                                    variant="primary"
                                    size="lg"
                                    style={styles.btn}
                                    accessibilityLabel={i18nT('auth:components.auth.LoginForm.voyti_608953ec')}
                                />

                                <Pressable
                                    onPress={() => handleResetPassword(values.email)}
                                    disabled={busy}
                                    style={({ pressed }) => [
                                        styles.forgotButton,
                                        pressed && { opacity: 0.7 },
                                        globalFocusStyles.focusable,
                                    ]}
                                    accessibilityRole="button"
                                    accessibilityLabel={i18nT('auth:components.auth.LoginForm.sbrosit_parol_ec9af7c3')}
                                >
                                    <Text style={styles.forgot}>{i18nT('auth:components.auth.LoginForm.zabyli_parol_05f81115')}</Text>
                                </Pressable>

                                <View style={styles.registerContainer}>
                                    <Text style={styles.registerText}>{i18nT('auth:components.auth.LoginForm.net_akkaunta_6dd7f1de')}</Text>
                                    <Link
                                        href={
                                            (redirect && typeof redirect === 'string')
                                                ? (buildRegistrationHref({ redirect, intent }) as any)
                                                : (`/registration${intent ? `?intent=${encodeURIComponent(intent)}` : ''}` as any)
                                        }
                                        style={styles.registerLink}
                                        disabled={busy}
                                        onPress={() => {
                                            trackRegisterCtaClicked({
                                                source: 'login_form',
                                                intent,
                                                authState: 'guest',
                                            });
                                        }}
                                    >
                                        {i18nT('auth:components.auth.LoginForm.zaregistriruytes_2bd038aa')}</Link>
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
    container: {
        flex: 1,
        backgroundColor: colors.backgroundSecondary,
    },
    scrollView: {
        // KeyboardAvoidingView changes its height on iOS. The child viewport
        // must flex so it actually shrinks above the keyboard.
        ...Platform.select({ ios: { flex: 1 }, default: {} }),
    },
    mapBackground: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
    scrollViewContent: {
        flexGrow: 1,
        ...Platform.select({
            ios: {
                justifyContent: 'flex-start',
            },
            web: {
                justifyContent: 'center',
                paddingBottom: 'var(--mt-consent-h, 0px)' as any,
            },
            default: {
                justifyContent: 'center',
            },
        }),
    },
    bg: {
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        ...Platform.select({
            // `flex: 1` shrinks the iOS ScrollView content to its viewport,
            // so the lower fields only overflow visually and cannot be
            // scrolled above the keyboard. Grow to at least the viewport but
            // keep the intrinsic card height in the scroll content size.
            ios: { flexGrow: 1 },
            default: { flex: 1 },
        }),
    },
    inner: {
        width: '100%',
        maxWidth: 440,
        paddingHorizontal: 16,
        paddingVertical: 24,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: DESIGN_TOKENS.radii.xl,
        padding: 24,
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
    input: {
        marginBottom: 0, // ✅ Отступ управляется FormFieldWithValidation
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: DESIGN_TOKENS.radii.md,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        backgroundColor: colors.surface,
        color: colors.text,
        minHeight: 48,
        ...Platform.select({
            web: {
                transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
            },
        }),
    },
    btn: {
        backgroundColor: colors.primary,
        borderRadius: DESIGN_TOKENS.radii.lg,
        marginTop: 8,
    },
    passwordContainer: {
        position: 'relative' as const,
        width: '100%',
    },
    passwordInput: {
        paddingRight: 48,
    },
    eyeButton: {
        position: 'absolute' as const,
        right: 4,
        top: 0,
        bottom: 0,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        width: 44,
        minHeight: 44,
        ...Platform.select({
            web: {
                cursor: 'pointer' as any,
            },
        }),
    },
    forgotButton: {
        alignSelf: 'center' as const,
        marginTop: 16,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        minHeight: 44,
        justifyContent: 'center' as const,
        ...Platform.select({
            web: {
                cursor: 'pointer' as any,
                transition: 'opacity 0.15s ease' as any,
            },
        }),
    },
    forgot: {
        color: colors.primaryText,
        fontSize: 14,
        fontWeight: '500' as const,
    },
    socialActions: {
        gap: 12,
    },
    registerContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    registerText: {
        fontSize: 14,
        color: colors.textMuted,
    },
    registerLink: {
        fontSize: 14,
        color: colors.primaryText,
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
