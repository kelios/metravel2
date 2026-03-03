import { memo, useMemo, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { ShimmerOverlay } from '@/components/ui/ShimmerOverlay';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { optimizeImageUrl } from '@/utils/imageOptimization';
import { hapticImpact } from '@/utils/haptics';
// AND-16: Native spring animation on press
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const MAP_PIN_ICON_STYLE = { marginRight: 4 } as const;

export type UnifiedTravelCardBadge = {
  icon: keyof typeof Feather.glyphMap;
  backgroundColor: string;
  iconColor: string;
};

type Props = {
  title: string;
  imageUrl?: string | null;
  metaText?: string | null;
  rating?: number | null;
  ratingCount?: number;
  onPress: () => void;
  /** AND-13: Long press callback — used for share on native */
  onLongPress?: () => void;
  onMediaPress?: () => void;
  mediaFit?: 'contain' | 'cover';
  heroTitleOverlay?: boolean;
  heroTitleMaxLines?: number;
  badge?: UnifiedTravelCardBadge;
  leftTopSlot?: ReactNode;
  rightTopSlot?: ReactNode;
  bottomLeftSlot?: ReactNode;
  bottomRightSlot?: ReactNode;
  containerOverlaySlot?: ReactNode;
  contentSlot?: ReactNode;
  mediaProps?: {
    placeholderBlurhash?: string;
    blurRadius?: number;
    blurBackground?: boolean;
    priority?: 'low' | 'normal' | 'high';
    loading?: 'lazy' | 'eager';
    prefetch?: boolean;
  };
  width?: number;
  imageHeight?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  webAsView?: boolean;
  webPressableProps?: any;
  visualVariant?: 'default' | 'featured';
};

function UnifiedTravelCard({
  title,
  imageUrl,
  metaText,
  rating: _rating,
  ratingCount: _ratingCount,
  onPress,
  onLongPress,
  onMediaPress,
  mediaFit = 'contain',
  heroTitleOverlay = false,
  heroTitleMaxLines = 2,
  badge,
  leftTopSlot,
  rightTopSlot,
  bottomLeftSlot,
  bottomRightSlot,
  containerOverlaySlot,
  contentSlot,
  mediaProps,
  width,
  imageHeight,
  contentContainerStyle,
  style,
  testID,
  webPressableProps,
  webAsView = false,
  visualVariant = 'default',
}: Props) {
  const isWeb =
    Platform.OS === 'web' ||
    typeof window !== 'undefined' ||
    typeof document !== 'undefined' ||
    webAsView;
  const colors = useThemedColors();
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  // CARD-04: Отслеживаем загрузку изображения для показа shimmer
  const [imageLoaded, setImageLoaded] = useState(false);
  const handleImageLoad = useCallback(() => setImageLoaded(true), []);
  const isFeatured = visualVariant === 'featured';
  const { isPhone, isLargePhone } = useResponsive();
  const isMobileDevice = isPhone || isLargePhone;
  const cardActionLabel = `Открыть маршрут «${title}»`;
  const mediaActionLabel = `Открыть фото маршрута «${title}»`;

  // AND-13: Long press handler with haptic feedback for share action
  const handleLongPress = useCallback(() => {
    if (onLongPress) {
      hapticImpact('medium');
      onLongPress();
    }
  }, [onLongPress]);

  // AND-16: Native spring animation on press (scale down → up)
  const pressScale = useSharedValue(1);
  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  const handlePressIn = useCallback(() => {
    if (!isWeb) {
      pressScale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
    }
  }, [isWeb, pressScale]);
  const handlePressOut = useCallback(() => {
    if (!isWeb) {
      pressScale.value = withSpring(1, { damping: 12, stiffness: 200 });
    }
  }, [isWeb, pressScale]);
  const optimizedImageUrl = useMemo(() => {
    if (!imageUrl || !isWeb) return imageUrl ?? null;

    const targetHeight = typeof imageHeight === 'number' ? imageHeight : 200;
    const targetWidth =
      typeof width === 'number'
        ? width
        : typeof window !== 'undefined'
          ? Math.min(window.innerWidth || 360, 640)
          : undefined;

    return (
      optimizeImageUrl(imageUrl, {
        width: targetWidth,
        height: targetHeight,
        fit: mediaFit === 'contain' ? 'contain' : 'cover',
      }) ?? imageUrl
    );
  }, [imageUrl, imageHeight, isWeb, mediaFit, width]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          backgroundColor: colors.surface,
          borderRadius: 14,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.borderLight,
          ...Platform.select({
            web: {
              boxShadow: (colors.boxShadows as any)?.medium ?? DESIGN_TOKENS.shadows.card,
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              touchAction: 'pan-y',
            } as any,
            default: DESIGN_TOKENS.shadowsNative.light,
          }),
        },
        containerHovered: {
          ...Platform.select({
            web: {
              // ANIM-02: scale + translateY для плавного hover-эффекта
              transform: 'translateY(-2px) scale(1.015)',
              borderColor: colors.primaryAlpha30,
              boxShadow: DESIGN_TOKENS.shadows.medium,
            } as any,
          }),
        },
        containerFocused: {
          ...Platform.select({
            web: {
              borderColor: colors.primary,
              boxShadow: `${DESIGN_TOKENS.shadows.light}, 0 0 0 3px ${colors.primaryAlpha30}`,
            } as any,
          }),
        },
        containerFeatured: {
          borderWidth: 1,
          borderColor: colors.primaryAlpha30,
          ...Platform.select({
            web: {
              boxShadow: DESIGN_TOKENS.shadows.medium,
              transition: 'transform 0.3s ease, box-shadow 0.3s ease, border-color 0.2s ease',
              backgroundImage: `linear-gradient(180deg, ${colors.surface} 0%, ${colors.backgroundSecondary} 100%)`,
              backgroundRepeat: 'no-repeat',
            } as any,
          }),
        },
        containerFeaturedHovered: {
          ...Platform.select({
            web: {
              transform: 'translateY(-4px) scale(1.01)',
              borderColor: colors.primaryAlpha40,
              boxShadow: `${DESIGN_TOKENS.shadows.heavy}, 0 12px 28px ${colors.primaryAlpha30}`,
            } as any,
          }),
        },
        imageContainer: {
          width: '100%',
          // CARD-01: Используем единый токен высоты изображения вместо hardcoded
          height: isWeb ? DESIGN_TOKENS.cardImageHeights.medium : DESIGN_TOKENS.cardImageHeights.medium - 20,
          position: 'relative',
          backgroundColor: colors.backgroundSecondary,
        },
        imagePlaceholder: {
          ...StyleSheet.absoluteFillObject,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.backgroundSecondary,
        },
        // CARD-03: Иконка-подсказка «фото кликабельно»
        mediaActionHint: {
          position: 'absolute',
          bottom: 8,
          right: 8,
          width: 28,
          height: 28,
          borderRadius: 8,
          backgroundColor: 'rgba(0,0,0,0.35)',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3,
        },
        imageTitleOverlay: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 12,
          paddingTop: 16,
          paddingBottom: 10,
          alignItems: 'center',
        },
        imageTitleOverlayBg: {
          ...StyleSheet.absoluteFillObject,
          ...(isWeb
            ? ({
                backgroundImage: `linear-gradient(to top, ${colors.overlay} 0%, rgba(0, 0, 0, 0) 100%)`,
              } as any)
            : ({ backgroundColor: colors.overlay } as any)),
        },
        imageTitleOverlayText: {
          fontSize: isWeb ? 16 : 14,
          fontWeight: '800',
          lineHeight: isWeb ? 20 : 18,
          color: colors.textOnDark,
          letterSpacing: -0.2,
          textAlign: 'center',
          ...(isWeb
            ? { textShadow: '0px 1px 6px rgba(0,0,0,0.32)' }
            : {
                textShadowColor: 'rgba(0,0,0,0.32)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 6,
              }),
        },
        imageVignetteOverlay: {},
        imageVignetteOverlayFeatured: {
          ...StyleSheet.absoluteFillObject,
          ...Platform.select({
            web: ({
              backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 42%, ${colors.overlay} 100%)`,
              pointerEvents: 'none',
            } as any),
          }),
        },
        rightTopSlot: {
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 10,
        },
        leftTopSlot: {
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 10,
        },
        bottomLeftSlot: {
          position: 'absolute',
          left: 10,
          bottom: 10,
          zIndex: 10,
        },
        bottomRightSlot: {
          position: 'absolute',
          right: 10,
          bottom: 10,
          zIndex: 10,
        },
        badge: {
          position: 'absolute',
          top: 10,
          right: 10,
          width: 24,
          height: 24,
          borderRadius: 999,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.borderLight,
        },
        content: {
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: colors.surface,
          gap: 0,
          ...(isWeb ? { flex: 0 } : {}),
        },
        title: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.text,
          lineHeight: 18,
          letterSpacing: -0.2,
        },
        metaRow: {
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 18,
        },
        metaText: {
          fontSize: 12,
          fontWeight: '600',
          color: colors.textMuted,
          flex: 1,
        },
      }),
    [colors, isWeb],
  );

  // On web we avoid rendering <button> because cards often contain interactive children
  // (e.g. favorite button). Nested <button> triggers validateDOMNesting warnings.
  const ContainerComponent: any = isWeb || webPressableProps ? View : Pressable;
  const defaultWebProps = useMemo(
    () => ({
      tabIndex: 0,
      role: 'link',
      'aria-label': cardActionLabel,
      onClick: (e: any) => {
        const target = e?.target as any;
        if (target?.closest?.('[data-card-action="true"]')) {
          return;
        }
        e?.preventDefault?.();
        onPress();
      },
      onKeyDown: (e: any) => {
        if (e.key === 'Enter' || e.key === ' ') {
          const target = e?.target as any;
          if (target?.closest?.('[data-card-action="true"]')) {
            return;
          }
          e.preventDefault();
          onPress();
        }
      },
    }),
    [cardActionLabel, onPress],
  );

  const containerProps = useMemo(() => {
    if (!isWeb) return { onPress, ...(onLongPress ? { onLongPress: handleLongPress } : {}) };

    const base = webPressableProps ?? defaultWebProps;
    const originalMouseEnter = base?.onMouseEnter;
    const originalMouseLeave = base?.onMouseLeave;
    const originalFocus = base?.onFocus;
    const originalBlur = base?.onBlur;

    return {
      ...base,
      onMouseEnter: (e: any) => {
        setIsHovered(true);
        originalMouseEnter?.(e);
      },
      onMouseLeave: (e: any) => {
        setIsHovered(false);
        originalMouseLeave?.(e);
      },
      onFocus: (e: any) => {
        setIsFocused(true);
        originalFocus?.(e);
      },
      onBlur: (e: any) => {
        setIsFocused(false);
        originalBlur?.(e);
      },
    };
  }, [defaultWebProps, isWeb, onPress, onLongPress, handleLongPress, webPressableProps]);

  const showHeroTitle = heroTitleOverlay && typeof title === 'string' && title.trim().length > 0;
  const normalizedMetaText = typeof metaText === 'string' ? metaText.trim() : '';
  const displayMetaText = normalizedMetaText || 'Локация уточняется';

  // AND-16: Wrap in Animated.View for native spring, plain View for web
  const CardWrapper = isWeb ? View : Animated.View;
  const wrapperStyle = isWeb ? (typeof width === 'number' ? { width } : undefined) : [animatedCardStyle, typeof width === 'number' ? { width } : undefined];

  return (
    <CardWrapper style={wrapperStyle as any}>
    <ContainerComponent
      {...containerProps}
      // AND-16: Press handlers for spring animation on native
      {...(!isWeb ? { onPressIn: handlePressIn, onPressOut: handlePressOut } : {})}
      style={[
        styles.container,
        isWeb && !isFeatured && isHovered && styles.containerHovered,
        isFeatured && styles.containerFeatured,
        isFeatured && isHovered && styles.containerFeaturedHovered,
        isWeb && isFocused && styles.containerFocused,
        typeof width === 'number' ? { width } : null,
        style,
      ]}
      accessibilityRole={isWeb ? undefined : 'button'}
      accessibilityLabel={cardActionLabel}
      testID={testID}
      // AND-27: Material Design ripple effect on Android
      {...(!isWeb ? { android_ripple: { color: 'rgba(0,0,0,0.08)', borderless: false } } : {})}
      {...Platform.select({ web: { cursor: 'pointer' } as any })}
    >
      {[
        <View key="media" style={[styles.imageContainer, typeof imageHeight === 'number' ? { height: imageHeight } : null, imageHeight === 0 && { display: 'none' }]}>
          {optimizedImageUrl ? (
            <>
              {/* CARD-04: Shimmer placeholder пока изображение грузится */}
              {!imageLoaded && (
                <ShimmerOverlay
                  style={StyleSheet.absoluteFill}
                />
              )}
              <ImageCardMedia
                src={optimizedImageUrl}
                alt={title}
                fit={mediaFit}
                blurBackground={mediaProps?.blurBackground ?? true}
                blurRadius={mediaProps?.blurRadius ?? 16}
                placeholderBlurhash={mediaProps?.placeholderBlurhash}
                style={[StyleSheet.absoluteFill, isWeb && onMediaPress ? ({ pointerEvents: 'none' } as any) : null]}
                loading={mediaProps?.loading ?? (isWeb ? 'lazy' : 'lazy')}
                priority={mediaProps?.priority ?? (isWeb ? 'low' : 'normal')}
                prefetch={mediaProps?.prefetch ?? false}
                onLoad={handleImageLoad}
              />
            </>
          ) : (
            <View
              testID="image-stub"
              style={[
                styles.imagePlaceholder,
                isWeb && onMediaPress ? ({ pointerEvents: 'none' } as any) : null,
              ]}
              {...(process.env.NODE_ENV === 'test'
                ? {}
                : ({ accessibilityElementsHidden: true, 'aria-hidden': true } as any))}
            />
          )}

          {onMediaPress ? (
            isWeb ? (
              <View
                style={StyleSheet.absoluteFill}
                {...({
                  tabIndex: 0,
                  'aria-label': mediaActionLabel,
                  onClick: (e: any) => {
                    e?.preventDefault?.();
                    e?.stopPropagation?.();
                    onMediaPress();
                  },
                  onKeyDown: (e: any) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e?.stopPropagation?.();
                      onMediaPress();
                    }
                  },
                  'data-card-action': 'true',
                  style: { cursor: 'pointer', position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
                } as any)}
              />
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={mediaActionLabel}
                onPress={onMediaPress}
                style={StyleSheet.absoluteFill}
                {...({ 'data-card-action': 'true' } as any)}
              />
            )
          ) : null}

          {/* CARD-03: Визуальный индикатор, что фото кликабельно отдельно от карточки */}
          {onMediaPress && !showHeroTitle ? (
            <View style={styles.mediaActionHint} pointerEvents="none">
              <Feather name="maximize-2" size={14} color="#fff" />
            </View>
          ) : null}

          {showHeroTitle ? (
            <View style={StyleSheet.absoluteFillObject}>
              <View style={styles.imageVignetteOverlay} />
              {isFeatured ? <View style={styles.imageVignetteOverlayFeatured} /> : null}
              <View style={styles.imageTitleOverlay}>
                <View style={styles.imageTitleOverlayBg} />
                <Text style={styles.imageTitleOverlayText} numberOfLines={heroTitleMaxLines}>
                  {title}
                </Text>
              </View>
            </View>
          ) : null}

          {containerOverlaySlot ? (
            <View
              style={[
                StyleSheet.absoluteFillObject,
                isWeb ? ({ pointerEvents: 'none' } as any) : ({ pointerEvents: 'box-none' } as any),
              ]}
            >
              {containerOverlaySlot}
            </View>
          ) : null}
          {leftTopSlot ? <View style={styles.leftTopSlot}>{leftTopSlot}</View> : null}
          {rightTopSlot ? <View style={styles.rightTopSlot}>{rightTopSlot}</View> : null}
          {badge ? (
            <View style={[styles.badge, { backgroundColor: badge.backgroundColor }]}>
              <Feather name={badge.icon as any} size={14} color={badge.iconColor} />
            </View>
          ) : null}
          {bottomLeftSlot ? <View style={styles.bottomLeftSlot}>{bottomLeftSlot}</View> : null}
          {bottomRightSlot ? <View style={styles.bottomRightSlot}>{bottomRightSlot}</View> : null}
        </View>,
        contentSlot !== null ? (
          <View key="content" style={[styles.content, contentContainerStyle]}>
            {contentSlot}
          </View>
        ) : (
          <View key="content-default" style={styles.content}>
            {/* RESP-06: На desktop 2 строки заголовка, на mobile 1 */}
            {!heroTitleOverlay && (
              <Text style={styles.title} numberOfLines={isMobileDevice ? 1 : 2} ellipsizeMode="tail">
                {title}
              </Text>
            )}
            <View style={styles.metaRow}>
              <Feather name="map-pin" size={12} color={colors.textMuted} style={MAP_PIN_ICON_STYLE as any} />
              <Text style={styles.metaText} numberOfLines={1} ellipsizeMode="tail">
                {displayMetaText}
              </Text>
            </View>
          </View>
        ),
      ]}
    </ContainerComponent>
    </CardWrapper>
  );
}

export default memo(UnifiedTravelCard);
