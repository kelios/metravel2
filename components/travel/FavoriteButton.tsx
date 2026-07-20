import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Platform,
    Pressable,
    StyleSheet,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { METRICS } from '@/constants/layout';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useFavorites } from '@/context/FavoritesContext';
import { useAuth } from '@/context/AuthContext';
import { devLog } from '@/utils/logger';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import { showToast } from '@/utils/toast';
import { hapticImpact } from '@/utils/haptics';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { saveGuestFavoriteIntent } from '@/utils/guestFavoriteIntent';
import { trackFavoriteIntentGuest } from '@/utils/growthFunnelAnalytics';
import { translate as i18nT } from '@/i18n';


type FavoriteVariant = 'overlay' | 'plain';

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
    variant?: FavoriteVariant;
    style?: any;
};

const FAVORITE_INTENT_SOURCE = 'favorite_button';

function FavoriteButton({
    id,
    type,
    title,
    imageUrl,
    url,
    country,
    city,
    size,
    color,
    variant = 'plain',
    style,
}: FavoriteButtonProps) {
    const isOverlay = variant === 'overlay';
    const iconSize = size ?? (isOverlay ? 18 : 24);

    const colors = useThemedColors();
    const { isAuthenticated } = useAuth();
    const { requireAuth } = useRequireAuth({ intent: 'favorite' });
    const { isFavorite, addFavorite, removeFavorite } = useFavorites();
    const serverIsFav = isFavorite(id, type);

    // Единый оптимистичный паттерн: null → доверяем серверу; иначе показываем локальный выбор.
    const [optimisticFav, setOptimisticFav] = useState<boolean | null>(null);
    const [pendingSync, setPendingSync] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const inFlightRef = useRef(false);
    const isFav = optimisticFav ?? serverIsFav;

    const { width } = useWindowDimensions();
    const isMobileWeb = Platform.OS === 'web' && width < METRICS.breakpoints.tablet;
    const styles = useMemo(() => getStyles(colors, isMobileWeb), [colors, isMobileWeb]);

    // Сбрасываем оптимистичное состояние, когда сервер догнал (и запрос не в полёте).
    useEffect(() => {
        if (!inFlightRef.current) {
            setOptimisticFav(null);
        }
    }, [serverIsFav]);

    // Синхронизация избранного при восстановлении сети (web).
    useEffect(() => {
        if (Platform.OS !== 'web') return;

        const handleOnline = () => {
            if (pendingSync && isFav !== serverIsFav) {
                devLog('[FavoriteButton] Network restored, syncing favorite state');
                setOptimisticFav(null);
                setPendingSync(false);
            }
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [pendingSync, isFav, serverIsFav]);

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const prevIsFavRef = useRef(isFav);

    useEffect(() => {
        if (isFav && !prevIsFavRef.current) {
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.3, duration: 150, useNativeDriver: false }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
            ]).start();
        }
        prevIsFavRef.current = isFav;
    }, [isFav, pulseAnim]);

    const handlePress = useCallback(async (e?: any) => {
        if (e) {
            if (e.stopPropagation) e.stopPropagation();
            if (e.preventDefault) e.preventDefault();
        }

        const isAndroidGuest = Platform.OS === 'android' && !isAuthenticated;
        if (!isAuthenticated && !isAndroidGuest) {
            trackFavoriteIntentGuest({ itemType: type, itemId: id, source: FAVORITE_INTENT_SOURCE, url });
            void saveGuestFavoriteIntent({ id: String(id), type, title, url, imageUrl, source: FAVORITE_INTENT_SOURCE });
            requireAuth();
            return;
        }

        if (inFlightRef.current) return;
        inFlightRef.current = true;
        setIsPending(true);

        const next = !isFav;
        setOptimisticFav(next);
        hapticImpact(next ? 'medium' : 'light');

        try {
            if (next) {
                await addFavorite({ id, type, title, url, imageUrl, country, city });
                if (isOverlay) {
                    if (isAndroidGuest) {
                        showToast({
                            type: 'success',
                            text1: i18nT('travel:components.travel.OptimizedFavoriteButton.sohraneno_na_etom_ustroystve_2e6175c6'),
                            text2: i18nT('travel:components.travel.OptimizedFavoriteButton.voydite_chtoby_sinhronizirovat_hochu_poehat_cf4168e6'),
                            visibilityTime: 3500,
                        });
                    }
                } else {
                    await showToast({
                        type: 'success',
                        text1: isAndroidGuest
                            ? i18nT('travel:components.travel.FavoriteButton.sohraneno_na_etom_ustroystve_cdc5e362')
                            : i18nT('travel:components.travel.FavoriteButton.dobavleno_v_hochu_poehat_442a2566'),
                        text2: isAndroidGuest
                            ? i18nT('travel:components.travel.FavoriteButton.voydite_chtoby_sinhronizirovat_hochu_poehat_f0f4f24d')
                            : undefined,
                        position: 'bottom',
                        visibilityTime: isAndroidGuest ? 3500 : 2000,
                    });
                }
            } else {
                await removeFavorite(id, type);
                if (isOverlay) {
                    if (isAndroidGuest) {
                        showToast({
                            type: 'info',
                            text1: i18nT('travel:components.travel.OptimizedFavoriteButton.udaleno_s_etogo_ustroystva_12a50dda'),
                            visibilityTime: 2000,
                        });
                    }
                } else {
                    await showToast({
                        type: 'info',
                        text1: isAndroidGuest
                            ? i18nT('travel:components.travel.FavoriteButton.udaleno_s_etogo_ustroystva_42b53da4')
                            : i18nT('travel:components.travel.FavoriteButton.udaleno_iz_hochu_poehat_3ea076cb'),
                        position: 'bottom',
                        visibilityTime: 2000,
                    });
                }
            }
        } catch (error) {
            setOptimisticFav(serverIsFav);

            const isNetworkError = error instanceof Error
                && (error.message.includes('network') || error.message.includes('timeout'));
            if (isNetworkError) {
                setPendingSync(true);
            }

            if (isOverlay) {
                showToast({
                    type: 'error',
                    text1: i18nT('travel:components.travel.OptimizedFavoriteButton.ne_udalos_obnovit_hochu_poehat_ff7f74c7'),
                    visibilityTime: 3000,
                });
            } else {
                const errorMessage = error instanceof Error
                    ? (isNetworkError
                        ? i18nT('travel:components.travel.FavoriteButton.problema_s_podklyucheniem_izmeneniya_budut_s_12e5c7dc')
                        : error.message)
                    : i18nT('travel:components.travel.FavoriteButton.ne_udalos_obnovit_hochu_poehat_ae6de0b8');

                await showToast({
                    type: 'error',
                    text1: i18nT('travel:components.travel.FavoriteButton.oshibka_73fab30d'),
                    text2: errorMessage,
                    position: 'bottom',
                    visibilityTime: 4000,
                });
            }
        } finally {
            inFlightRef.current = false;
            setIsPending(false);
        }
    }, [isOverlay, isAuthenticated, requireAuth, isFav, id, type, title, imageUrl, url, country, city, addFavorite, removeFavorite, serverIsFav]);

    const iconColor = isOverlay
        ? (isFav ? colors.danger : colors.textOnDark)
        : (color || (isFav ? colors.danger : colors.textMuted));
    const unfavOpacity = isOverlay ? 0.85 : 0.55;

    const icon = (
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Feather
                name="heart"
                size={iconSize}
                color={iconColor}
                style={!isFav ? { opacity: unfavOpacity } : undefined}
            />
        </Animated.View>
    );

    const overlayLabel = isFav
        ? i18nT('travel:components.travel.OptimizedFavoriteButton.udalit_iz_hochu_poehat_2f50b03f')
        : i18nT('travel:components.travel.OptimizedFavoriteButton.dobavit_v_hochu_poehat_c9b63a42');

    // -------- OVERLAY variant --------
    if (isOverlay) {
        const isWeb = Platform.OS === 'web' || typeof document !== 'undefined';

        if (isWeb) {
            const WebView: any = View;
            return (
                <WebView style={[styles.overlayWrapper, style]}>
                    <WebView
                        style={[
                            styles.overlayButton,
                            { cursor: isPending ? 'wait' : 'pointer' } as any,
                            isPending && styles.overlayPending,
                        ]}
                        pointerEvents="none"
                    >
                        {icon}
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
                        aria-label={overlayLabel}
                        aria-pressed={isFav}
                        aria-busy={isPending}
                        style={[
                            styles.overlayHitArea,
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
                style={[styles.overlayButton, style, isPending && styles.overlayPending]}
                hitSlop={10}
                disabled={isPending}
                accessibilityRole="button"
                accessibilityLabel={overlayLabel}
                accessibilityState={{ selected: isFav, busy: isPending, disabled: isPending }}
                testID="favorite-button"
            >
                {icon}
            </Pressable>
        );
    }

    // -------- PLAIN variant --------
    const WebButton: any = View;
    const ButtonComponent = Platform.OS === 'web' ? WebButton : TouchableOpacity;

    return (
        <ButtonComponent
            style={[styles.plainButton, globalFocusStyles.focusable, style, isPending && { opacity: 0.6 }]}
            {...(Platform.OS === 'web'
                ? {
                      role: 'button',
                      tabIndex: 0,
                      'aria-busy': isPending,
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
                      'aria-label': isFav
                          ? i18nT('travel:components.travel.FavoriteButton.udalit_iz_hochu_poehat_b6ff82c1')
                          : i18nT('travel:components.travel.FavoriteButton.dobavit_v_hochu_poehat_fbf5211c'),
                      'aria-pressed': isFav,
                  }
                : {
                      onPress: handlePress as any,
                      hitSlop: { top: 10, bottom: 10, left: 10, right: 10 },
                      accessibilityRole: 'button',
                      accessibilityLabel: isFav
                          ? i18nT('travel:components.travel.FavoriteButton.udalit_value1_iz_hochu_poehat_70288eb2', { value1: title })
                          : i18nT('travel:components.travel.FavoriteButton.dobavit_value1_v_hochu_poehat_c698c838', { value1: title }),
                      accessibilityHint: isFav
                          ? i18nT('travel:components.travel.FavoriteButton.udalyaet_element_iz_hochu_poehat_0c985c36')
                          : i18nT('travel:components.travel.FavoriteButton.dobavlyaet_element_v_hochu_poehat_31cd24d0'),
                      accessibilityState: { selected: isFav },
                  })}
        >
            {icon}
        </ButtonComponent>
    );
}

const getStyles = (_colors: ThemedColors, isMobileWeb: boolean) => StyleSheet.create({
    plainButton: {
        padding: 8,
        minWidth: Platform.OS === 'android' ? 48 : 44, // AND-26: M3 48dp Android; WCAG 2.5.5 ≥44 elsewhere
        minHeight: Platform.OS === 'android' ? 48 : 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: DESIGN_TOKENS.radii.pill,
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transition: 'all 0.2s ease',
            },
        }),
    },
    overlayWrapper: {
        position: 'relative',
        alignSelf: 'flex-start',
    },
    overlayButton: {
        width: 44,
        height: 44,
        padding: 0,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        // Mobile web: static frost (opaque-ish bg) instead of a live backdrop-filter, which
        // re-rasterizes scrolling list content behind each card and tanks mobile GPU.
        backgroundColor: isMobileWeb ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        ...(Platform.OS === 'web' && !isMobileWeb
            ? { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } as any
            : {}),
    },
    overlayHitArea: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 44,
        height: 44,
        marginTop: -22,
        marginLeft: -22,
        borderRadius: 999,
    },
    overlayPending: {
        opacity: 0.65,
    },
});

export default React.memo(FavoriteButton);
