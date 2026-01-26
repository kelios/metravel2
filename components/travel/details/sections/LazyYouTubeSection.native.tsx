/**
 * LazyYouTubeSection - Ленивая загрузка YouTube плеера
 * Извлечено из TravelDetailsDeferred
 */

import React, { Suspense, memo, useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { safeGetYoutubeId } from '@/utils/travelDetailsSecure'

import { useTravelDetailsStyles } from '../TravelDetailsStyles'
import { withLazy } from '../TravelDetailsLazy'
import { Icon } from '../TravelDetailsIcons'

const WebViewComponent = withLazy<React.ComponentType<any>>(() =>
  import('react-native-webview').then((m: any) => ({
    default: (m.default ?? m.WebView) as React.ComponentType<any>,
  }))
)

export interface LazyYouTubeProps {
  url: string
}

const Fallback = () => {
  const styles = useTravelDetailsStyles()
  return (
    <View style={styles.fallback}>
      <ActivityIndicator size="small" />
    </View>
  )
}

const getYoutubeId = safeGetYoutubeId

export const LazyYouTube: React.FC<LazyYouTubeProps> = memo(({ url }) => {
  const styles = useTravelDetailsStyles()
  const colors = useThemedColors()
  const id = useMemo(() => getYoutubeId(url), [url])
  const [mounted, setMounted] = useState(false)
  const [shouldAutoplay, setShouldAutoplay] = useState(false)

  const embedUrl = useMemo(() => {
    if (!id) return null
    const params = [
      `autoplay=${shouldAutoplay ? 1 : 0}`,
      `mute=${shouldAutoplay ? 1 : 0}`,
      'playsinline=1',
      'rel=0',
      'modestbranding=1',
    ].join('&')
    return `https://www.youtube.com/embed/${id}?${params}`
  }, [id, shouldAutoplay])

  const handlePreviewPress = useCallback(() => {
    setMounted(true)
    setShouldAutoplay(true)
  }, [])

  if (!id) return null

  if (!mounted) {
    return (
      <Pressable
        onPress={handlePreviewPress}
        style={styles.videoContainer}
        accessibilityRole="button"
        accessibilityLabel="Смотреть видео"
      >
        <ImageCardMedia
          src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`}
          fit="contain"
          blurBackground
          cachePolicy="memory-disk"
          style={StyleSheet.absoluteFill}
          borderRadius={DESIGN_TOKENS.radii.md}
        />
        <View style={styles.playOverlay}>
          <Icon name="play-circle-fill" size={64} color={colors.textOnDark} />
          <Text style={styles.videoHintText}>Видео запустится автоматически</Text>
        </View>
      </Pressable>
    )
  }

  return (
    <Suspense fallback={<Fallback />}>
      <View style={styles.videoContainer}>
        <WebViewComponent
          source={{ uri: embedUrl ?? `https://www.youtube.com/embed/${id}` }}
          style={{ flex: 1 }}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          allowsFullscreenVideo
        />
      </View>
    </Suspense>
  )
})

LazyYouTube.displayName = 'LazyYouTube'
