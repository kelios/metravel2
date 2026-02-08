import React, { memo, useCallback, useMemo } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
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
        () => (
            <Feather
                name={isSubscribed ? 'user-check' : 'user-plus'}
                size={size === 'sm' ? 14 : 16}
                color={isSubscribed ? colors.primary : colors.textOnPrimary}
            />
        ),
        [isSubscribed, size, colors.primary, colors.textOnPrimary]
    );

    if (!canSubscribe && isAuthenticated) return null;

    return (
        <Button
            label={isSubscribed ? 'Вы подписаны' : 'Подписаться'}
            onPress={handlePress}
            variant={isSubscribed ? 'outline' : 'primary'}
            size={size}
            icon={icon}
            loading={isLoading || isMutating}
            accessibilityLabel={
                isSubscribed ? 'Отписаться от пользователя' : 'Подписаться на пользователя'
            }
            style={style}
        />
    );
}

export default memo(SubscribeButtonComponent);
