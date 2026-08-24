// utils/achievementShare.ts
// FE-атрибуция шаринга достижений (Sprint 12, тикет борда #458). Строит ссылки с
// UTM-метками для каждого канала и хранит конвенцию UTM. North Star спринта —
// регистрации, атрибутированные расшаренным карточкам, поэтому каждая исходящая
// ссылка обязана нести source/medium/campaign. PII в метки не попадает: только
// slug/id достижения и канал. События трекинга — в utils/gamificationAnalytics.ts.

import { appendQueryParam, hasQueryParam } from '@/utils/urlParams';

export type ShareChannel =
  | 'telegram'
  | 'facebook'
  | 'whatsapp'
  | 'native'
  | 'copy'
  | 'download';

/** Каналы, открывающие внешний URL (для них строим UTM-ссылку). */
const UTM_MEDIUM = 'badge_share';

/** Префикс кампании на достижение — даёт per-badge гранулярность KPI. */
const campaignFor = (slug: string): string => `badge_${slug || 'unknown'}`;

/**
 * Навешивает utm_source/utm_medium/utm_campaign на публичный URL достижения.
 * Сохраняет уже присутствующие query-параметры и не дублирует существующие UTM
 * (контракт #458: UTM не меняют path и не обязательны для резолва контента).
 */
export const buildShareLink = (
  publicUrl: string,
  params: { channel: ShareChannel; slug: string },
): string => {
  if (!publicUrl) return publicUrl;
  let out = publicUrl;
  if (!hasQueryParam(out, 'utm_source')) {
    out = appendQueryParam(out, 'utm_source', params.channel);
  }
  if (!hasQueryParam(out, 'utm_medium')) {
    out = appendQueryParam(out, 'utm_medium', UTM_MEDIUM);
  }
  if (!hasQueryParam(out, 'utm_campaign')) {
    out = appendQueryParam(out, 'utm_campaign', campaignFor(params.slug));
  }
  return out;
};

/** UTM-объект для тела create-share-card (#382 вшивает их в og:url). */
export const buildShareUtm = (
  channel: ShareChannel,
  slug: string,
): { source: string; medium: string; campaign: string } => ({
  source: channel,
  medium: UTM_MEDIUM,
  campaign: campaignFor(slug),
});
