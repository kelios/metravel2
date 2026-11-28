import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { sendAnalyticsEvent } from '@/utils/analytics'
import type { AdventShareKind } from '@/utils/advent/adventShare'
import { ADVENT_CARD_ARTWORK, type AdventCardArtwork } from '@/utils/advent/adventCardArtwork'
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

function loadCardArtwork(name: AdventCardArtwork): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Advent artwork unavailable'))
    image.src = `/assets/images/advent-titles/${name}.webp`
  })
}

export type AdventCardShareStatus = 'idle' | 'busy' | 'copied' | 'failed'

/**
 * Скачивание и шеринг карточки адвента (#2868). Картинку рисует canvas только
 * на web; native делится ссылкой через системный share sheet.
 */
export function useAdventCardShare(params: {
  preview?: boolean
  artwork?: AdventCardArtwork
  kind: AdventShareKind
  year: number
  filename: string
  buildSpec: () => AdventCardSpec
  shareTitle: string
  shareText: string
}) {
  const { preview, kind, artwork, year, filename, buildSpec, shareTitle, shareText } = params
  const [status, setStatus] = useState<AdventCardShareStatus>('idle')
  const busyRef = useRef(false)
  const kitRef = useRef<AdventShareKit | null>(null)
  const canDownload = Platform.OS === 'web'

  const artName = canDownload ? (artwork ?? ADVENT_CARD_ARTWORK[kind]) : undefined
  const [prepared, setPrepared] = useState<{ name: string; image: HTMLImageElement | null } | null>(null)

  // Подготавливаем картинку до клика: Safari требует синхронный вызов navigator.share.
  useEffect(() => {
    let alive = true
    const loaded = artName ? loadCardArtwork(artName) : null
    const kitReady = loadAdventShareKit().then((kit) => {
      if (alive) kitRef.current = kit
    })
    Promise.all([kitReady, loaded]).then(([, image]) => {
      if (alive && artName) setPrepared({ name: artName, image })
    }).catch(() => {
      if (alive && artName) setPrepared({ name: artName, image: null })
    })
    return () => { alive = false }
  }, [artName])

  const readyArt = prepared?.name === artName ? prepared?.image : undefined
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
        // Если иллюстрация не загрузилась, системный лист всё равно может отправить ссылку.
        const image = canDownload && readyArt ? kit.renderAdventCardPng(buildSpec(), readyArt ?? undefined) : null
        const result = await kit.shareAdventCard({ title: shareTitle, text: shareText, year, kind, image, filename })
        if (!preview) sendAnalyticsEvent('Advent_Share', { kind, result, withImage: !!image })
        if (result === 'copied') return 'copied'
        if (result === 'failed') return 'failed'
        return 'idle'
      }),
    [run, buildSpec, shareTitle, shareText, year, kind, filename, preview, readyArt, canDownload],
  )

  const download = useCallback(
    () =>
      run(async () => {
        const kit = kitRef.current ?? (await loadAdventShareKit())
        const art = readyArt ?? (artName ? await loadCardArtwork(artName) : undefined)
        if (artName && art) setPrepared({ name: artName, image: art })
        const image = kit.renderAdventCardPng(buildSpec(), art)
        const ok = !!image && kit.downloadAdventCard(image, filename)
        if (!preview) sendAnalyticsEvent('Advent_Download', { kind, ok })
        return ok ? 'idle' : 'failed'
      }),
    [run, buildSpec, filename, kind, preview, readyArt, artName],
  )

  const actionStatus: AdventCardShareStatus = artName && readyArt === undefined ? 'busy' : status
  return { status: actionStatus, share, download, canDownload }
}
