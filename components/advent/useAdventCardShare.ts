import { useCallback, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { sendAnalyticsEvent } from '@/utils/analytics'
import { downloadAdventCard, shareAdventCard, type AdventShareKind } from '@/utils/advent/adventShare'
import { renderAdventCardPng, type AdventCardSpec } from '@/utils/advent/adventShareImage'

export type AdventCardShareStatus = 'idle' | 'busy' | 'copied' | 'failed'

/**
 * Скачивание и шеринг карточки адвента (#2868). Картинку рисует canvas только
 * на web; native делится ссылкой через системный share sheet.
 */
export function useAdventCardShare(params: {
  kind: AdventShareKind
  year: number
  filename: string
  buildSpec: () => AdventCardSpec
  shareTitle: string
  shareText: string
}) {
  const { kind, year, filename, buildSpec, shareTitle, shareText } = params
  const [status, setStatus] = useState<AdventCardShareStatus>('idle')
  const busyRef = useRef(false)
  const canDownload = Platform.OS === 'web'

  const run = useCallback(
    async (action: () => Promise<AdventCardShareStatus>) => {
      if (busyRef.current) return
      busyRef.current = true
      setStatus('busy')
      try {
        setStatus(await action())
      } catch {
        setStatus('failed')
      } finally {
        busyRef.current = false
      }
    },
    [],
  )

  const share = useCallback(
    () =>
      run(async () => {
        // Без `await` до шеринга: жест пользователя должен дожить до `navigator.share`.
        const image = Platform.OS === 'web' ? renderAdventCardPng(buildSpec()) : null
        const result = await shareAdventCard({ title: shareTitle, text: shareText, year, kind, image, filename })
        sendAnalyticsEvent('Advent_Share', { kind, result, withImage: !!image })
        if (result === 'copied') return 'copied'
        if (result === 'failed') return 'failed'
        return 'idle'
      }),
    [run, buildSpec, shareTitle, shareText, year, kind, filename],
  )

  const download = useCallback(
    () =>
      run(async () => {
        const image = renderAdventCardPng(buildSpec())
        const ok = !!image && downloadAdventCard(image, filename)
        sendAnalyticsEvent('Advent_Download', { kind, ok })
        return ok ? 'idle' : 'failed'
      }),
    [run, buildSpec, filename, kind],
  )

  return { status, share, download, canDownload }
}
