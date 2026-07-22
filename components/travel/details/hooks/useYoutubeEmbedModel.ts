import { useCallback, useMemo, useState } from 'react'

import { safeGetYoutubeId } from '@/utils/travelMedia'

/**
 * Origin, от имени которого нативный WebView открывает YouTube-эмбед.
 *
 * Плеер YouTube отдаёт «Ошибка 153 — Ошибка настройки видеопроигрывателя», если
 * `/embed/<id>` открыт как документ верхнего уровня: у такого запроса нет
 * `Referer`, и встраивание считается неавторизованным. Поэтому в native мы
 * грузим не URL, а HTML c iframe и `baseUrl` нашего домена — тогда у запроса
 * эмбеда есть и `Referer`, и совпадающий с ним `origin`.
 */
const NATIVE_EMBED_ORIGIN = 'https://metravel.by'

export interface NativeYoutubeSource {
  baseUrl: string
  html: string
}

export interface UseYoutubeEmbedModelResult {
  embedUrl: string | null
  handlePreviewPress: () => void
  id: string | null
  mounted: boolean
  nativeSource: NativeYoutubeSource | null
  shouldAutoplay: boolean
}

const buildEmbedParams = (shouldAutoplay: boolean, extra: string[] = []): string =>
  [
    `autoplay=${shouldAutoplay ? 1 : 0}`,
    `mute=${shouldAutoplay ? 1 : 0}`,
    'playsinline=1',
    'rel=0',
    'modestbranding=1',
    ...extra,
  ].join('&')

export function useYoutubeEmbedModel(url: string): UseYoutubeEmbedModelResult {
  const id = useMemo(() => safeGetYoutubeId(url), [url])
  const [mounted, setMounted] = useState(false)
  const [shouldAutoplay, setShouldAutoplay] = useState(false)

  const embedUrl = useMemo(() => {
    if (!id) return null
    return `https://www.youtube.com/embed/${id}?${buildEmbedParams(shouldAutoplay)}`
  }, [id, shouldAutoplay])

  const nativeSource = useMemo<NativeYoutubeSource | null>(() => {
    if (!id) return null
    const src = `https://www.youtube.com/embed/${id}?${buildEmbedParams(shouldAutoplay, [
      'enablejsapi=1',
      `origin=${encodeURIComponent(NATIVE_EMBED_ORIGIN)}`,
    ])}`
    return {
      baseUrl: NATIVE_EMBED_ORIGIN,
      html: [
        '<!DOCTYPE html><html><head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">',
        '<style>html,body{margin:0;padding:0;height:100%;background:#000;overflow:hidden}',
        'iframe{display:block;border:0;width:100%;height:100%}</style>',
        '</head><body>',
        `<iframe src="${src}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`,
        '</body></html>',
      ].join(''),
    }
  }, [id, shouldAutoplay])

  const handlePreviewPress = useCallback(() => {
    setMounted(true)
    setShouldAutoplay(true)
  }, [])

  return { embedUrl, handlePreviewPress, id, mounted, nativeSource, shouldAutoplay }
}
