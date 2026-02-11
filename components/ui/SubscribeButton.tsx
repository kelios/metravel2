import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, Platform, type StyleProp, type ViewStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import Button from '@/components/ui/Button';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/context/AuthContext';
import { useThemedColors } from '@/hooks/useTheme';
import { buildLoginHref } from '@/utils/authNavigation';

interface SubscribeButtonProps {
    targetUserId: string | number | null | undefined;
    size?: 'sm' | 'md';
    style?: StyleProp<ViewStyle>;
    iconOnly?: boolean;
}

function SubscribeButtonComponent({ targetUserId, size = 'sm', style, iconOnly }: SubscribeButtonProps) {
    const { isAuthenticated } = useAuth();
    const router = useRouter();
    const colors = useThemedColors();
    const {
        isSubscribed,
        isLoading,
        isMutating,
        toggleSubscription,
        canSubscribe,
    } = useSubscription(targetUserId);

    const handlePress = useCallback(() => {
        if (!isAuthenticated) {
            const href = buildLoginHref();
            router.push(href as any);
            return;
        }
        toggleSubscription();
    }, [isAuthenticated, toggleSubscription, router]);

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
    const titleText = isSubscribed ? 'Отписаться' : 'Подписаться';

    const originalHandlePress = handlePress;
    const animatedHandlePress = useCallback(() => {
        Animated.sequence([
            Animated.timing(scaleAnim, { toValue: 0.95, duration: 75, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 1, duration: 75, useNativeDriver: true }),
        ]).start();
        originalHandlePress();
    }, [scaleAnim, originalHandlePress]);

    useEffect(() => {
        if (Platform.OS === 'web' && btnRef.current) {
            const node = btnRef.current;
            if (node?.setAttribute) node.setAttribute('title', titleText);
        }
    }, [titleText]);

    if (!canSubscribe && isAuthenticated) return null;

    const a11yLabel = isLoading
        ? 'Загрузка состояния подписки'
        : isSubscribed
            ? 'Отписаться от пользователя'
            : 'Подписаться на пользователя';

    if (iconOnly) {
        return (
            <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
                <Pressable
                    ref={btnRef}
                    onPress={animatedHandlePress}
                    disabled={isLoading}
                    accessibilityRole="button"
                    accessibilityLabel={a11yLabel}
                    style={style}
                    {...(Platform.OS === 'web'
                        ? {
                              role: 'button',
                              'aria-label': a11yLabel,
                              'data-action-btn': true,
                          } as any
                        : {})}
                >
                    <Feather
                        name={isSubscribed ? 'user-check' : 'user-plus'}
                        size={18}
                        color={isSubscribed ? colors.primary : colors.text}
                    />
                </Pressable>
            </Animated.View>
        );
    }

    const label = isLoading
        ? '...'
        : isSubscribed
            ? 'Вы подписаны'
            : 'Подписаться';

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Button
                label={label}
                onPress={animatedHandlePress}
                variant={isSubscribed ? 'outline' : 'primary'}
                size={size}
                icon={icon}
                loading={isLoading || isMutating}
                disabled={isLoading}
                accessibilityLabel={a11yLabel}
                style={style}
            />
        </Animated.View>
    );
}

export default memo(SubscribeButtonComponent);
