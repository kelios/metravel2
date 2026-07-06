/**
 * LazyYouTubeSection - Ленивая загрузка YouTube плеера
 * Извлечено из TravelDetailsDeferred
 */

import React, { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useProgressiveLoad } from '@/hooks/useProgressiveLoading'
import { useThemedColors } from '@/hooks/useTheme'

import { useYoutubeEmbedModel } from '../hooks/useYoutubeEmbedModel'
import { useTravelDetailsStyles } from '../TravelDetailsStyles'
import { Icon } from '../TravelDetailsIcons'

export interface LazyYouTubeProps {
  url: string
}

export const LazyYouTube: React.FC<LazyYouTubeProps> = memo(({ url }) => {
  const styles = useTravelDetailsStyles()
  const colors = useThemedColors()
  const { embedUrl, handlePreviewPress, id, mounted } = useYoutubeEmbedModel(url)
  // Ticket #818: the YouTube thumbnail is a below-the-fold, non-hero preview.
  // `allowCriticalWebBlur` renders the blur backdrop as a CSS background-image,
  // which browsers fetch eagerly regardless of `loading="lazy"` → Lighthouse
  // `offscreen-images` flags the hqdefault.jpg (~36 KiB) before the section is
  // near the viewport. Sanctioned exception to the "no offscreen skipping" image
  // rule for this one thumbnail: gate the whole ImageCardMedia behind an
  // IntersectionObserver so hqdefault.jpg is not requested until the section
  // approaches the viewport. The blur-first-frame contract is preserved once the
  // image mounts. The reserved 16:9 dark slot + play overlay avoids any CLS.
  const { shouldLoad, setElementRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '200px',
    threshold: 0.1,
    disableFallbackOnWeb: true,
  })

  if (!id) return null

  if (!mounted) {
    return (
      <Pressable
        ref={setElementRef}
        onPress={handlePreviewPress}
        style={styles.videoContainer}
        accessibilityRole="button"
        accessibilityLabel="Смотреть видео"
      >
        {shouldLoad ? (
          <ImageCardMedia
            src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`}
            alt="Превью видео YouTube"
            fit="contain"
            blurBackground
            allowCriticalWebBlur
            cachePolicy="memory-disk"
            style={StyleSheet.absoluteFill}
            borderRadius={DESIGN_TOKENS.radii.md}
          />
        ) : null}
        <View style={styles.playOverlay}>
          <Icon name="play-circle-fill" size={64} color={colors.textOnDark} />
          <Text style={styles.videoHintText}>Видео запустится автоматически</Text>
        </View>
      </Pressable>
    )
  }

  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '16 / 9',
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: colors.text,
        contain: 'layout style paint' as any,
      }}
    >
      <iframe
        src={embedUrl ?? undefined}
        width="100%"
        height="100%"
        style={{ border: 'none', display: 'block' }}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        title="YouTube video"
      />
    </div>
  )
})

LazyYouTube.displayName = 'LazyYouTube'
