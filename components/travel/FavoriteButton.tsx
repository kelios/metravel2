import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { translate as i18nT } from '@/i18n';
import { webTitleRef } from '@/utils/webProps';


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
    const { isFavorite, toggle, pending: isPending } = useFavoriteToggle();
    const isFav = isFavorite(id, type);

    const { width } = useWindowDimensions();
    const isMobileWeb = Platform.OS === 'web' && width < METRICS.breakpoints.tablet;
    const styles = useMemo(() => getStyles(colors, isMobileWeb), [colors, isMobileWeb]);

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

    // Оба варианта (overlay и plain) идут через useFavoriteToggle: отклик одинаковый.
    const handlePress = useCallback((e?: any) => {
        if (e) {
            if (e.stopPropagation) e.stopPropagation();
            if (e.preventDefault) e.preventDefault();
        }
        void toggle({
            id,
            type,
            title,
            url,
            imageUrl,
            country,
            city,
            source: FAVORITE_INTENT_SOURCE,
        });
    }, [toggle, id, type, title, url, imageUrl, country, city]);

    // Активное сердечко — залитая подложка danger с белой иконкой (не только цвет контура).
    const iconColor = isFav
        ? colors.textOnDark
        : isOverlay
            ? colors.textOnDark
            : (color || colors.textMuted);
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
                            isFav && styles.activeDisc,
                            { cursor: isPending ? 'wait' : 'pointer' } as any,
                            isPending && styles.overlayPending,
                        ]}
                        pointerEvents="none"
                    >
                        {icon}
                    </WebView>
                    <WebView
                        ref={webTitleRef(overlayLabel)}
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
                        dataSet={{ cardAction: 'true' }}
                    />
                </WebView>
            );
        }

        return (
            <Pressable
                onPress={handlePress}
                style={[styles.overlayButton, isFav && styles.activeDisc, style, isPending && styles.overlayPending]}
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
    const plainWebLabel = isFav
        ? i18nT('travel:components.travel.FavoriteButton.udalit_iz_hochu_poehat_b6ff82c1')
        : i18nT('travel:components.travel.FavoriteButton.dobavit_v_hochu_poehat_fbf5211c');

    return (
        <ButtonComponent
            ref={webTitleRef(plainWebLabel)}
            style={[styles.plainButton, isFav && styles.activeDisc, globalFocusStyles.focusable, style, isPending && { opacity: 0.6 }]}
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
                      'aria-label': plainWebLabel,
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

const getStyles = (colors: ThemedColors, isMobileWeb: boolean) => StyleSheet.create({
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
    activeDisc: {
        backgroundColor: colors.danger,
        borderColor: colors.danger,
    },
    overlayPending: {
        opacity: 0.65,
    },
});

export default React.memo(FavoriteButton);
