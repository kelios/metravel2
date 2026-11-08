import React, { useEffect, useMemo, useRef } from 'react';
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
import { webTitleRef } from '@/utils/webProps';

/**
 * Единственный внешний вид ♥ (кружок на фото и плоская кнопка). Что именно
 * сохраняет сердечко, решает вызывающий: `FavoriteButton` — статью в «Хочу
 * поехать», `PlaceSaveHeartButton` — точку в «Мои точки». Поэтому подложка,
 * пульс, хит-зона 44 pt и web-разметка у них не расходятся.
 */
export type HeartToggleVariant = 'overlay' | 'plain';

export type HeartToggleButtonProps = {
    active: boolean;
    onPress: (e?: any) => void;
    /** Подпись кружка на фото (aria-label/title на web, accessibilityLabel на native). */
    overlayLabel: string;
    /** Подпись плоской кнопки на web. */
    plainLabel?: string;
    /** Подпись и подсказка плоской кнопки на native. */
    plainAccessibilityLabel?: string;
    plainAccessibilityHint?: string;
    pending?: boolean;
    disabled?: boolean;
    size?: number;
    color?: string;
    variant?: HeartToggleVariant;
    style?: any;
    testID?: string;
};

function HeartToggleButton({
    active,
    onPress,
    overlayLabel,
    plainLabel = overlayLabel,
    plainAccessibilityLabel = plainLabel,
    plainAccessibilityHint,
    pending = false,
    disabled = false,
    size,
    color,
    variant = 'plain',
    style,
    testID = 'favorite-button',
}: HeartToggleButtonProps) {
    const isOverlay = variant === 'overlay';
    const iconSize = size ?? (isOverlay ? 18 : 24);
    const inactive = pending || disabled;

    const colors = useThemedColors();
    const { width } = useWindowDimensions();
    const isMobileWeb = Platform.OS === 'web' && width < METRICS.breakpoints.tablet;
    const styles = useMemo(() => getStyles(colors, isMobileWeb), [colors, isMobileWeb]);

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const prevActiveRef = useRef(active);

    useEffect(() => {
        if (active && !prevActiveRef.current) {
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.3, duration: 150, useNativeDriver: false }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
            ]).start();
        }
        prevActiveRef.current = active;
    }, [active, pulseAnim]);

    const handlePress = (e?: any) => {
        if (e) {
            if (e.stopPropagation) e.stopPropagation();
            if (e.preventDefault) e.preventDefault();
        }
        if (inactive) return;
        onPress(e);
    };

    // Активное сердечко — залитая подложка danger с белой иконкой (не только цвет контура).
    const iconColor = active
        ? colors.textOnDark
        : isOverlay
            ? colors.textOnDark
            : (color || colors.textMuted);
    const inactiveOpacity = isOverlay ? 0.85 : 0.55;

    const icon = (
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Feather
                name="heart"
                size={iconSize}
                color={iconColor}
                style={!active ? { opacity: inactiveOpacity } : undefined}
            />
        </Animated.View>
    );

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
                            active && styles.activeDisc,
                            { cursor: pending ? 'wait' : disabled ? 'default' : 'pointer' } as any,
                            inactive && styles.overlayPending,
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
                        aria-pressed={active}
                        aria-busy={pending}
                        aria-disabled={disabled || undefined}
                        style={[
                            styles.overlayHitArea,
                            { cursor: pending ? 'wait' : disabled ? 'default' : 'pointer' } as any,
                        ]}
                        dataSet={{ cardAction: 'true' }}
                        testID={testID}
                    />
                </WebView>
            );
        }

        return (
            <Pressable
                onPress={handlePress}
                style={[styles.overlayButton, active && styles.activeDisc, style, inactive && styles.overlayPending]}
                hitSlop={10}
                disabled={inactive}
                accessibilityRole="button"
                accessibilityLabel={overlayLabel}
                accessibilityState={{ selected: active, busy: pending, disabled: inactive }}
                testID={testID}
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
            ref={webTitleRef(plainLabel)}
            style={[styles.plainButton, active && styles.activeDisc, globalFocusStyles.focusable, style, inactive && { opacity: 0.6 }]}
            {...(Platform.OS === 'web'
                ? {
                      role: 'button',
                      tabIndex: 0,
                      'aria-busy': pending,
                      'aria-disabled': disabled || undefined,
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
                      'aria-label': plainLabel,
                      'aria-pressed': active,
                  }
                : {
                      onPress: handlePress as any,
                      hitSlop: { top: 10, bottom: 10, left: 10, right: 10 },
                      accessibilityRole: 'button',
                      accessibilityLabel: plainAccessibilityLabel,
                      accessibilityHint: plainAccessibilityHint,
                      accessibilityState: { selected: active, disabled: inactive },
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

export default React.memo(HeartToggleButton);
