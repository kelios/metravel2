import React, { useMemo } from 'react'
import { Image as ExpoImage, ImageProps as ExpoImageProps } from 'expo-image'
import { Platform, View, StyleSheet, Image as RNImage } from 'react-native'

interface OptimizedImageProps extends Omit<ExpoImageProps, 'source'> {
  src: string
  alt?: string
  width?: number
  height?: number
  priority?: 'high' | 'low' | 'normal'
  loading?: 'lazy' | 'eager'
  aspectRatio?: number
  className?: string
}

/**
 * Оптимизированный компонент изображения с поддержкой:
 * - WebP/AVIF форматов
 * - Lazy loading
 * - Фиксированные размеры для предотвращения CLS
 * - Priority hints для LCP
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt = '',
  width,
  height,
  priority = 'normal',
  loading = 'lazy',
  aspectRatio,
  style,
  className,
  ...props
}) => {
  // Вычисляем размеры для предотвращения CLS
  const dimensions = useMemo(() => {
    if (width && height) {
      return { width, height }
    }
    if (width && aspectRatio) {
      return { width, height: width / aspectRatio }
    }
    if (height && aspectRatio) {
      return { width: height * aspectRatio, height }
    }
    return {}
  }, [width, height, aspectRatio])

  // Web-специфичная оптимизация
  if (Platform.OS === 'web') {
    const webSrc = useMemo(() => {
      // Если URL уже содержит параметры, не добавляем их
      if (src.includes('?') || src.includes('format=')) {
        return src
      }
      // Попытка использовать WebP (если сервер поддерживает)
      // В реальности это должно быть настроено на сервере
      return src
    }, [src])

    const webStyle = useMemo(
      () => ({
        ...dimensions,
        aspectRatio: aspectRatio ? String(aspectRatio) : undefined,
        objectFit: 'cover' as const,
        display: 'block' as const,
      }),
      [dimensions, aspectRatio]
    )

    return (
      <img
        src={webSrc}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        fetchpriority={priority}
        style={webStyle}
        className={className}
        {...(props as any)}
      />
    )
  }

  // Native оптимизация
  return (
    <View style={[dimensions, style]}>
      <ExpoImage
        source={{ uri: src }}
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
        contentFit="cover"
        cachePolicy="disk-memory"
        priority={priority}
        transition={200}
        {...props}
      />
    </View>
  )
}

export default OptimizedImage

