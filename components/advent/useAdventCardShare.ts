import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { sendAnalyticsEvent } from '@/utils/analytics'
import type { AdventShareKind } from '@/utils/advent/adventShare'
import type { AdventCardSpec } from '@/utils/advent/adventShareImage'

type AdventShareKit = typeof import('@/utils/advent/adventShareKit')

let kitPromise: Promise<AdventShareKit> | null = null
/** Один чанк на сессию; ошибку загрузки не кэшируем — следующее нажатие повторит. */
const loadAdventShareKit = (): Promise<AdventShareKit> => {
  if (!kitPromise) {
    kitPromise = Promise.resolve(import('@/utils/advent/adventShareKit')).catch((error: unknown) => {
      kitPromise = null
      throw error
    })
  }
  return kitPromise
}

export type AdventCardShareStatus = 'idle' | 'busy' | 'copied' | 'failed'

/**
 * Скачивание и шеринг карточки адвента (#2868). Картинку рисует canvas только
 * на web; native делится ссылкой через системный share sheet.
 */
export function useAdventCardShare(params: {
  preview?: boolean
  kind: AdventShareKind
  year: number
  filename: string
  buildSpec: () => AdventCardSpec
  shareTitle: string
  shareText: string
}) {
  const { preview, kind, year, filename, buildSpec, shareTitle, shareText } = params
  const [status, setStatus] = useState<AdventCardShareStatus>('idle')
  const busyRef = useRef(false)
  const kitRef = useRef<AdventShareKit | null>(null)
  const canDownload = Platform.OS === 'web'

  // Предзагрузка при показе карточки: к нажатию модуль уже есть, и до
  // `navigator.share` не встаёт `await` — iOS Safari иначе теряет жест.
  useEffect(() => {
    let alive = true
    loadAdventShareKit()
      .then((kit) => {
        if (alive) kitRef.current = kit
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

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
        // Без `await` до шеринга, если модуль уже загружен: жест должен дожить до `navigator.share`.
        const kit = kitRef.current ?? (await loadAdventShareKit())
        const image = Platform.OS === 'web' ? kit.renderAdventCardPng(buildSpec()) : null
        const result = await kit.shareAdventCard({ title: shareTitle, text: shareText, year, kind, image, filename })
        if (!preview) sendAnalyticsEvent('Advent_Share', { kind, result, withImage: !!image })
        if (result === 'copied') return 'copied'
        if (result === 'failed') return 'failed'
        return 'idle'
      }),
    [run, buildSpec, shareTitle, shareText, year, kind, filename, preview],
  )

  const download = useCallback(
    () =>
      run(async () => {
        const kit = kitRef.current ?? (await loadAdventShareKit())
        const image = kit.renderAdventCardPng(buildSpec())
        const ok = !!image && kit.downloadAdventCard(image, filename)
        if (!preview) sendAnalyticsEvent('Advent_Download', { kind, ok })
        return ok ? 'idle' : 'failed'
      }),
    [run, buildSpec, filename, kind, preview],
  )

  return { status, share, download, canDownload }
}
