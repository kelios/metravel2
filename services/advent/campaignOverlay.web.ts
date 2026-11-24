import type { AdventCampaignOverlay } from '@/types/advent'

/** Год кампании, чьи переводы лежат в `public/assets/data/advent/<год>.<loc>.json`. */
export const ADVENT_OVERLAY_YEAR = 2026

const isOverlay = (value: unknown, locale: string): value is AdventCampaignOverlay => {
  if (!value || typeof value !== 'object') return false
  const overlay = value as Partial<AdventCampaignOverlay>
  return overlay.locale === locale && overlay.year === ADVENT_OVERLAY_YEAR && !!overlay.doors && typeof overlay.doors === 'object'
}

/**
 * Web: переводы контента дверец (#2883) — статические JSON рядом с сайтом, а не
 * JS-чанки (#3487): это контент-каталог, он растёт вместе с дверцами и не должен
 * сдвигать бюджет бандла и id модулей. Файл кэшируется по ETag
 * (`max-age=0, must-revalidate`), правка текста доезжает без смены имени.
 * До загрузки экран показывает RU-источник — тот же текст, что в статическом HTML.
 */
const importOverlay = async (locale: string): Promise<AdventCampaignOverlay | null> => {
  const response = await fetch(`/assets/data/advent/${ADVENT_OVERLAY_YEAR}.${locale}.json`)
  if (!response.ok) throw new Error(`advent overlay ${locale}: HTTP ${response.status}`)
  const payload: unknown = await response.json()
  return isOverlay(payload, locale) ? payload : null
}

const TRANSLATED_LOCALES = new Set(['be', 'uk', 'pl', 'en'])
const loaded = new Map<string, AdventCampaignOverlay | null>()
const pending = new Map<string, Promise<AdventCampaignOverlay | null>>()

/** `null` — локаль без переводов или чанк не загрузился; `undefined` — ещё грузится. */
export const getLoadedAdventOverlay = (locale: string): AdventCampaignOverlay | null | undefined => {
  if (loaded.has(locale)) return loaded.get(locale)
  return TRANSLATED_LOCALES.has(locale) ? undefined : null
}

export const loadAdventOverlay = (locale: string): Promise<AdventCampaignOverlay | null> => {
  if (loaded.has(locale)) return Promise.resolve(loaded.get(locale) ?? null)
  if (!TRANSLATED_LOCALES.has(locale)) {
    loaded.set(locale, null)
    return Promise.resolve(null)
  }
  let promise = pending.get(locale)
  if (!promise) {
    // Сбой загрузки (офлайн, 5xx) не запоминается как «переводов нет»:
    // следующий запрос локали повторит загрузку, а до тех пор экран остаётся RU.
    promise = importOverlay(locale)
      .then((overlay) => {
        loaded.set(locale, overlay)
        return overlay
      })
      .catch(() => null)
      .finally(() => {
        pending.delete(locale)
      })
    pending.set(locale, promise)
  }
  return promise
}
