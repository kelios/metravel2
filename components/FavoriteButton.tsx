import React, { useCallback, useState, useEffect, useRef } from 'react';
import { TouchableOpacity, StyleSheet, Platform, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useFavorites } from '@/context/FavoritesContext';
import { useAuth } from '@/context/AuthContext';
import { devLog } from '@/src/utils/logger';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus'; // ИСПРАВЛЕНИЕ: Импорт focus-стилей
import { showToast } from '@/src/utils/toast';

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
    const colors = useThemedColors();
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const { isFavorite, addFavorite, removeFavorite } = useFavorites();
    const serverIsFav = isFavorite(id, type);
    // Оптимистичное состояние для мгновенного отклика
    const [optimisticIsFav, setOptimisticIsFav] = useState(serverIsFav);
    const [pendingSync, setPendingSync] = useState(false);
    const inFlightRef = useRef(false);
    
    // Синхронизируем с серверным состоянием
    useEffect(() => {
        setOptimisticIsFav(serverIsFav);
    }, [serverIsFav]);

    // ✅ BUG-003: Синхронизация при восстановлении сети
    useEffect(() => {
        if (Platform.OS !== 'web') return;

        const handleOnline = () => {
            if (pendingSync && optimisticIsFav !== serverIsFav) {
                devLog('[FavoriteButton] Network restored, syncing favorite state');
                // Синхронизируем состояние при восстановлении сети
                setOptimisticIsFav(serverIsFav);
                setPendingSync(false);
            }
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [pendingSync, optimisticIsFav, serverIsFav]);

    const isFav = optimisticIsFav;

    const handlePress = useCallback(async (e?: any) => {
        if (e) {
            if (e.stopPropagation) e.stopPropagation();
            if (e.preventDefault) e.preventDefault();
        }

        if (!isAuthenticated) {
            router.push('/login' as any);
            return;
        }

        if (inFlightRef.current) {
            return;
        }

        inFlightRef.current = true;

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
                await showToast({
                    type: 'success',
                    text1: 'Добавлено в избранное',
                    position: 'bottom',
                    visibilityTime: 2000,
                });
            } else {
                await removeFavorite(id, type);
                await showToast({
                    type: 'info',
                    text1: 'Удалено из избранного',
                    position: 'bottom',
                    visibilityTime: 2000,
                });
            }
        } catch (error) {
            // Откатываем оптимистичное обновление при ошибке
            setOptimisticIsFav(!newState);
            
            // ✅ BUG-003: Помечаем как требующее синхронизации при ошибке сети
            if (error instanceof Error && (error.message.includes('network') || error.message.includes('timeout'))) {
                setPendingSync(true);
            }
            
            // ✅ UX-001: Улучшенное сообщение об ошибке
            const errorMessage = error instanceof Error 
                ? (error.message.includes('network') || error.message.includes('timeout')
                    ? 'Проблема с подключением. Изменения будут синхронизированы при восстановлении сети.'
                    : error.message)
                : 'Не удалось обновить избранное';
            
            await showToast({
                type: 'error',
                text1: 'Ошибка',
                text2: errorMessage,
                position: 'bottom',
                visibilityTime: 4000,
            });
        } finally {
            inFlightRef.current = false;
        }
    }, [isAuthenticated, router, isFav, id, type, title, imageUrl, url, country, city, addFavorite, removeFavorite]);

    // On web, avoid rendering a DOM <button> to prevent nested button warnings inside clickable cards.
    // (react-native-web renders Pressable as <button> by default)
    const WebButton: any = View;
    const ButtonComponent = Platform.OS === 'web' ? WebButton : TouchableOpacity;

    return (
        <ButtonComponent
            style={[styles.button, globalFocusStyles.focusable, style]} // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
            {...(Platform.OS === 'web'
                ? {
                      role: 'button',
                      tabIndex: 0,
                      onClick: handlePress as any,
                      onKeyDown: (e: any) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault?.();
                              handlePress(e);
                          }
                      },
                      onMouseDown: (e: any) => {
                          if (e?.stopPropagation) e.stopPropagation();
                      },
                      'aria-label': isFav ? 'Удалить из избранного' : 'Добавить в избранное',
                      'aria-pressed': isFav,
                  }
                : {
                      onPress: handlePress as any,
                      hitSlop: { top: 10, bottom: 10, left: 10, right: 10 },
                      accessibilityRole: 'button',
                      accessibilityLabel: isFav
                          ? `Удалить "${title}" из избранного`
                          : `Добавить "${title}" в избранное`,
                      accessibilityHint: isFav
                          ? 'Удаляет элемент из списка избранного'
                          : 'Добавляет элемент в список избранного',
                      accessibilityState: { selected: isFav },
                  })}
        >
            <MaterialIcons
                name={isFav ? 'favorite' : 'favorite-border'}
                size={size}
                color={color || (isFav ? colors.danger : colors.textMuted)}
            />
        </ButtonComponent>
    );
}

const styles = StyleSheet.create({
    button: {
        padding: 8, // ✅ ИСПРАВЛЕНИЕ: Увеличен padding для лучшей touch-цели
        minWidth: 40, // ✅ ИСПРАВЛЕНИЕ: Минимальная ширина для touch-целей
        minHeight: 40, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: DESIGN_TOKENS.radii.sm, // ✅ ИСПРАВЛЕНИЕ: Добавлен радиус
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                // @ts-ignore - hover будет применен через inline стили
            },
        }),
    },
});
