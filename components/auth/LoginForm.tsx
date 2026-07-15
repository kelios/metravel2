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
import FormFieldWithValidation from '@/components/forms/FormFieldWithValidation'; // ✅ ИСПРАВЛЕНИЕ: Импорт улучшенного компонента
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей
import { sendAnalyticsEvent } from '@/utils/analytics';
import { trackRegisterCtaClicked } from '@/utils/growthFunnelAnalytics';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import { webTouchScrollStyle } from '@/utils';
import { buildRegistrationHref, resolvePostAuthPath } from '@/utils/authNavigation';
import { translate as i18nT } from '@/i18n'


interface LoginFormValues {
    email: string;
    password: string;
}

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
    const passwordRef = useRef<TextInput>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);

    /* ---------- helpers ---------- */
    const router = useRouter();
    const { login, loginWithGoogle, sendPassword, isAuthenticated } = useAuth();
    const { redirect, intent } = useLocalSearchParams<{ redirect?: string; intent?: string }>();

    const isFocused = useIsFocused();
    const pathname = usePathname();
    const { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } = require('@/utils/seo');
    const canonical = buildCanonicalUrl(pathname || '/login');
    const colors = useThemedColors();
    const { isMobile } = useResponsive();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const showMsg = (text: string, error = false) => {
        if (!mountedRef.current) return;
        setMsg({ text, error });
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
                router.replace(resolvePostAuthPath({ redirect, intent }) as any);
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
        if (googleBusy || submitted) return;
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
                router.replace(resolvePostAuthPath({ redirect, intent }) as any);
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
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {Platform.OS === 'web' && !isMobile && (
                    <Image
                        source={require('../../assets/travel/roulette-map-bg.jpg')}
                        style={styles.mapBackground}
                        resizeMode="cover"
                    />
                )}
                <ScrollView
                    style={webTouchScrollStyle}
                    contentContainerStyle={styles.scrollViewContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.bg}>
                        <View style={styles.inner}>
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

                                                {/* ✅ ИСПРАВЛЕНИЕ: Используем улучшенный компонент для email */}
                                                <FormFieldWithValidation
                                                    label={i18nT('auth:components.auth.LoginForm.email_c5e1625d')}
                                                    error={touched.email && errors.email ? errors.email : null}
                                                    required
                                                >
                                                    <TextInput
                                                        style={[
                                                            styles.input,
                                                            touched.email && errors.email && styles.inputError,
                                                            globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
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

                                                {/* ✅ ИСПРАВЛЕНИЕ: Используем улучшенный компонент для пароля */}
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
                                                    disabled={isSubmitting || submitted || googleBusy}
                                                    loading={isSubmitting || submitted}
                                                    variant="primary"
                                                    size="lg"
                                                    style={styles.btn}
                                                    accessibilityLabel={i18nT('auth:components.auth.LoginForm.voyti_608953ec')}
                                                />

                                                <Pressable
                                                    onPress={() => handleResetPassword(values.email)}
                                                    disabled={isSubmitting || submitted || googleBusy}
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

                                                <View style={styles.dividerContainer}>
                                                    <View style={styles.dividerLine} />
                                                    <Text style={styles.dividerText}>{i18nT('auth:components.auth.LoginForm.ili_c82ebb8c')}</Text>
                                                    <View style={styles.dividerLine} />
                                                </View>

                                                <GoogleSignInButton
                                                    onSuccess={handleGoogleSignIn}
                                                    onError={handleGoogleError}
                                                    disabled={isSubmitting || submitted || googleBusy}
                                                />

                                            <View style={styles.registerContainer}>
                                                <Text style={styles.registerText}>{i18nT('auth:components.auth.LoginForm.net_akkaunta_6dd7f1de')}</Text>
                                                <Link
                                                    href={
                                                        (redirect && typeof redirect === 'string')
                                                            ? (buildRegistrationHref({ redirect, intent }) as any)
                                                            : (`/registration${intent ? `?intent=${encodeURIComponent(intent)}` : ''}` as any)
                                                    }
                                                    style={styles.registerLink}
                                                    disabled={isSubmitting || submitted || googleBusy}
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
    mapBackground: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
    scrollViewContent: {
        flexGrow: 1,
        justifyContent: 'center',
        ...Platform.select({
            web: {
                paddingBottom: 'var(--mt-consent-h, 0px)' as any,
            },
        }),
    },
    bg: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    inner: {
        width: '100%',
        maxWidth: 440,
        paddingHorizontal: 16,
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
