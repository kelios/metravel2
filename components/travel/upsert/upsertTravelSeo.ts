import { translate as i18nT } from '@/i18n';

/**
 * Единый источник SEO-строк создания/редактирования путешествия (#2740): ими
 * пользуются и экран (`UpsertTravel`), и `generateMetadata()` маршрутов
 * `app/(tabs)/travel/new.tsx` и `app/(tabs)/travel/[id].tsx`. Отдельный модуль — чтобы
 * маршруты не тянули за ключами тяжёлый экран мастера.
 */
export const UPSERT_TRAVEL_SEO_KEYS = {
  titleTemplate: 'travel:components.travel.UpsertTravel.value1_metravel_a966abc3',
  titleCreate: 'travel:components.travel.UpsertTravel.sozdat_puteshestvie_448e27bb',
  titleEditNamed: 'travel:components.travel.UpsertTravel.redaktirovat_puteshestvie_value1_b7c802d8',
  titleEdit: 'travel:components.travel.UpsertTravel.redaktirovat_puteshestvie_de5a1d0f',
  descriptionCreate: 'travel:components.travel.UpsertTravel.sozdayte_novoe_puteshestvie_v_lichnom_kabine_ddbac667',
  descriptionEdit: 'travel:components.travel.UpsertTravel.redaktirovanie_puteshestviya_v_lichnom_kabin_bcca604d',
} as const;

export const UPSERT_TRAVEL_NEW_PATH = '/travel/new';

/** Title/description страницы путешествия; `name` — имя редактируемого путешествия (если известно). */
export function buildUpsertTravelSeoText(isNew: boolean, name?: string | null): { title: string; description: string } {
  const trimmedName = name?.trim();
  const titleBase = isNew
    ? i18nT(UPSERT_TRAVEL_SEO_KEYS.titleCreate)
    : trimmedName
      ? i18nT(UPSERT_TRAVEL_SEO_KEYS.titleEditNamed, { value1: trimmedName })
      : i18nT(UPSERT_TRAVEL_SEO_KEYS.titleEdit);

  return {
    title: i18nT(UPSERT_TRAVEL_SEO_KEYS.titleTemplate, { value1: titleBase }),
    description: i18nT(isNew ? UPSERT_TRAVEL_SEO_KEYS.descriptionCreate : UPSERT_TRAVEL_SEO_KEYS.descriptionEdit),
  };
}
