// FE-ARCH D1 #994 — общая нормализация серверного CardViewTravelDto в форму
// коллекций пользователя (favorites / recommendations / view-history). Раньше
// один и тот же маппинг был скопирован в трёх сторах (refreshFromServer);
// при миграции на React Query выносим его в одно место, чтобы hook'и запросов
// делили ровно одну реализацию.

import type { CardViewTravelDto } from '@/api/user';
import { buildTravelPath } from '@/utils/routePaths';
import { translate as i18nT } from '@/i18n';

export interface NormalizedServerTravel {
  id: number;
  type: 'travel';
  title: string;
  url: string;
  imageUrl?: string;
  country?: string;
  city?: string;
  // Серверный updated_at в мс (finite-guarded к Date.now()). Вызывающий кладёт
  // его в своё доменное поле: addedAt (favorites/recommendations) или viewedAt.
  timestamp: number;
}

// Пустая строка означает «ссылки нет» — тот же контракт, что у
// `resolveTravelUrl`. #1438: последней веткой был безусловный
// `/travels/${t.id}`, а поле объявлено `number`, но с бэкенда приходит и `null`,
// то есть карточка коллекции получала адрес `/travels/null` — 404.
const cleanTravelUrl = (t: CardViewTravelDto): string => {
  if (t.slug) return `/travels/${t.slug}`;
  if (t.url) return String(t.url).split('?')[0].split('#')[0];
  return buildTravelPath(t.id) ?? '';
};

export const normalizeServerTravelCard = (t: CardViewTravelDto): NormalizedServerTravel => {
  const parsed = t.updated_at ? new Date(t.updated_at).getTime() : NaN;
  return {
    id: t.id,
    type: 'travel',
    title: t.name || i18nT('errorsStatic:stores.content.untitled'),
    url: cleanTravelUrl(t),
    imageUrl: t.travel_image_thumb_url,
    country: t.countryName ?? undefined,
    // Без этого поля коллекции теряли город даже там, где бэкенд прислал
    // настоящее название: карточка избранного показывала одну страну, а та же
    // карточка в истории — «Gdańsk, Польша», потому что история наполняется ещё
    // и клиентом при просмотре. Адресоподобные значения (а их большинство)
    // отсекает resolveTravelCityName при отображении.
    city: t.cityName ?? undefined,
    timestamp: Number.isFinite(parsed) ? parsed : Date.now(),
  };
};

export const normalizeServerTravelCards = (
  dto: CardViewTravelDto[] | unknown,
): NormalizedServerTravel[] =>
  (Array.isArray(dto) ? dto : []).map(normalizeServerTravelCard);
