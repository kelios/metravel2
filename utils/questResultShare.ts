// utils/questResultShare.ts
// FE-атрибуция шаринга РЕЗУЛЬТАТА квеста ([INV2-02], тикет борда #1472). Замыкает
// вирусную петлю: каждая исходящая ссылка на результат несёт UTM
// `utm_source=share&utm_medium=quest_result`, чтобы визиты по расшаренному диплому
// были видны в аналитике абсолютными числами. Конвенция и механизм переиспользуют
// подход шаринга достижений (utils/achievementShare.ts, #458), но у квеста своя
// фиксированная пара source/medium из постановки задачи. PII в метки не попадает:
// только slug/канал квеста. События трекинга — utils/gamificationAnalytics.ts.

import { buildCanonicalUrl } from '@/utils/seo';
import { appendQueryParam, hasQueryParam } from '@/utils/urlParams';

/** Единый источник для всех расшаренных результатов квеста (постановка #1472). */
export const QUEST_RESULT_UTM_SOURCE = 'share';
/** Канал петли «результат квеста» — по нему аналитика отделяет визиты от диплома. */
export const QUEST_RESULT_UTM_MEDIUM = 'quest_result';

/** Кампания на квест — даёт per-quest гранулярность в отчётах. */
const campaignFor = (slug: string): string => `quest_${slug || 'unknown'}`;

export interface QuestResultUtm {
  source: string;
  medium: string;
  campaign: string;
}

/** UTM-объект для тела create-result-card: сервер вшивает их в og:url диплома. */
export const buildQuestResultShareUtm = (slug: string): QuestResultUtm => ({
  source: QUEST_RESULT_UTM_SOURCE,
  medium: QUEST_RESULT_UTM_MEDIUM,
  campaign: campaignFor(slug),
});

/**
 * Навешивает utm_source/utm_medium/utm_campaign на публичную ссылку результата.
 * Сохраняет уже присутствующие query-параметры и hash и не дублирует существующие
 * UTM (метки не меняют path и не обязательны для резолва контента).
 */
export const buildQuestResultShareLink = (
  publicUrl: string,
  params: { slug: string },
): string => {
  if (!publicUrl) return publicUrl;
  let out = publicUrl;
  if (!hasQueryParam(out, 'utm_source')) {
    out = appendQueryParam(out, 'utm_source', QUEST_RESULT_UTM_SOURCE);
  }
  if (!hasQueryParam(out, 'utm_medium')) {
    out = appendQueryParam(out, 'utm_medium', QUEST_RESULT_UTM_MEDIUM);
  }
  if (!hasQueryParam(out, 'utm_campaign')) {
    out = appendQueryParam(out, 'utm_campaign', campaignFor(params.slug));
  }
  return out;
};

/**
 * Публичная ссылка на сам квест — фолбэк, пока публичная страница результата
 * `/quests/result/<id>` не задеплоена бэкендом. Совпадает с canonical страницы
 * квеста (`/quests/<cityId>/<slug>`), поэтому соцпревью подтягивает уже
 * пререндеренную обложку квеста, а не заглушку.
 */
export const buildQuestPublicUrl = (
  cityId: string | undefined,
  questSlug: string | undefined,
): string => {
  const city = String(cityId ?? '').trim();
  const slug = String(questSlug ?? '').trim();
  if (!city || !slug) return buildCanonicalUrl('/quests');
  return buildCanonicalUrl(`/quests/${city}/${slug}`);
};
