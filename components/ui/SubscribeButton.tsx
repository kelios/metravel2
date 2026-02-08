import React, { memo, useCallback, useMemo, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
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
}

function SubscribeButtonComponent({ targetUserId, size = 'sm', style }: SubscribeButtonProps) {
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

    const originalHandlePress = handlePress;
    const animatedHandlePress = useCallback(() => {
        Animated.sequence([
            Animated.timing(scaleAnim, { toValue: 0.95, duration: 75, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 1, duration: 75, useNativeDriver: true }),
        ]).start();
        originalHandlePress();
    }, [scaleAnim, originalHandlePress]);

    if (!canSubscribe && isAuthenticated) return null;

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
                accessibilityLabel={
                    isLoading
                        ? 'Загрузка состояния подписки'
                        : isSubscribed
                            ? 'Отписаться от пользователя'
                            : 'Подписаться на пользователя'
                }
                style={style}
            />
        </Animated.View>
    );
}

export default memo(SubscribeButtonComponent);
