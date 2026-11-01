import be from '@/data/advent/2026.be.json'
import en from '@/data/advent/2026.en.json'
import pl from '@/data/advent/2026.pl.json'
import uk from '@/data/advent/2026.uk.json'
import type { AdventCampaignOverlay } from '@/types/advent'

/**
 * Native: переводы контента дверец (#2883) лежат в бандле, выбор по локали
 * синхронный. Web-пара `campaignOverlay.web.ts` грузит их ленивыми чанками.
 */
const OVERLAYS: Record<string, AdventCampaignOverlay> = {
  be: be as AdventCampaignOverlay,
  uk: uk as AdventCampaignOverlay,
  pl: pl as AdventCampaignOverlay,
  en: en as AdventCampaignOverlay,
}

/** `null` — у локали нет переводов (RU-источник); `undefined` — ещё не загружены (только web). */
export const getLoadedAdventOverlay = (locale: string): AdventCampaignOverlay | null | undefined =>
  OVERLAYS[locale] ?? null

export const loadAdventOverlay = async (locale: string): Promise<AdventCampaignOverlay | null> =>
  OVERLAYS[locale] ?? null
