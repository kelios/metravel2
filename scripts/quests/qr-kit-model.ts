import { formatInteger, getFixedTranslator, isSupportedLocale, type SupportedLocale } from '@/i18n';
import { buildQuestLocalePath } from '@/utils/questLocaleRouting';
import { parseQuestPublicRoute, validateQuestPublicProjection } from '@/utils/questPublicPage';
import { UTM_MEDIUMS } from '@/utils/utm';
import { PRINT_COLORS } from '@/components/quests/printable/constants';

export const QUEST_QR_PROFILES = [
  { id: 'flyer-a5', widthMm: 148, heightMm: 210, qrMm: 70 },
  { id: 'sticker-100x120', widthMm: 100, heightMm: 120, qrMm: 45 },
] as const;

export function validateQuestQrOptions({ locale, campaign }: { locale: string; campaign: string }) {
  if (!isSupportedLocale(locale)) throw new Error('Unsupported print locale');
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(campaign)) {
    throw new Error('Campaign must be a 1–64 character lowercase placement code (letters, digits, _ or -)');
  }
  return { locale, campaign };
}

export function buildQuestQrPrintModel(raw: unknown, options: {
  questId: string; cityId: number; locale: SupportedLocale; campaign: string;
}) {
  const { questId, cityId } = options;
  const { locale, campaign } = validateQuestQrOptions(options);
  const contentLocale = raw && typeof raw === 'object' && 'locale' in raw ? raw.locale : null;
  if (!isSupportedLocale(contentLocale) || (contentLocale !== locale && contentLocale !== 'ru')) {
    throw new Error('Unexpected quest content locale');
  }
  const routePath = buildQuestLocalePath(cityId, questId, contentLocale);
  const route = routePath ? parseQuestPublicRoute(routePath) : null;
  const projection = route ? validateQuestPublicProjection(raw, route) : null;
  if (!projection || projection.kind !== 'detail' || projection.city_id !== cityId || projection.quest_slug !== questId
      || !projection.trip_facts || !projection.page.heading.trim()) {
    throw new Error('A matching published quest with verified trip facts is required');
  }
  const target = new URL(projection.canonical_path, 'https://metravel.by');
  target.searchParams.set('utm_source', 'qr');
  target.searchParams.set('utm_medium', UTM_MEDIUMS.referral);
  target.searchParams.set('utm_campaign', campaign);
  const t = getFixedTranslator(locale);
  const duration = projection.trip_facts.duration_min;
  return {
    questId, cityId, locale, contentLocale: projection.locale, campaign,
    targetUrl: target.href,
    publicationId: projection.publication_id,
    sourceRevision: projection.source_revision,
    facts: { durationMin: duration, isFree: projection.trip_facts.is_free },
    text: {
      title: projection.page.heading,
      kicker: t('books:questQrKicker'),
      duration: duration === null ? t('books:questQrDurationUnknown')
        : t('books:questQrDuration', { minutes: formatInteger(duration, locale) }),
      offer: t(projection.trip_facts.is_free ? 'books:questQrOffer' : 'books:questQrSelfGuided'),
      scan: t('books:questQrScan'),
    },
    colors: { brand: PRINT_COLORS.brand, ink: PRINT_COLORS.ink, muted: PRINT_COLORS.muted },
    profiles: QUEST_QR_PROFILES,
  };
}

export type QuestQrPrintModel = ReturnType<typeof buildQuestQrPrintModel>;
