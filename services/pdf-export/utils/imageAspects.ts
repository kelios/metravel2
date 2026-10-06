// Пропорции картинок книги из медиа-манифеста API (#2232).
//
// Раскладке книги нужны пропорции кадров: журнальная галерея строит ряды по
// ним, фото описания выбирают слот по ориентации. Сервер уже отдаёт их в
// `media` ответа путешествия, поэтому книга берёт их оттуда на всех платформах;
// браузерный замер остаётся только для кадров без записи в манифесте и только
// там, где есть `Image` (сайт).

import type { TravelMedia, TravelMediaImage } from '@/types/types';
import { resolveMediaPlaceholderKey } from '@/utils/mediaPlaceholderIndex';

const isPositiveFinite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/** Пропорция `width / height` записи манифеста или `null`, если её нет или она недопустима. */
export function resolveImageAspect(
  entry: Pick<TravelMediaImage, 'aspect_ratio' | 'width' | 'height'> | null | undefined
): number | null {
  if (!entry) return null;
  if (isPositiveFinite(entry.aspect_ratio)) return entry.aspect_ratio;
  if (isPositiveFinite(entry.width) && isPositiveFinite(entry.height)) return entry.width / entry.height;
  return null;
}

/** Пропорции фото галереи по `id` записи (он же `gallery[].id` верхнего уровня). */
export function buildGalleryAspectsById(media: TravelMedia | null | undefined): Map<string, number> {
  const aspects = new Map<string, number>();
  for (const entry of media?.gallery ?? []) {
    const aspect = resolveImageAspect(entry);
    if (entry && aspect) aspects.set(String(entry.id), aspect);
  }
  return aspects;
}

/**
 * Пропорции картинок описания по ключу файла (`resolveMediaPlaceholderKey`:
 * без origin, роут-префикса и query). `id` записей тела — порядковый номер, а
 * порядок `<img>` в разметке с манифестом не совпадает, поэтому только по файлу.
 */
export function buildDescriptionImageAspects(media: TravelMedia | null | undefined): Record<string, number> {
  const aspects: Record<string, number> = {};
  for (const entry of media?.article_body?.gallery ?? []) {
    const aspect = resolveImageAspect(entry);
    if (!entry || !aspect) continue;
    for (const url of [entry.src, entry.src_contain, entry.src_print, entry.src_cover]) {
      const key = resolveMediaPlaceholderKey(url);
      if (key) aspects[key] = aspect;
    }
  }
  return aspects;
}

/** Пропорция картинки описания по её `src` из разметки. */
export function lookupDescriptionImageAspect(
  aspects: Record<string, number> | null | undefined,
  src: string
): number | null {
  const key = resolveMediaPlaceholderKey(src);
  const aspect = key && aspects ? aspects[key] : undefined;
  return isPositiveFinite(aspect) ? aspect : null;
}

export type ImageAspectTarget = {
  /** Ключ, под которым пропорцию ищет потребитель (URL фото галереи, `src` описания). */
  key: string;
  /** Адрес, который грузит книга: по нему замеряется кадр без пропорции. */
  url: string;
  /** Пропорция из данных; нет — кадр уходит в замер. */
  aspect?: number | null;
};

/** Делит кадры на известные из данных пропорции и цели браузерного замера. */
export function splitImageAspectTargets(targets: Iterable<ImageAspectTarget>): {
  known: Map<string, number>;
  toMeasure: Map<string, string>;
} {
  const known = new Map<string, number>();
  const toMeasure = new Map<string, string>();
  for (const { key, url, aspect } of targets) {
    if (isPositiveFinite(aspect)) {
      known.set(key, aspect);
      toMeasure.delete(key);
    } else if (!known.has(key)) {
      toMeasure.set(key, url);
    }
  }
  return { known, toMeasure };
}
