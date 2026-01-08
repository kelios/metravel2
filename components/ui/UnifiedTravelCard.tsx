import React, { memo, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

export type UnifiedTravelCardBadge = {
  icon: keyof typeof Feather.glyphMap;
  backgroundColor: string;
  iconColor: string;
};

type Props = {
  title: string;
  imageUrl?: string | null;
  metaText?: string | null;
  onPress: () => void;
  mediaFit?: 'contain' | 'cover';
  heroTitleOverlay?: boolean;
  heroTitleMaxLines?: number;
  badge?: UnifiedTravelCardBadge;
  leftTopSlot?: ReactNode;
  rightTopSlot?: ReactNode;
  bottomLeftSlot?: ReactNode;
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
  onPress,
  mediaFit = 'contain',
  heroTitleOverlay = false,
  heroTitleMaxLines = 2,
  badge,
  leftTopSlot,
  rightTopSlot,
  bottomLeftSlot,
  containerOverlaySlot,
  contentSlot,
  mediaProps,
  width,
  imageHeight,
  contentContainerStyle,
  style,
  testID,
  webPressableProps,
}: Props) {
  const isWeb = Platform.OS === 'web';
  const colors = useThemedColors();

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
            } as any,
            default: DESIGN_TOKENS.shadowsNative.light,
          }),
        },
        imageContainer: {
          width: '100%',
          height: Platform.OS === 'web' ? 200 : 180,
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
          ...(Platform.OS === 'web'
            ? ({
                backgroundImage: `linear-gradient(to top, ${colors.overlay} 0%, rgba(0, 0, 0, 0) 100%)`,
              } as any)
            : ({ backgroundColor: colors.overlay } as any)),
        },
        imageTitleOverlayText: {
          fontSize: Platform.OS === 'web' ? 16 : 14,
          fontWeight: '800',
          lineHeight: Platform.OS === 'web' ? 20 : 18,
          color: colors.textOnDark,
          letterSpacing: -0.2,
          textAlign: 'center',
          ...(Platform.OS === 'web'
            ? { textShadow: '0px 1px 6px rgba(0,0,0,0.32)' }
            : {
                textShadowColor: 'rgba(0,0,0,0.32)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 6,
              }),
        },
        imageVignetteOverlay: {
          ...StyleSheet.absoluteFillObject,
          ...(Platform.OS === 'web'
            ? ({
                backgroundImage:
                  `radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 45%, ${colors.overlayLight} 100%)`,
                opacity: 1,
                borderRadius: 14,
              } as any)
            : ({} as any)),
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
          paddingVertical: 10,
          backgroundColor: colors.surface,
          gap: 8,
        },
        title: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.text,
          lineHeight: 18,
          letterSpacing: -0.2,
          minHeight: 36,
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
    [colors],
  );

  // On web we avoid rendering <button> because cards often contain interactive children
  // (e.g. favorite button). Nested <button> triggers validateDOMNesting warnings.
  const ContainerComponent: any = isWeb ? View : Pressable;
  const containerProps =
    isWeb
      ? (webPressableProps ?? {
          role: 'button',
          tabIndex: 0,
          onClick: (e: any) => {
            e?.preventDefault?.();
            onPress();
          },
          onKeyDown: (e: any) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onPress();
            }
          },
        })
      : { onPress };

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
        <View
          key="media"
          style={[styles.imageContainer, typeof imageHeight === 'number' ? { height: imageHeight } : null]}
        >
          {imageUrl ? (
            <ImageCardMedia
              src={imageUrl}
              alt={title}
              fit={mediaFit}
              blurBackground={mediaProps?.blurBackground ?? true}
              blurRadius={mediaProps?.blurRadius ?? 16}
              placeholderBlurhash={mediaProps?.placeholderBlurhash}
              style={StyleSheet.absoluteFill}
              loading={mediaProps?.loading ?? (Platform.OS === 'web' ? 'lazy' : 'lazy')}
              priority={mediaProps?.priority ?? (Platform.OS === 'web' ? 'low' : 'normal')}
              prefetch={mediaProps?.prefetch ?? false}
            />
          ) : (
            <View
              style={styles.imagePlaceholder}
              testID="image-stub"
              accessibilityElementsHidden={true}
              aria-hidden={true}
            />
          )}

          {heroTitleOverlay ? (
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
                Platform.OS === 'web' ? ({ pointerEvents: 'none' } as any) : ({ pointerEvents: 'box-none' } as any),
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
        </View>,
        contentSlot !== null ? (
          <View key="content" style={[styles.content, contentContainerStyle]}>
            {contentSlot}
          </View>
        ) : (
          <View key="content-default" style={styles.content}>
            {!heroTitleOverlay && (
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
            )}
            <View style={styles.metaRow}>
              <Feather name="map-pin" size={12} color={colors.textMuted} style={{ marginRight: 4 } as any} />
              <Text style={styles.metaText} numberOfLines={1}>
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
