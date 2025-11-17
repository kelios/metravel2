import React, { useCallback, useState } from 'react';
import { TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useFavorites } from '@/context/FavoritesContext';

type FavoriteButtonProps = {
    id: string | number;
    type: 'travel' | 'article';
    title: string;
    imageUrl?: string;
    url: string;
    country?: string;
    city?: string;
    size?: number;
    color?: string;
    style?: any;
};

export default function FavoriteButton({
    id,
    type,
    title,
    imageUrl,
    url,
    country,
    city,
    size = 24,
    color,
    style,
}: FavoriteButtonProps) {
    const { isFavorite, addFavorite, removeFavorite } = useFavorites();
    const serverIsFav = isFavorite(id, type);
    // Оптимистичное состояние для мгновенного отклика
    const [optimisticIsFav, setOptimisticIsFav] = useState(serverIsFav);
    
    // Синхронизируем с серверным состоянием
    React.useEffect(() => {
        setOptimisticIsFav(serverIsFav);
    }, [serverIsFav]);

    const isFav = optimisticIsFav;

    const handlePress = useCallback(async () => {
        // Оптимистичное обновление UI
        const newState = !isFav;
        setOptimisticIsFav(newState);

        try {
            if (newState) {
                await addFavorite({
                    id,
                    type,
                    title,
                    imageUrl,
                    url,
                    country,
                    city,
                });
                Toast.show({
                    type: 'success',
                    text1: 'Добавлено в избранное',
                    position: 'bottom',
                    visibilityTime: 2000,
                });
            } else {
                await removeFavorite(id, type);
                Toast.show({
                    type: 'info',
                    text1: 'Удалено из избранного',
                    position: 'bottom',
                    visibilityTime: 2000,
                });
            }
        } catch (error) {
            // Откатываем оптимистичное обновление при ошибке
            setOptimisticIsFav(!newState);
            Toast.show({
                type: 'error',
                text1: 'Ошибка',
                text2: 'Не удалось обновить избранное',
                position: 'bottom',
                visibilityTime: 3000,
            });
        }
    }, [isFav, id, type, title, imageUrl, url, country, city, addFavorite, removeFavorite]);

    return (
        <TouchableOpacity
            style={[styles.button, style]}
            onPress={handlePress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={isFav ? `Удалить "${title}" из избранного` : `Добавить "${title}" в избранное`}
            accessibilityHint={isFav ? 'Удаляет элемент из списка избранного' : 'Добавляет элемент в список избранного'}
            // @ts-ignore - для веб доступности
            aria-label={Platform.OS === 'web' ? (isFav ? 'Удалить из избранного' : 'Добавить в избранное') : undefined}
            // @ts-ignore
            aria-pressed={Platform.OS === 'web' ? isFav : undefined}
        >
            <MaterialIcons
                name={isFav ? 'favorite' : 'favorite-border'}
                size={size}
                color={color || (isFav ? '#ef4444' : '#6b7280')}
            />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        padding: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

