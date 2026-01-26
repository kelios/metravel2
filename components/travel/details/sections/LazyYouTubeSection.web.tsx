/**
 * LazyYouTubeSection - Ленивая загрузка YouTube плеера
 * Извлечено из TravelDetailsDeferred
 */

import React, { memo, useCallback, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { safeGetYoutubeId } from '@/utils/travelDetailsSecure'

import { useTravelDetailsStyles } from '../TravelDetailsStyles'
import { Icon } from '../TravelDetailsIcons'

export interface LazyYouTubeProps {
  url: string
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
