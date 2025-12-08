// Оптимизированный FavoriteButton для списков
import React, { memo } from 'react';
import { Pressable, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFavorites } from '@/context/FavoritesContext';

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
    const { isFavorite, addFavorite, removeFavorite } = useFavorites();
    const serverIsFav = isFavorite(id, type);

    const handlePress = async (e?: any) => {
        // Предотвращаем всплытие и стандартное поведение на веб-платформе
        if (e) {
            e.stopPropagation();
            if (e.preventDefault) {
                e.preventDefault();
            }
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
                city 
            });
        }
    };

    return (
        <Pressable
            onPress={handlePress}
            style={[styles.favoriteButton, style]}
            hitSlop={10}
            {...(Platform.OS === 'web' && {
                onClick: (e: any) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handlePress(e);
                },
                onMouseDown: (e: any) => e.stopPropagation(),
            })}
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
