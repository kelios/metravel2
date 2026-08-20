import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useTheme, useThemedColors } from '@/hooks/useTheme';
import { getGoogleSignInButtonTheme } from './googleSignInButtonTheme';
import { translate as i18nT } from '@/i18n'
import { useHydrationReady } from '@/hooks/useHydrationReady';
import { useExternalScript } from '@/hooks/useExternalScript';


interface GoogleSignInButtonProps {
    onSuccess: (credential: string) => void;
    onError?: (error: string) => void;
    disabled?: boolean;
}

declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: {
                        client_id: string;
                        callback: (response: { credential?: string }) => void;
                        itp_support?: boolean;
                        use_fedcm_for_prompt?: boolean;
                    }) => void;
                    renderButton: (
                        parent: HTMLElement,
                        options: {
                            type?: 'standard' | 'icon';
                            theme?: 'outline' | 'filled_blue' | 'filled_black' | 'outline_dark';
                            size?: 'large' | 'medium' | 'small';
                            text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
                            shape?: 'rectangular' | 'pill' | 'circle' | 'square';
                            logo_alignment?: 'left' | 'center';
                            width?: string | number;
                        }
                    ) => void;
                };
            };
        };
    }
}

const GOOGLE_GSI_SCRIPT_ID = 'google-gsi-client-script';
const GOOGLE_GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
// Matches the Facebook button block (minHeight 48) so the two social buttons
// read as one pair; also pins the host against GSI's 44->80px resize (#1299).
const GOOGLE_GSI_BUTTON_HEIGHT = 48;
// GSI clamps `width` to this range and never renders narrower than its localized
// label needs (measured: 233px for RU "Вход через аккаунт Google"). Inside the
// range it honours the request exactly, so we ask for the column width.
const GSI_MIN_SUPPORTED_WIDTH = 200;
const GSI_MAX_SUPPORTED_WIDTH = 400;
const LOOPBACK_WEB_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Width to ask GSI for: the column width, clamped to the range GSI honours.
 * Returns null while the host has no layout yet (measuring 0 would pin the
 * button to the 200px floor and leave it narrower than the Facebook button).
 *
 * Floors rather than rounds: half a pixel more than the column has is already
 * an overflow, and the host used to answer an overflow with a horizontal
 * scrollbar. Feed it a fractional rect width, not the rounded `clientWidth`.
 */
export function resolveGsiRenderWidth(availableWidth: number): number | null {
    if (!Number.isFinite(availableWidth) || availableWidth <= 0) return null;
    return Math.max(
        GSI_MIN_SUPPORTED_WIDTH,
        Math.min(GSI_MAX_SUPPORTED_WIDTH, Math.floor(availableWidth)),
    );
}

/**
 * Width GSI actually drew inside the container, or null while it has not
 * painted yet.
 *
 * Takes the widest of `scrollWidth` and the direct children's boxes instead of
 * trusting `firstElementChild`: GSI's first child is its hidden credential
 * holder, which stays zero-width forever, so reading only that child reports
 * "nothing painted" for every real overflow and the compensation below never
 * fires. `scrollWidth` alone is not enough either — it rounds to an integer and
 * lands a pixel short of a fractional button width, which still clips.
 */
export function measureGsiRenderedWidth(container: {
    children: ArrayLike<Element>;
    scrollWidth: number;
}): number | null {
    if (container.children.length === 0) return null;
    let widest = container.scrollWidth;
    for (let i = 0; i < container.children.length; i += 1) {
        const width = container.children[i].getBoundingClientRect().width;
        if (Number.isFinite(width) && width > widest) widest = width;
    }
    const rendered = Math.ceil(widest);
    return rendered > 0 ? rendered : null;
}

/**
 * Container min-width once GSI has drawn. Compared against the width we
 * REQUESTED, never the live clientWidth: applying the min-width grows
 * clientWidth, so comparing against it would clear the value on the next
 * check and oscillate.
 */
export function resolveGsiOverflowWidth(
    renderedWidth: number,
    requestedWidth: number,
): number | null {
    // Wider than GSI can render at all is not the button: an absolutely
    // positioned helper node inflating scrollWidth. Widening the container to
    // that would push the button out of the card; overflowX:hidden already
    // keeps such a stray node invisible.
    if (renderedWidth > GSI_MAX_SUPPORTED_WIDTH) return null;
    return renderedWidth > requestedWidth ? renderedWidth : null;
}

export function getGoogleAvailability(hasClientId: boolean, hydrationReady: boolean) {
    if (!hasClientId) {
        return {
            enabled: false,
            fallbackText: i18nT('auth:components.auth.GoogleSignInButton.google_sign_in_ne_nastroen_e2df8d6f'),
        };
    }

    // Keep SSR and the first hydration render identical. Host-specific policy is
    // applied immediately after this component commits via useSyncExternalStore.
    if (!hydrationReady || typeof window === 'undefined') {
        return { enabled: true, fallbackText: '' };
    }

    const hostname = String(window.location.hostname || '').toLowerCase();
    const isLoopbackHost = LOOPBACK_WEB_HOSTS.has(hostname);
    if (!isLoopbackHost) {
        return { enabled: true, fallbackText: '' };
    }

    const localOverride = String(process.env.EXPO_PUBLIC_ENABLE_GOOGLE_SIGN_IN_LOCAL || '').trim().toLowerCase() === 'true';
    const hasInjectedGoogle = Boolean(window.google?.accounts?.id);
    if (localOverride || hasInjectedGoogle) {
        return { enabled: true, fallbackText: '' };
    }

    return {
        enabled: false,
        fallbackText: i18nT('auth:components.auth.GoogleSignInButton.google_sign_in_nedostupen_na_localhost_ispol_9023147b'),
    };
}

export default function GoogleSignInButton({ onSuccess, onError, disabled }: GoogleSignInButtonProps) {
    const colors = useThemedColors();
    const { isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
    // INV2-07: render the Google button at the column width so it carries the same
    // visual weight as the full-width Facebook button. If a locale's label cannot
    // fit that width, GSI renders wider than the host; the container's
    // `overflowY:hidden` then forces `overflowX:auto`, which clips the button's
    // rounded sides into two stray lines. `overflowWidth` catches that case and
    // widens the container to the rendered width so there is nothing to clip.
    const [renderWidth, setRenderWidth] = useState<number | null>(null);
    const [overflowWidth, setOverflowWidth] = useState<number | null>(null);
    // Keyed on width AND theme: a bare width guard would skip the repaint on a
    // theme flip, since this effect runs before any reset effect could clear it.
    const lastRenderedKeyRef = useRef<string | null>(null);
    const buttonContainerRef = useRef<HTMLDivElement | null>(null);
    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onSuccessRef.current = onSuccess;
        onErrorRef.current = onError;
    });

    const googleClientId = String(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
    const hasClientId = googleClientId.length > 0;
    const hydrationReady = useHydrationReady();
    const googleAvailability = useMemo(
        () => getGoogleAvailability(hasClientId, hydrationReady),
        [hasClientId, hydrationReady],
    );
    const shouldShowFallback = !googleAvailability.enabled;
    const isButtonDisabled = disabled || !isGoogleLoaded || shouldShowFallback || !hasClientId;

    const markGoogleLoaded = useCallback(() => {
        setIsGoogleLoaded(true);
    }, []);

    const handleGoogleScriptError = useCallback(() => {
        onErrorRef.current?.(i18nT('auth:components.auth.GoogleSignInButton.ne_udalos_zagruzit_google_sign_in_3373f8ec'));
    }, []);

    const hasGoogleSdk = typeof window !== 'undefined' && Boolean(window.google?.accounts?.id);

    useEffect(() => {
        if (!hasClientId) {
            onErrorRef.current?.(i18nT('auth:components.auth.GoogleSignInButton.google_sign_in_ne_nastroen_otsutstvuet_expo__4517e59c'));
            return;
        }
        if (googleAvailability.enabled && hasGoogleSdk) markGoogleLoaded();
    }, [googleAvailability.enabled, hasClientId, hasGoogleSdk, markGoogleLoaded]);

    useExternalScript({
        id: GOOGLE_GSI_SCRIPT_ID,
        src: GOOGLE_GSI_SCRIPT_SRC,
        onReady: markGoogleLoaded,
        onError: handleGoogleScriptError,
        enabled: hasClientId && googleAvailability.enabled && !hasGoogleSdk,
    });

    useEffect(() => {
        if (!googleAvailability.enabled) return;
        if (!isGoogleLoaded || !window.google) return;
        if (!hasClientId) return;

        try {
            window.google.accounts.id.initialize({
                client_id: googleClientId,
                itp_support: true,
                use_fedcm_for_prompt: true,
                callback: (response) => {
                    if (response.credential) {
                        onSuccessRef.current(response.credential);
                    } else {
                        onErrorRef.current?.(i18nT('auth:components.auth.GoogleSignInButton.ne_udalos_poluchit_dannye_ot_google_cf8f67c9'));
                    }
                },
            });
        } catch (error) {
            if (__DEV__) {
                console.error('Google Sign-In initialization error:', error);
            }
            onErrorRef.current?.(i18nT('auth:components.auth.GoogleSignInButton.oshibka_initsializatsii_google_sign_in_0e857099'));
        }
    }, [googleAvailability.enabled, googleClientId, hasClientId, isGoogleLoaded]);

    // Measure the available width (the host View, unaffected by the button's own
    // min-width) and re-render the GSI button when it changes.
    useEffect(() => {
        if (!googleAvailability.enabled || !isGoogleLoaded) return;
        const host = buttonContainerRef.current?.parentElement;
        if (!host) return;

        const measure = () => {
            // Rect width, not clientWidth: clientWidth rounds a fractional column
            // up, and asking GSI for that rounded width overflows the host.
            const next = resolveGsiRenderWidth(host.getBoundingClientRect().width);
            if (next != null) setRenderWidth(next);
        };
        measure();

        if (typeof ResizeObserver === 'undefined') return;
        // Debounce: every distinct integer width would otherwise re-render the
        // button, and re-rendering tears down and recreates GSI's cross-origin
        // iframe — a window drag would do that ~100 times. A timer rather than
        // requestAnimationFrame, because rAF does not fire in a hidden tab and the
        // button would keep a stale width until the tab is looked at again.
        let timer: ReturnType<typeof setTimeout> | null = null;
        const observer = new ResizeObserver(() => {
            if (timer != null) clearTimeout(timer);
            timer = setTimeout(() => {
                timer = null;
                measure();
            }, 50);
        });
        observer.observe(host);
        return () => {
            if (timer != null) clearTimeout(timer);
            observer.disconnect();
        };
    }, [googleAvailability.enabled, isGoogleLoaded]);

    useEffect(() => {
        if (!googleAvailability.enabled) return;
        if (!isGoogleLoaded || !window.google || !hasClientId) return;
        if (!buttonContainerRef.current || renderWidth == null) return;
        const renderKey = `${renderWidth}:${isDark ? 'dark' : 'light'}`;
        if (lastRenderedKeyRef.current === renderKey) return;

        try {
            buttonContainerRef.current.innerHTML = '';
            window.google.accounts.id.renderButton(buttonContainerRef.current, {
                type: 'standard',
                theme: getGoogleSignInButtonTheme(isDark),
                size: 'large',
                text: 'signin_with',
                // Pill matches the Facebook button's radii.lg (20px) at this height.
                shape: 'pill',
                logo_alignment: 'center',
                width: renderWidth,
            });
            lastRenderedKeyRef.current = renderKey;
        } catch (error) {
            if (__DEV__) {
                console.error('Google Sign-In button render error:', error);
            }
            onErrorRef.current?.(i18nT('auth:components.auth.GoogleSignInButton.oshibka_otobrazheniya_knopki_google_sign_in_9e8d05a4'));
        }
    }, [googleAvailability.enabled, hasClientId, isDark, isGoogleLoaded, renderWidth]);

    // GSI ignores a `width` narrower than its localized label needs, and paints
    // asynchronously into the container, so the overflow is not measurable on the
    // render tick. Watch for the actual paint and widen the container to whatever
    // the widget really drew. Compared against `renderWidth` (the width we asked
    // for), never the live clientWidth: applying the minWidth grows clientWidth, so
    // comparing against it would clear the value again on the next check.
    useEffect(() => {
        if (!googleAvailability.enabled || !isGoogleLoaded || renderWidth == null) return;
        const container = buttonContainerRef.current;
        if (!container) return;

        const check = () => {
            // Only a drawn, laid-out button is evidence. An empty container means
            // GSI has not painted yet (the render effect clears it before each
            // re-render); treating that as "fits" would drop an already-applied
            // compensation and flash the clipped button.
            const rendered = measureGsiRenderedWidth(container);
            if (rendered == null) return;
            setOverflowWidth(resolveGsiOverflowWidth(rendered, renderWidth));
        };
        check();

        // childList catches the injected button, ResizeObserver catches it settling
        // to its final width afterwards — together they cover an arbitrarily slow
        // paint, which fixed timers cannot.
        const observers: Array<{ disconnect: () => void }> = [];
        if (typeof MutationObserver !== 'undefined') {
            const mutation = new MutationObserver(check);
            mutation.observe(container, { childList: true, subtree: true });
            observers.push(mutation);
        }
        if (typeof ResizeObserver !== 'undefined') {
            const resize = new ResizeObserver(check);
            resize.observe(container);
            observers.push(resize);
        }
        return () => observers.forEach((observer) => observer.disconnect());
    }, [googleAvailability.enabled, isDark, isGoogleLoaded, renderWidth]);

    return (
        <View
            style={[
                styles.button,
                disabled && styles.buttonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={i18nT('auth:components.auth.GoogleSignInButton.voyti_cherez_google_43bd772c')}
            accessibilityState={{ disabled: isButtonDisabled }}
        >
            {shouldShowFallback ? (
                <View style={styles.fallbackContainer}>
                    <Text style={styles.fallbackText}>{googleAvailability.fallbackText}</Text>
                </View>
            ) : !isGoogleLoaded && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.text} />
                    <Text style={styles.loadingText}>{i18nT('auth:components.auth.GoogleSignInButton.zagruzka_google_sign_in_33b991c3')}</Text>
                </View>
            )}
            <div
                ref={buttonContainerRef}
                style={{
                    width: '100%',
                    // Only set when the label could not fit the column: keeps the box
                    // at least as wide as the button so the overflowY:hidden quirk has
                    // nothing to clip; the excess sits in the card padding, centered.
                    minWidth: overflowWidth ?? undefined,
                    // GSI may resize its host from 44px to 80px after the iframe
                    // settles; keep the social-auth stack geometry stable (#1299).
                    height: GOOGLE_GSI_BUTTON_HEIGHT,
                    maxHeight: GOOGLE_GSI_BUTTON_HEIGHT,
                    display: isGoogleLoaded && !shouldShowFallback ? 'flex' : 'none',
                    alignItems: 'center',
                    justifyContent: 'center',
                    // Both axes, and overflowX spelled out: `overflowY:'hidden'`
                    // alone computes overflowX to `auto`, so any horizontal
                    // overflow raises a real horizontal scrollbar inside the 48px
                    // host. It eats ~15px of the height and squeezes the button
                    // flat; a sign-in button is never meant to be scrolled.
                    overflowX: 'hidden',
                    overflowY: 'hidden',
                    pointerEvents: disabled ? 'none' : 'auto',
                    opacity: disabled ? 0.6 : 1,
                    // GSI-iframe светлый: при color-scheme:dark на html Chrome рисует
                    // под кросс-доменным iframe непрозрачный белый фон
                    colorScheme: 'light',
                }}
            />
        </View>
    );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    button: {
        backgroundColor: 'transparent',
        borderRadius: DESIGN_TOKENS.radii.lg,
        minHeight: GOOGLE_GSI_BUTTON_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    buttonDisabled: {
        opacity: 0.5,
        cursor: 'not-allowed' as any,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: GOOGLE_GSI_BUTTON_HEIGHT,
    },
    loadingText: {
        fontSize: 14,
        color: colors.text,
    },
    fallbackContainer: {
        width: '100%',
        minHeight: GOOGLE_GSI_BUTTON_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    },
    fallbackText: {
        fontSize: 13,
        color: colors.textMuted,
        textAlign: 'center',
    },
});
