/**
 * LazyYouTubeSection - Ленивая загрузка YouTube плеера
 * Извлечено из TravelDetailsDeferred
 */

import React, { Suspense, memo } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'

import { useYoutubeEmbedModel } from '../hooks/useYoutubeEmbedModel'
import { useTravelDetailsStyles } from '../TravelDetailsStyles'
import { withLazy } from '../TravelDetailsLazy'
import { Icon } from '../TravelDetailsIcons'

const WebViewComponent = withLazy<React.ComponentType<any>>(() =>
  Promise.resolve(import('react-native-webview')).then((m: any) => ({
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

export const LazyYouTube: React.FC<LazyYouTubeProps> = memo(({ url }) => {
  const styles = useTravelDetailsStyles()
  const colors = useThemedColors()
  const { embedUrl, handlePreviewPress, id, mounted } = useYoutubeEmbedModel(url)

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
          alt="Превью видео YouTube"
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
          testID="travel-youtube-webview"
          source={{ uri: embedUrl ?? `https://www.youtube.com/embed/${id}` }}
          style={{ flex: 1 }}
          originWhitelist={['https://*']}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          allowsProtectedMedia
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={false}
          androidLayerType="hardware"
          mixedContentMode="compatibility"
        />
      </View>
    </Suspense>
  )
})

LazyYouTube.displayName = 'LazyYouTube'
