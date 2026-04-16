import { memo, useMemo, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import ImageCardMedia from '@/components/ui/ImageCardMedia';
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
  contentPosition?: 'belowMedia' | 'aboveMedia';
  mediaProps?: {
    placeholderBlurhash?: string;
    blurRadius?: number;
    blurBackground?: boolean;
    allowCriticalWebBlur?: boolean;
    revealOnLoadOnly?: boolean;
    recyclingKey?: string;
    priority?: 'low' | 'normal' | 'high';
    loading?: 'lazy' | 'eager';
    prefetch?: boolean;
    showImmediately?: boolean;
  };
  width?: number;
  imageHeight?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  insetMedia?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  webAsView?: boolean;
  webPressableProps?: any;
  visualVariant?: 'default' | 'featured';
  webHoverScale?: boolean;
  webTouchAction?: string;
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
  contentPosition = 'belowMedia',
  mediaProps,
  width,
  imageHeight,
  contentContainerStyle,
  insetMedia = false,
  style,
  testID,
  webPressableProps,
  webAsView = false,
  visualVariant = 'default',
  webHoverScale = true,
  webTouchAction,
}: Props) {
  const isWeb =
    Platform.OS === 'web' ||
    typeof window !== 'undefined' ||
    typeof document !== 'undefined' ||
    webAsView;
  const colors = useThemedColors();
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isFeatured = visualVariant === 'featured';
  const enableWebHoverEffects = isWeb && webHoverScale;
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
        : isFeatured
          ? 480
          : 320;

    return (
      optimizeImageUrl(imageUrl, {
        width: targetWidth,
        height: targetHeight,
        quality: isFeatured ? 60 : 44,
        format: 'auto',
        fit: mediaFit === 'contain' ? 'contain' : 'cover',
      }) ?? imageUrl
    );
  }, [imageUrl, imageHeight, isFeatured, isWeb, mediaFit, width]);
  const [imageFailed, setImageFailed] = useState(false);
  const handleImageLoad = useCallback(() => {
    setImageFailed(false);
  }, []);
  const handleImageError = useCallback(() => {
    setImageFailed(true);
  }, []);

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
              transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              touchAction: webTouchAction ?? 'pan-y',
              contain: 'layout style',
            } as any,
            default: DESIGN_TOKENS.shadowsNative.light,
          }),
        },
        containerHovered: {
          ...Platform.select({
            web: {
              // ANIM-02: optional scale + translateY hover effect for dense grids
              ...(webHoverScale ? { transform: 'translateY(-6px) scale(1.02)' } : { transform: 'translateY(-3px)' }),
              borderColor: colors.primary,
              boxShadow: '0 12px 32px rgba(59, 130, 246, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(59, 130, 246, 0.1)',
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
              contain: 'layout style',
            } as any,
          }),
        },
        containerFeaturedHovered: {
          ...Platform.select({
            web: {
              ...(webHoverScale ? { transform: 'translateY(-4px) scale(1.01)' } : null),
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
        imageContainerInset: {
          overflow: 'hidden',
          borderRadius: DESIGN_TOKENS.radii.lg,
          marginHorizontal: DESIGN_TOKENS.spacing.sm,
          marginBottom: DESIGN_TOKENS.spacing.sm,
        },
        imagePlaceholder: {
          ...StyleSheet.absoluteFillObject,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.backgroundSecondary,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderLight,
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
        contentAboveMedia: {
          paddingBottom: 6,
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
          fontSize: 13,
          fontWeight: '600',
          color: colors.textSecondary,
          flex: 1,
        },
      }),
    [colors, isWeb, webHoverScale, webTouchAction],
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
        if (enableWebHoverEffects) {
          setIsHovered(true);
        }
        originalMouseEnter?.(e);
      },
      onMouseLeave: (e: any) => {
        if (enableWebHoverEffects) {
          setIsHovered(false);
        }
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
  }, [defaultWebProps, enableWebHoverEffects, isWeb, onPress, onLongPress, handleLongPress, webPressableProps]);

  const showHeroTitle = heroTitleOverlay && title.trim().length > 0;
  const normalizedMetaText = typeof metaText === 'string' ? metaText.trim() : '';
  const displayMetaText = normalizedMetaText || 'Локация уточняется';

  // AND-16: Wrap in Animated.View for native spring, plain View for web
  const CardWrapper = isWeb ? View : Animated.View;
  const wrapperStyle = isWeb ? (typeof width === 'number' ? { width } : undefined) : [animatedCardStyle, typeof width === 'number' ? { width } : undefined];
  const mediaNode = (
    <View
      key="media"
      style={[
        styles.imageContainer,
        typeof imageHeight === 'number' ? { height: imageHeight } : null,
        imageHeight === 0 && { display: 'none' },
        insetMedia ? styles.imageContainerInset : null,
      ]}
      accessible={false}
      importantForAccessibility="no"
    >
      {optimizedImageUrl && !imageFailed ? (
        <>
          <ImageCardMedia
            src={optimizedImageUrl}
            alt={title}
            width={typeof width === 'number' ? width : undefined}
            height={typeof imageHeight === 'number' ? imageHeight : undefined}
            fit={mediaFit}
            blurBackground={mediaProps?.blurBackground ?? true}
            allowCriticalWebBlur={mediaProps?.allowCriticalWebBlur ?? false}
            revealOnLoadOnly={mediaProps?.revealOnLoadOnly ?? false}
            blurRadius={mediaProps?.blurRadius ?? 16}
            placeholderBlurhash={mediaProps?.placeholderBlurhash}
            recyclingKey={mediaProps?.recyclingKey}
            style={[StyleSheet.absoluteFill, isWeb && onMediaPress ? ({ pointerEvents: 'none' } as any) : null]}
            loading={mediaProps?.loading ?? (isWeb ? 'lazy' : 'lazy')}
            priority={mediaProps?.priority ?? (isWeb ? 'low' : 'normal')}
            prefetch={mediaProps?.prefetch ?? false}
            showImmediately={mediaProps?.showImmediately ?? false}
            onLoad={handleImageLoad}
            onError={handleImageError}
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

      {onMediaPress && !showHeroTitle ? (
        <View style={[styles.mediaActionHint, { pointerEvents: 'none' }]}>
          <Feather name="maximize-2" size={14} color={colors.textOnDark} />
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
    </View>
  );
  const contentNode = contentSlot != null ? (
    <View
      key="content"
      style={[
        styles.content,
        contentPosition === 'aboveMedia' ? styles.contentAboveMedia : null,
        contentContainerStyle,
      ]}
    >
      {contentSlot}
    </View>
  ) : (
    <View key="content-default" style={styles.content}>
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
  );
  const orderedContent = contentPosition === 'aboveMedia'
    ? [contentNode, mediaNode]
    : [mediaNode, contentNode];

  return (
    <CardWrapper style={wrapperStyle as any}>
    <ContainerComponent
      {...containerProps}
      // AND-16: Press handlers for spring animation on native
      {...(!isWeb ? { onPressIn: handlePressIn, onPressOut: handlePressOut } : {})}
      style={[
        styles.container,
        enableWebHoverEffects && !isFeatured && isHovered && styles.containerHovered,
        isFeatured && styles.containerFeatured,
        isFeatured && enableWebHoverEffects && isHovered && styles.containerFeaturedHovered,
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
      {orderedContent}
    </ContainerComponent>
    </CardWrapper>
  );
}

export default memo(UnifiedTravelCard);
