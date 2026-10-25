// #2740: хелперы `generateMetadata` для файлов маршрутов `app/**` (web).
//
// Экспорт Expo SDK 58 вызывает `generateMetadata(request, params)` из листового
// файла маршрута в server-бандле и кладёт теги в `headNodes` документа;
// `_layout` не участвует, слияния нет — поэтому каждый маршрут отдаёт полный
// набор через эти хелперы. Строки те же, что у экранов (`@/i18n`, таблица
// `staticRoutes.js`), абсолютные URL — те же `buildCanonicalUrl`/`normalizeOgImageUrl`,
// что у `LazyInstantSEO`.

import { translate as i18nT } from '@/i18n';
import { getActiveLocaleDefinition } from '@/i18n/format';
import { buildCanonicalUrl, normalizeOgImageUrl } from '@/utils/seo';
import { buildRouteMetadata, type RouteMetadata, type RouteSeoInput } from './metadata';
import { DEFAULT_OG_IMAGE_PATH, resolveStaticRouteSeo } from './staticRoutes';

export type RouteSeoProps = Omit<RouteSeoInput, 'ogLocale' | 'canonical' | 'image'> & {
  /** Абсолютный canonical или путь (`/about`); путь разворачивается через `buildCanonicalUrl`. */
  canonical?: string | null;
  /** Абсолютный URL картинки или путь (`/og-home.jpg`); разворачивается `normalizeOgImageUrl`, как в `LazyInstantSEO`. */
  image?: string | null;
};

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

function resolveCanonical(canonical: string | null | undefined): string | undefined {
  if (!canonical) return undefined;
  return isAbsoluteUrl(canonical) ? canonical : buildCanonicalUrl(canonical);
}

/** Полный набор head-тегов маршрута из проектной формы (как props `InstantSEO`). */
export function routeMetadata(seo: RouteSeoProps): RouteMetadata {
  return buildRouteMetadata({
    ...seo,
    canonical: resolveCanonical(seo.canonical),
    // Тот же нормализатор, что у `LazyInstantSEO`: путь → абсолютный URL, http → https, соцпревью-ширина.
    image: normalizeOgImageUrl(seo.image) ?? undefined,
    ogLocale: getActiveLocaleDefinition().ogLocale,
  });
}

/**
 * Метаданные статического маршрута из общей таблицы `staticRoutes.js` —
 * те же значения, которыми SSG-генератор переписывает head этой страницы.
 */
export function staticRouteMetadata(route: string, overrides: Partial<RouteSeoProps> = {}): RouteMetadata {
  const resolved = resolveStaticRouteSeo(route, i18nT);
  if (!resolved) {
    throw new Error(`staticRouteMetadata: route ${route} is not in utils/seoRoutes/staticRoutes.js`);
  }
  return routeMetadata({
    title: resolved.title,
    description: resolved.description,
    robots: resolved.robots,
    canonical: resolved.canonicalRoute,
    image: resolved.imagePath,
    imageAlt: resolved.title,
    imageWidth: resolved.imageWidth,
    imageHeight: resolved.imageHeight,
    ogType: 'website',
    ...overrides,
  });
}

/**
 * Шаблон динамического маршрута (`[param].html`, `[id].html`, …): данных сущности
 * на экспорте нет, per-entity страницы пишет генератор поверх этого шаблона, а
 * сам шаблон он же переводит в noindex «не найдено» (`patchNoindexFallbackTemplate`).
 * Поэтому здесь только нейтральный бренд-head без robots и canonical — ровно то,
 * что helmet отдавал для маршрута без данных.
 */
export function shellRouteMetadata(overrides: Partial<RouteSeoProps> = {}): RouteMetadata {
  return routeMetadata({
    title: 'Metravel',
    description: i18nT('seoStatic:root.default.description'),
    image: DEFAULT_OG_IMAGE_PATH,
    ogType: 'website',
    ...overrides,
  });
}

/**
 * Head экрана «страница не найдена» (`NotFoundContent`): те же строки и набор, что у
 * его `InstantSEO` — noindex, без картинки и без canonical (#1441: один 404 на любой
 * несуществующий адрес). Общий для catch-all маршрута и экранов, которые без флага
 * отдают `NotFoundContent`.
 */
export function notFoundRouteMetadata(): RouteMetadata {
  return routeMetadata({
    title: i18nT('shared:app.missing.stranitsa_ne_naydena_metravel_a9673114'),
    description: i18nT('shared:app.missing.stranitsa_ne_naydena_pereydite_na_glavnuyu_i_0cfdec3b'),
    robots: 'noindex, nofollow',
  });
}
