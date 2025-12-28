// Оптимизированный FavoriteButton для списков
import React, { memo } from 'react';
import { StyleSheet, Platform, Pressable, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFavorites } from '@/context/FavoritesContext';
import { useAuth } from '@/context/AuthContext';

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
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const { isFavorite, addFavorite, removeFavorite } = useFavorites();
    const serverIsFav = isFavorite(id, type);

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
            router.push('/login' as any);
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

    // On web, avoid rendering a <button> to prevent nested button warnings inside other Pressables.
    if (Platform.OS === 'web') {
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
                <MaterialIcons
                    name={serverIsFav ? 'favorite' : 'favorite-border'}
                    size={size}
                    color={serverIsFav ? '#ef4444' : '#6b7280'}
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
            <MaterialIcons
                name={serverIsFav ? 'favorite' : 'favorite-border'}
                size={size}
                color={serverIsFav ? '#ef4444' : '#6b7280'}
            />
        </Pressable>
    );
});

const styles = StyleSheet.create({
    favoriteButton: {
        padding: 4,
        borderRadius: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
    },
});

export default OptimizedFavoriteButton;
