import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { METRICS } from '@/constants/layout';
import Feather from '@expo/vector-icons/Feather';
import { useFavorites } from '@/context/FavoritesContext';
import { useAuth } from '@/context/AuthContext';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { showToast } from '@/utils/toast';
import { saveGuestFavoriteIntent } from '@/utils/guestFavoriteIntent';
import { trackFavoriteIntentGuest } from '@/utils/growthFunnelAnalytics';

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
    const [optimisticFav, setOptimisticFav] = useState<boolean | null>(null);
    const [isPending, setIsPending] = useState(false);
    const inFlightRef = useRef(false);
    const isFav = optimisticFav ?? serverIsFav;
    const colors = useThemedColors();
    const { width } = useWindowDimensions();
    const isMobileWeb = Platform.OS === 'web' && width < METRICS.breakpoints.tablet;
    const styles = useMemo(() => getStyles(colors, isMobileWeb), [colors, isMobileWeb]);

    useEffect(() => {
        if (!inFlightRef.current) {
            setOptimisticFav(null);
        }
    }, [serverIsFav]);

    const WebView: any = View;

    const handlePress = async (e?: any) => {
        // Предотвращаем всплытие и стандартное поведение на веб-платформе
        if (e) {
            e.stopPropagation();
            if (e.preventDefault) {
                e.preventDefault();
            }
        }

        const isAndroidGuest = Platform.OS === 'android' && !isAuthenticated;
        if (!isAuthenticated && !isAndroidGuest) {
            trackFavoriteIntentGuest({ itemType: type, itemId: id, source: 'optimized_favorite_button', url });
            void saveGuestFavoriteIntent({ id: String(id), type, title, url, imageUrl, source: 'optimized_favorite_button' });
            requireAuth();
            return;
        }

        if (inFlightRef.current) return;
        inFlightRef.current = true;
        setIsPending(true);
        const next = !isFav;
        setOptimisticFav(next);

        try {
            if (next) {
                await addFavorite({
                    id,
                    type,
                    title,
                    url,
                    imageUrl,
                    country,
                    city,
                });
                if (isAndroidGuest) {
                    showToast({
                        type: 'success',
                        text1: 'Сохранено на этом устройстве',
                        text2: 'Войдите, чтобы синхронизировать избранное.',
                        visibilityTime: 3500,
                    });
                }
            } else {
                await removeFavorite(id, type);
                if (isAndroidGuest) {
                    showToast({
                        type: 'info',
                        text1: 'Удалено с этого устройства',
                        visibilityTime: 2000,
                    });
                }
            }
        } catch {
            setOptimisticFav(serverIsFav);
            showToast({
                type: 'error',
                text1: 'Не удалось обновить избранное',
                visibilityTime: 3000,
            });
        } finally {
            inFlightRef.current = false;
            setIsPending(false);
        }
    };

    const isWeb = Platform.OS === 'web' || typeof document !== 'undefined';

    // On web, avoid rendering a <button> to prevent nested button warnings inside other Pressables.
    if (isWeb) {
        return (
            <WebView style={[styles.favoriteButtonWrapper, style]}>
                <WebView
                    style={[
                        styles.favoriteButton,
                        { cursor: isPending ? 'wait' : 'pointer' } as any,
                        isPending && styles.favoriteButtonPending,
                    ]}
                    pointerEvents="none"
                >
                    <Feather
                        name="heart"
                        size={size}
                        color={isFav ? colors.danger : colors.textOnDark}
                        {...(!isFav ? ({ style: { opacity: 0.85 } } as any) : null)}
                    />
                </WebView>
                <WebView
                    role="button"
                    accessibilityRole="button"
                    tabIndex={0}
                    onClick={handlePress as any}
                    onKeyDown={(e: any) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault?.();
                            handlePress(e);
                        }
                    }}
                    aria-label={isFav ? 'Удалить из избранного' : 'Добавить в избранное'}
                    aria-pressed={isFav}
                    aria-busy={isPending}
                    style={[
                        styles.favoriteButtonHitArea,
                        { cursor: isPending ? 'wait' : 'pointer' } as any,
                    ]}
                    data-card-action="true"
                    data-testid="favorite-button"
                />
            </WebView>
        );
    }

    return (
        <Pressable
            onPress={handlePress}
            style={[styles.favoriteButton, style, isPending && styles.favoriteButtonPending]}
            hitSlop={10}
            disabled={isPending}
            accessibilityRole="button"
            accessibilityLabel={isFav ? 'Удалить из избранного' : 'Добавить в избранное'}
            accessibilityState={{ selected: isFav, busy: isPending, disabled: isPending }}
            testID="favorite-button"
        >
            <Feather
                name="heart"
                size={size}
                color={isFav ? colors.danger : colors.textOnDark}
                {...(!isFav ? ({ style: { opacity: 0.85 } } as any) : null)}
            />
        </Pressable>
    );
});

const getStyles = (_colors: ThemedColors, isMobileWeb: boolean) => StyleSheet.create({
    favoriteButtonWrapper: {
        position: 'relative',
        alignSelf: 'flex-start',
    },
    favoriteButton: {
        padding: 8,
        borderRadius: 999,
        // Mobile web: static frost (opaque-ish bg) instead of a live backdrop-filter, which
        // re-rasterizes scrolling list content behind each card and tanks mobile GPU.
        backgroundColor: isMobileWeb ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        ...(Platform.OS === 'web' && !isMobileWeb
            ? { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } as any
            : {}),
    },
    favoriteButtonHitArea: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 44,
        height: 44,
        marginTop: -22,
        marginLeft: -22,
        borderRadius: 999,
    },
    favoriteButtonPending: {
        opacity: 0.65,
    },
});

export default OptimizedFavoriteButton;
