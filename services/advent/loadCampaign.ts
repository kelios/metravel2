import campaign2026 from '@/data/advent/2026.json'
import type { AdventCampaignConfig } from '@/types/advent'

/**
 * Источник конфига кампании. Этап A — локальный JSON (штатный источник, не мок).
 * Этап B (#2867) подключает `GET /api/advent/campaigns/current/` с тем же контрактом;
 * локальный файл остаётся fallback только в DEV.
 */
export const getAdventCampaign = (): AdventCampaignConfig => campaign2026 as AdventCampaignConfig

export const loadAdventCampaign = async (): Promise<AdventCampaignConfig> => getAdventCampaign()
