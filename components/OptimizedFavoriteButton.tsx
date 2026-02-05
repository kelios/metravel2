// Оптимизированный FavoriteButton для списков
import React, { memo, useMemo } from 'react';
import { StyleSheet, Platform, Pressable, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useFavorites } from '@/context/FavoritesContext';
import { useAuth } from '@/context/AuthContext';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { useRequireAuth } from '@/hooks/useRequireAuth';

type OptimizedFavoriteButtonProps = {
    id: string | number;
    type: 'travel' | 'article';
    title: string;
    url: string;
    imageUrl?: string;
    country?: string;
    city?: string;
    size?: number;
    style?: any;
};

const OptimizedFavoriteButton = memo(function OptimizedFavoriteButton({
    id,
    type,
    title,
    url,
    imageUrl,
    country,
    city,
    size = 18,
    style,
}: OptimizedFavoriteButtonProps) {
    const { isAuthenticated } = useAuth();
    const { requireAuth } = useRequireAuth({ intent: 'favorite' });
    const { isFavorite, addFavorite, removeFavorite } = useFavorites();
    const serverIsFav = isFavorite(id, type);
    const colors = useThemedColors();
    const styles = useMemo(() => getStyles(colors), [colors]);

    const WebView: any = View;

    const handlePress = async (e?: any) => {
        // Предотвращаем всплытие и стандартное поведение на веб-платформе
        if (e) {
            e.stopPropagation();
            if (e.preventDefault) {
                e.preventDefault();
            }
        }
        
        if (!isAuthenticated) {
            requireAuth();
            return;
        }

        if (serverIsFav) {
            await removeFavorite(id, type);
        } else {
            await addFavorite({
                id,
                type,
                title,
                url,
                imageUrl,
                country,
                city,
            });
        }
    };

    const isWeb = Platform.OS === 'web' || typeof document !== 'undefined';

    // On web, avoid rendering a <button> to prevent nested button warnings inside other Pressables.
    if (isWeb) {
        return (
            <WebView
                tabIndex={0}
                onClick={handlePress as any}
                onKeyDown={(e: any) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault?.();
                        handlePress(e);
                    }
                }}
                aria-label={serverIsFav ? 'Удалить из избранного' : 'Добавить в избранное'}
                style={[styles.favoriteButton, style, { cursor: 'pointer' } as any]}
                data-testid="favorite-button"
            >
                <Feather
                    name="heart"
                    size={size}
                    color={serverIsFav ? colors.danger : colors.textMuted}
                    {...(!serverIsFav ? ({ style: { opacity: 0.55 } } as any) : null)}
                />
            </WebView>
        );
    }

    return (
        <Pressable
            onPress={handlePress}
            style={[styles.favoriteButton, style]}
            hitSlop={10}
            testID="favorite-button"
        >
            <Feather
                name="heart"
                size={size}
                color={serverIsFav ? colors.danger : colors.textMuted}
                {...(!serverIsFav ? ({ style: { opacity: 0.55 } } as any) : null)}
            />
        </Pressable>
    );
});

const getStyles = (colors: ThemedColors) => StyleSheet.create({
    favoriteButton: {
        padding: 4,
        borderRadius: 4,
        backgroundColor: colors.surface,
    },
});

export default OptimizedFavoriteButton;
