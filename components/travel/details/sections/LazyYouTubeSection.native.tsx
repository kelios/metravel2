/**
 * LazyYouTubeSection - Ленивая загрузка YouTube плеера
 * Извлечено из TravelDetailsDeferred
 */

import React, { Suspense, memo, useMemo } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import {
  THIRD_PARTY_WEBVIEW_PRIVACY_PROPS,
  createThirdPartyNavigationGuard,
} from '@/utils/thirdPartyWebViewPrivacy'

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
  const { handlePreviewPress, id, mounted, nativeEmbedUrl, nativeSource } = useYoutubeEmbedModel(url)
  // #2135: в WebView остаётся только обёртка (baseUrl) и iframe плеера; «Смотреть
  // на YouTube», заголовок и любые другие переходы уходят во внешний браузер или
  // приложение YouTube, а не открывают youtube.com внутри приложения.
  const navigationGuard = useMemo(
    () =>
      createThirdPartyNavigationGuard({
        documentUrl: nativeSource?.baseUrl ?? '',
        frameUrls: nativeEmbedUrl ? [nativeEmbedUrl] : [],
      }),
    [nativeEmbedUrl, nativeSource?.baseUrl],
  )

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
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          allowsProtectedMedia
          androidLayerType="hardware"
          mixedContentMode="compatibility"
          // #2135: плеер YouTube — сторонний контент: без общих и сторонних
          // cookies, хранилище только на время показа; навигация — только
          // исходный документ, остальное во внешний браузер (navigationGuard).
          {...THIRD_PARTY_WEBVIEW_PRIVACY_PROPS}
          {...navigationGuard}
        />
      </View>
    </Suspense>
  )
})

LazyYouTube.displayName = 'LazyYouTube'
