import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, Platform, type StyleProp, type ViewStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import Button from '@/components/ui/Button';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/context/AuthContext';
import { useThemedColors } from '@/hooks/useTheme';
import { buildLoginHref } from '@/utils/authNavigation';
import { translate as i18nT } from '@/i18n'
import { applyWebTitle } from '@/utils/webProps'


interface SubscribeButtonProps {
    targetUserId: string | number | null | undefined;
    size?: 'sm' | 'md';
    style?: StyleProp<ViewStyle>;
    /** Вид под курсором мыши (web, #2036); на native и на касание `hovered` не приходит. */
    hoverStyle?: StyleProp<ViewStyle>;
    iconOnly?: boolean;
    deferStatus?: boolean;
}

function SubscribeButtonComponent({ targetUserId, size = 'sm', style, hoverStyle, iconOnly, deferStatus = false }: SubscribeButtonProps) {
    const { isAuthenticated, userId } = useAuth();
    const [disclosure, setDisclosure] = useState<{ viewer: typeof userId; target: typeof targetUserId }>();
    const statusRequested = !deferStatus || (disclosure?.viewer === userId && disclosure?.target === targetUserId);
    const router = useRouter();
    const colors = useThemedColors();
    const {
        isSubscribed,
        isLoading,
        isMutating,
        isStatusUnavailable,
        retryStatus,
        toggleSubscription,
        canSubscribe,
    } = useSubscription(targetUserId, statusRequested);

    const handlePress = useCallback(() => {
        if (!isAuthenticated) {
            const href = buildLoginHref();
            router.push(href as any);
            return;
        }
        if (!statusRequested) {
            setDisclosure({ viewer: userId, target: targetUserId });
            return;
        }
        if (isStatusUnavailable) {
            void retryStatus();
            return;
        }
        toggleSubscription();
    }, [isAuthenticated, isStatusUnavailable, retryStatus, router, statusRequested, targetUserId, toggleSubscription, userId]);

    const icon = useMemo(
        () =>
            isLoading ? null : (
                <Feather
                    name={isSubscribed ? 'user-check' : 'user-plus'}
                    size={size === 'sm' ? 14 : 16}
                    color={isSubscribed ? colors.primary : colors.textOnPrimary}
                />
            ),
        [isSubscribed, isLoading, size, colors.primary, colors.textOnPrimary]
    );

    const scaleAnim = useRef(new Animated.Value(1)).current;
    const btnRef = useRef<any>(null);
    const statusAction = isAuthenticated && !statusRequested ? i18nT('sharedStatic:subscription.statusAction') : null;
    const retryAction = isStatusUnavailable ? i18nT('sharedStatic:errors.retry') : null;
    const titleText = statusAction ?? retryAction ?? (isSubscribed ? i18nT('shared:components.ui.SubscribeButton.otpisatsya_0e2e1ea7') : i18nT('shared:components.ui.SubscribeButton.podpisatsya_e3acc977'));

    const originalHandlePress = handlePress;
    const animatedHandlePress = useCallback(() => {
        Animated.sequence([
            Animated.timing(scaleAnim, { toValue: 0.95, duration: 75, useNativeDriver: false }),
            Animated.timing(scaleAnim, { toValue: 1, duration: 75, useNativeDriver: false }),
        ]).start();
        originalHandlePress();
    }, [scaleAnim, originalHandlePress]);

    useEffect(() => {
        if (Platform.OS === 'web') applyWebTitle(btnRef.current, titleText);
    }, [titleText]);

    if (!canSubscribe && isAuthenticated) return null;

    const a11yLabel = statusAction ?? retryAction ?? (isLoading
        ? i18nT('shared:components.ui.SubscribeButton.zagruzka_sostoyaniya_podpiski_7423c0ef')
        : isSubscribed
            ? i18nT('shared:components.ui.SubscribeButton.otpisatsya_ot_polzovatelya_577975ed')
            : i18nT('shared:components.ui.SubscribeButton.podpisatsya_na_polzovatelya_f873c74c'));

    if (iconOnly) {
        return (
            <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
                <Pressable
                    ref={btnRef}
                    onPress={animatedHandlePress}
                    disabled={isLoading || isMutating}
                    accessibilityRole="button"
                    accessibilityLabel={a11yLabel}
                    style={({ hovered }) => [style, hovered && hoverStyle]}
                    {...(Platform.OS === 'web'
                        ? {
                              role: 'button',
                              'aria-label': a11yLabel,
                          } as any
                        : {})}
                >
                    <Feather
                        name={statusAction ? 'users' : retryAction ? 'refresh-cw' : isLoading ? 'clock' : isSubscribed ? 'user-check' : 'user-plus'}
                        size={18}
                        color={isSubscribed ? colors.primary : colors.text}
                    />
                </Pressable>
            </Animated.View>
        );
    }

    const label = statusAction ?? retryAction ?? (isLoading
        ? '...'
        : isSubscribed
            ? i18nT('shared:components.ui.SubscribeButton.vy_podpisany_aa09a5d6')
            : i18nT('shared:components.ui.SubscribeButton.podpisatsya_e3acc977'));

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Button
                label={label}
                onPress={animatedHandlePress}
                variant={isSubscribed ? 'outline' : 'primary'}
                size={size}
                icon={icon}
                loading={isLoading || isMutating}
                disabled={isLoading || isMutating}
                accessibilityLabel={a11yLabel}
                style={style}
                hoverStyle={hoverStyle}
            />
        </Animated.View>
    );
}

export default memo(SubscribeButtonComponent);
