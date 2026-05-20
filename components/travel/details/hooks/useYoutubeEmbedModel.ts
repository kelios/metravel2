import { useCallback, useMemo, useState } from 'react'

import { safeGetYoutubeId } from '@/utils/travelMedia'

export interface UseYoutubeEmbedModelResult {
  embedUrl: string | null
  handlePreviewPress: () => void
  id: string | null
  mounted: boolean
  shouldAutoplay: boolean
}

export function useYoutubeEmbedModel(url: string): UseYoutubeEmbedModelResult {
  const id = useMemo(() => safeGetYoutubeId(url), [url])
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

  return { embedUrl, handlePreviewPress, id, mounted, shouldAutoplay }
}
