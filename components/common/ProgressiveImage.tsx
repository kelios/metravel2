/**
 * Progressive Image Component
 * Shows low-quality placeholder first, then smoothly transitions to full quality
 * Optimizes perceived performance and reduces layout shift
 */

import React, { useMemo } from 'react'
import { Image, View, StyleSheet, Platform, ImageStyle, ViewStyle } from 'react-native'
import { useThemedColors } from '@/hooks/useTheme'
import { useProgressiveImage, generateLQIP } from '@/hooks/useProgressiveImage'

export interface ProgressiveImageProps {
  /** Image source URL */
  source: string
  /** Alternative text for accessibility */
  alt?: string
  /** Image width */
  width?: number | string
  /** Image height */
  height?: number | string
  /** Aspect ratio (width/height) */
  aspectRatio?: number
  /** Custom styles */
  style?: ImageStyle | ViewStyle
  /** Container styles */
  containerStyle?: ViewStyle
  /** Enable blur-up effect (default: true) */
  enableBlur?: boolean
  /** Custom placeholder source */
  placeholder?: string
  /** Priority loading (preload immediately) */
  priority?: boolean
  /** Loading delay in ms (default: 0) */
  loadDelay?: number
  /** Callback when image loads */
  onLoad?: () => void
  /** Callback on error */
  onError?: (error: Error) => void
  /** Resize mode */
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center'
  /** Test ID for testing */
  testID?: string
  /** Updated at timestamp for cache busting */
  updatedAt?: string
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  source,
  alt,
  width,
  height,
  aspectRatio,
  style,
  containerStyle,
  enableBlur = true,
  placeholder,
  priority = false,
  loadDelay = priority ? 0 : 50,
  onLoad,
  onError,
  resizeMode = 'cover',
  testID,
  updatedAt,
}) => {
  const colors = useThemedColors()
  // Generate LQIP if not provided
  const lqip = useMemo(() => {
    if (placeholder) return placeholder
    return generateLQIP(source, { width: 40, quality: 20 })
  }, [source, placeholder])

  const { currentSrc, isLoaded, shouldBlur, blurRadius, opacity } = useProgressiveImage({
    placeholderSrc: lqip !== source ? lqip : undefined,
    src: source,
    onLoad,
    onError,
    loadDelay,
    enableBlur,
  })

  // Build container style
  const computedContainerStyle = useMemo(() => {
    const base: ViewStyle = {
      overflow: 'hidden',
      backgroundColor: colors.mutedBackground,
    }

    if (width !== undefined) base.width = typeof width === 'number' ? width : width
    if (height !== undefined) base.height = typeof height === 'number' ? height : height
    if (aspectRatio) base.aspectRatio = aspectRatio

    return base
  }, [colors.mutedBackground, width, height, aspectRatio])

  // Build image style with blur and opacity
  const computedImageStyle = useMemo(() => {
    const base: ImageStyle = {
      width: '100%',
      height: '100%',
    }

    if (Platform.OS === 'web') {
      return {
        ...base,
        filter: shouldBlur ? `blur(${blurRadius}px)` : 'none',
        opacity,
        transition: 'filter 0.3s ease, opacity 0.3s ease',
        transform: shouldBlur ? 'scale(1.1)' : 'scale(1)', // Slight scale to hide blur edges
      } as any
    }

    // Native doesn't support blur on Image, use opacity only
    return {
      ...base,
      opacity,
    }
  }, [shouldBlur, blurRadius, opacity])

  const accessibilityProps = Platform.OS === 'web'
    ? {
        accessibilityRole: 'img' as const,
        accessibilityLabel: alt,
        'aria-label': alt,
      } as any
    : {
        accessible: true,
        accessibilityRole: 'image' as const,
        accessibilityLabel: alt,
      }

  return (
    <View
      style={[styles.container, computedContainerStyle, containerStyle]}
      testID={testID}
    >
      <Image
        source={{ uri: currentSrc }}
        style={[computedImageStyle, style]}
        resizeMode={resizeMode}
        {...accessibilityProps}
        // Add cache busting
        {...(updatedAt && Platform.OS === 'web' ? { key: `${source}-${updatedAt}` } : {})}
      />

      {/* Loading skeleton overlay */}
      {!isLoaded && (
        <View style={styles.skeletonOverlay}>
          <View style={[styles.skeleton, { backgroundColor: colors.borderLight }]} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  skeletonOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  skeleton: {
    width: '100%',
    height: '100%',
    ...(Platform.OS === 'web'
      ? {
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }
      : {}),
  } as any,
})

export default ProgressiveImage
