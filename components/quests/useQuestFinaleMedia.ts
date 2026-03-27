import { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'

import { safeGetYoutubeId } from '@/utils/travelDetailsSecure'

import { resolveQuestUri } from './questWizardHelpers'

type QuestFinaleMediaInput = {
  finaleVideo?: any
  finalePoster?: any
  coverUrl?: string
  screenW: number
  screenH: number
  onFinaleVideoRetry?: () => void
}

export function useQuestFinaleMedia({
  finaleVideo,
  finalePoster,
  coverUrl,
  screenW,
  screenH,
  onFinaleVideoRetry,
}: QuestFinaleMediaInput) {
  const [videoOk, setVideoOk] = useState(true)

  const videoMaxWidth = 960
  const horizontalPadding = 32
  const footerReserve = 88
  const headerReserve = 220
  const maxFrameHeight = Math.max(180, screenH - headerReserve - footerReserve)

  let frameW = Math.min(Math.max(screenW - horizontalPadding, 240), videoMaxWidth)
  let frameH = (frameW * 9) / 16
  if (frameH > maxFrameHeight) {
    frameH = maxFrameHeight
    frameW = (frameH * 16) / 9
  }

  const videoUri = useMemo(() => {
    const uri = resolveQuestUri(finaleVideo)
    if (finaleVideo) {
      console.info('[QuestWizard] Video source:', finaleVideo)
      console.info('[QuestWizard] Resolved video URI:', uri)
    }
    return uri
  }, [finaleVideo])

  const posterUri = useMemo(() => resolveQuestUri(finalePoster), [finalePoster])
  const coverUri = useMemo(() => resolveQuestUri(coverUrl), [coverUrl])

  const youtubeEmbedUri = useMemo(() => {
    if (!videoUri) {
      console.info('[QuestWizard] No video URI for YouTube check')
      return undefined
    }
    const youtubeId = safeGetYoutubeId(videoUri)
    if (youtubeId) {
      console.info('[QuestWizard] YouTube ID detected:', youtubeId)
    } else {
      console.info('[QuestWizard] Not a YouTube URL:', videoUri)
    }
    if (!youtubeId) return undefined
    return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`
  }, [videoUri])

  const handleVideoError = useMemo(
    () => () => {
      console.error('[QuestWizard] Video playback error')
      setVideoOk(false)
    },
    []
  )

  const handleVideoRetry = useCallback(() => {
    console.info('[QuestWizard] Retrying video playback')
    if (Platform.OS === 'web') {
      onFinaleVideoRetry?.()
    }
    setVideoOk(true)
  }, [onFinaleVideoRetry])

  useEffect(() => {
    console.info('[QuestWizard] Video changed, resetting videoOk state')
    setVideoOk(true)
  }, [finaleVideo])

  return {
    frameW,
    videoOk,
    setVideoOk,
    videoUri,
    posterUri,
    coverUri,
    youtubeEmbedUri,
    handleVideoError,
    handleVideoRetry,
  }
}
