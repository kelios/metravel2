import type { AdventCampaignOverlay } from '@/types/advent'

/**
 * Web: переводы контента дверец (#2883) — отдельные ленивые чанки `advent-<loc>`,
 * как языковые каталоги интерфейса (`i18n/deferred/locale-<loc>`): они не ездят с
 * каждой страницей и считаются в бюджете отдельно от общего размера релиза.
 * До загрузки экран показывает RU-источник — тот же текст, что в статическом HTML.
 * `Promise.resolve(import(...))` — правило 3 `docs/NATIVE_COMPAT_RULES.md` (#2931).
 */
const importOverlay = (locale: string): Promise<AdventCampaignOverlay | null> => {
  switch (locale) {
    case 'be':
      return Promise.resolve(import('./overlays/advent-be')).then((module) => module.default)
    case 'uk':
      return Promise.resolve(import('./overlays/advent-uk')).then((module) => module.default)
    case 'pl':
      return Promise.resolve(import('./overlays/advent-pl')).then((module) => module.default)
    case 'en':
      return Promise.resolve(import('./overlays/advent-en')).then((module) => module.default)
    default:
      return Promise.resolve(null)
  }
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
    // Сбой загрузки чанка (офлайн, сменился релиз) не запоминается как «переводов нет»:
    // следующий запрос локали повторит import(), а до тех пор экран остаётся RU.
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
