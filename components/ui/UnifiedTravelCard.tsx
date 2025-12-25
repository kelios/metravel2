import React, { memo } from 'react';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';

import { MaterialIcons } from '@expo/vector-icons';

import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { DESIGN_TOKENS } from '@/constants/designSystem';

export type UnifiedTravelCardBadge = {
  icon: keyof typeof MaterialIcons.glyphMap;
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
  style,
  testID,
  webAsView = false,
  webPressableProps,
}: Props) {
  const ContainerComponent: any = Platform.OS === 'web' && webAsView ? View : Pressable;
  const containerProps =
    Platform.OS === 'web' && webAsView
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
      accessibilityRole={Platform.OS === 'web' && webAsView ? undefined : 'button'}
      accessibilityLabel={title}
      testID={testID}
      {...Platform.select({ web: { cursor: 'pointer' } as any })}
    >
      <View style={[styles.imageContainer, typeof imageHeight === 'number' ? { height: imageHeight } : null]}>
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
          <View style={styles.imagePlaceholder} testID="image-stub">
            <MaterialIcons name="image" size={28} color="#9ca3af" />
          </View>
        )}

        {heroTitleOverlay ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            <View style={styles.imageVignetteOverlay} />
            <View style={styles.imageTitleOverlay}>
              <View style={styles.imageTitleOverlayBg} />
              <Text style={styles.imageTitleOverlayText} numberOfLines={heroTitleMaxLines}>
                {title}
              </Text>
            </View>
          </View>
        ) : null}

        {containerOverlaySlot ? <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>{containerOverlaySlot}</View> : null}
        {leftTopSlot ? <View style={styles.leftTopSlot}>{leftTopSlot}</View> : null}
        {rightTopSlot ? <View style={styles.rightTopSlot}>{rightTopSlot}</View> : null}
        {badge ? (
          <View style={[styles.badge, { backgroundColor: badge.backgroundColor }]}> 
            <MaterialIcons name={badge.icon as any} size={14} color={badge.iconColor} />
          </View>
        ) : null}
        {bottomLeftSlot ? <View style={styles.bottomLeftSlot}>{bottomLeftSlot}</View> : null}
      </View>

      {contentSlot ? (
        <View style={styles.content}>{contentSlot}</View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.metaRow}>
            <MaterialIcons name="place" size={12} color={DESIGN_TOKENS.colors.textMuted} style={{ marginRight: 4 }} />
            <Text style={styles.metaText} numberOfLines={1}>
              {metaText || ' '}
            </Text>
          </View>
        </View>
      )}
    </ContainerComponent>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.borderLight,
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.card,
        transition: 'all 0.2s ease',
      } as any,
      default: DESIGN_TOKENS.shadowsNative.light,
    }),
  },
  imageContainer: {
    width: '100%',
    height: Platform.OS === 'web' ? 200 : 180,
    position: 'relative',
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
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
          backgroundImage:
            'linear-gradient(to top, rgba(15, 23, 42, 0.82), rgba(15, 23, 42, 0.0))',
        } as any)
      : ({ backgroundColor: 'rgba(15, 23, 42, 0.55)' } as any)),
  },
  imageTitleOverlayText: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    fontWeight: '800',
    lineHeight: Platform.OS === 'web' ? 20 : 18,
    color: '#ffffff',
    letterSpacing: -0.2,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.32)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  imageVignetteOverlay: {
    ...StyleSheet.absoluteFillObject,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.0) 45%, rgba(15, 23, 42, 0.34) 100%)',
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
    borderColor: 'rgba(15, 23, 42, 0.12)',
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.text,
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
    color: DESIGN_TOKENS.colors.textMuted,
    flex: 1,
  },
});

export default memo(UnifiedTravelCard);
