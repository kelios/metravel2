// Шеринг карточек адвента (#2868): ссылка на `/advent` с UTM-атрибуцией и
// картинка, если её удалось нарисовать. Web — Web Share API с файлом, без него
// со ссылкой, иначе копирование ссылки; native — системный share sheet
// (`utils/shareTravel.ts` — тот же порядок). Окна и внешние URL здесь не
// открываются — только share/clipboard/скачивание через `downloadBlobOnWeb`.

import { Platform, Share } from 'react-native'

import { ADVENT_ROUTE } from '@/constants/advent'
import { downloadBlobOnWeb } from '@/utils/downloadUrlOnWeb'
import { buildCanonicalUrl } from '@/utils/seo'
import { appendQueryParam } from '@/utils/urlParams'
import { getShareUtmMedium } from '@/utils/utm'

export type AdventShareKind = 'progress' | 'year'
export type AdventShareResult = 'shared' | 'copied' | 'cancelled' | 'failed'

/** `https://metravel.by/advent?utm_source=…&utm_medium=…&utm_campaign=advent_<year>_<kind>`. */
export const buildAdventShareUrl = (params: { channel: string; year: number; kind: AdventShareKind }): string => {
  let url = buildCanonicalUrl(ADVENT_ROUTE)
  url = appendQueryParam(url, 'utm_source', params.channel)
  url = appendQueryParam(url, 'utm_medium', getShareUtmMedium(params.channel))
  url = appendQueryParam(url, 'utm_campaign', `advent_${params.year}_${params.kind}`)
  return url
}

/** Адрес без протокола для подписи картинки: `metravel.by/advent`. */
export const adventFooterUrl = (): string => buildCanonicalUrl(ADVENT_ROUTE).replace(/^https?:\/\//, '')

const isAbortError = (error: unknown): boolean =>
  !!error && typeof error === 'object' && (error as { name?: string }).name === 'AbortError'

export async function shareAdventCard(params: {
  title: string
  text: string
  year: number
  kind: AdventShareKind
  image?: Blob | null
  filename: string
}): Promise<AdventShareResult> {
  const { title, text, year, kind, image, filename } = params
  try {
    if (Platform.OS === 'web') {
      const url = buildAdventShareUrl({ channel: 'native', year, kind })
      const nav = typeof navigator !== 'undefined' ? navigator : undefined
      if (nav?.share) {
        if (image && typeof File !== 'undefined' && typeof nav.canShare === 'function') {
          const file = new File([image], filename, { type: 'image/png' })
          if (nav.canShare({ files: [file] })) {
            await nav.share({ title, text: `${text}\n${url}`, files: [file] })
            return 'shared'
          }
        }
        await nav.share({ title, text, url })
        return 'shared'
      }
      if (nav?.clipboard) {
        await nav.clipboard.writeText(buildAdventShareUrl({ channel: 'copy', year, kind }))
        return 'copied'
      }
      return 'failed'
    }

    const url = buildAdventShareUrl({ channel: 'native', year, kind })
    const result = await Share.share(
      Platform.OS === 'ios' ? { message: text, url } : { message: `${text}\n\n${url}`, title },
      { dialogTitle: title },
    )
    return result.action === Share.sharedAction ? 'shared' : 'cancelled'
  } catch (error) {
    return isAbortError(error) ? 'cancelled' : 'failed'
  }
}

/** Скачивание PNG карточки (только web). */
export const downloadAdventCard = (image: Blob, filename: string): boolean => downloadBlobOnWeb(image, filename)
