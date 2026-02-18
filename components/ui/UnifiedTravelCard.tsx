import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { optimizeImageUrl } from '@/utils/imageOptimization';

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
};

function UnifiedTravelCard({
  title,
  imageUrl,
  metaText,
  rating: _rating,
  ratingCount: _ratingCount,
  onPress,
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
}: Props) {
  const isWeb =
    Platform.OS === 'web' ||
    typeof window !== 'undefined' ||
    typeof document !== 'undefined' ||
    webAsView;
  const colors = useThemedColors();
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
        imageContainer: {
          width: '100%',
          height: isWeb ? 200 : 180,
          position: 'relative',
          backgroundColor: colors.backgroundSecondary,
        },
        imagePlaceholder: {
          ...StyleSheet.absoluteFillObject,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.backgroundSecondary,
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
  const containerProps =
    isWeb
      ? (webPressableProps ?? {
          tabIndex: 0,
          role: 'link',
          'aria-label': title,
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
        })
      : { onPress };

  const showHeroTitle = heroTitleOverlay && typeof title === 'string' && title.trim().length > 0;

  return (
    <ContainerComponent
      {...containerProps}
      style={[styles.container, typeof width === 'number' ? { width } : null, style]}
      accessibilityRole={isWeb ? undefined : 'button'}
      accessibilityLabel={title}
      testID={testID}
      {...Platform.select({ web: { cursor: 'pointer' } as any })}
    >
      {[
        <View key="media" style={[styles.imageContainer, typeof imageHeight === 'number' ? { height: imageHeight } : null, imageHeight === 0 && { display: 'none' }]}>
          {optimizedImageUrl ? (
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
            />
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
                  'aria-label': title,
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
                onPress={onMediaPress}
                style={StyleSheet.absoluteFill}
                {...({ 'data-card-action': 'true' } as any)}
              />
            )
          ) : null}

          {showHeroTitle ? (
            <View style={StyleSheet.absoluteFillObject}>
              <View style={styles.imageVignetteOverlay} />
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
            {!heroTitleOverlay && (
              <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                {title}
              </Text>
            )}
            <View style={styles.metaRow}>
              <Feather name="map-pin" size={12} color={colors.textMuted} style={MAP_PIN_ICON_STYLE as any} />
              <Text style={styles.metaText} numberOfLines={1} ellipsizeMode="tail">
                {metaText || ' '}
              </Text>
            </View>
          </View>
        ),
      ]}
    </ContainerComponent>
  );
}

export default memo(UnifiedTravelCard);
