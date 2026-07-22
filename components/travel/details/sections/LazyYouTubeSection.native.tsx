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
import { translate as i18nT } from '@/i18n'


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
  const { handlePreviewPress, id, mounted, nativeSource } = useYoutubeEmbedModel(url)

  if (!id) return null

  if (!mounted) {
    return (
      <Pressable
        onPress={handlePreviewPress}
        style={styles.videoContainer}
        accessibilityRole="button"
        accessibilityLabel={i18nT('travel:components.travel.details.sections.LazyYouTubeSection.smotret_video_6c6623d8')}
      >
        <ImageCardMedia
          src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`}
          alt={i18nT('travel:components.travel.details.sections.LazyYouTubeSection.prevyu_video_youtube_8247752c')}
          fit="contain"
          blurBackground
          cachePolicy="memory-disk"
          style={StyleSheet.absoluteFill}
          borderRadius={DESIGN_TOKENS.radii.md}
        />
        <View style={styles.playOverlay}>
          <Icon name="play-circle-fill" size={64} color={colors.textOnDark} />
          <Text style={styles.videoHintText}>{i18nT('travel:components.travel.details.sections.LazyYouTubeSection.video_zapustitsya_avtomaticheski_dd7a9992')}</Text>
        </View>
      </Pressable>
    )
  }

  return (
    <Suspense fallback={<Fallback />}>
      <View style={styles.videoContainer}>
        <WebViewComponent
          testID="travel-youtube-webview"
          // Только html+baseUrl: прямой uri на /embed/ даёт «Ошибка 153»
          // (эмбед без Referer). См. useYoutubeEmbedModel.
          source={nativeSource ?? undefined}
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
