import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { TravelForBook } from '@/types/pdf-export';
import type { ArticlePdfModel } from '@/types/article-pdf';

export interface BookMeta {
  title: string;
  subtitle?: string;
  author?: string;
  period?: string;
  travelCount: number;
  generatedAt: string;
}

export interface BookPhoto {
  url: string;
  caption?: string;
  id?: number | string;
  updatedAt?: string;
}

export interface BookMapPoint {
  id: string | number;
  title?: string;
  address?: string;
  coord: string;
  thumbnailUrl?: string;
  categoryName?: string;
}

export interface BookTravel {
  id: number | string;
  title: string;
  country?: string | null;
  city?: string | null;
  year?: string | number | null;
  monthName?: string | null;
  days?: number | null;
  coverImage?: string | null;
  description?: string | null;
  recommendation?: string | null;
  pros?: string | null;
  cons?: string | null;
  gallery?: BookPhoto[];
  mapPoints?: BookMapPoint[];
  youtubeLink?: string | null;
  url?: string;
  slug?: string;
  userName?: string | null;
}

export interface BookQrData {
  url: string;
  label?: string;
}

export interface BookModel {
  meta: BookMeta;
  travels: BookTravel[];
  settings: BookSettings;
  qr?: BookQrData;
}

export function buildBookModelFromTravels(
  travels: TravelForBook[],
  settings: BookSettings
): BookModel {
  const travelItems: BookTravel[] = travels.map((t) => ({
    id: t.id,
    title: t.name,
    country: t.countryName ?? null,
    city: t.cityName ?? null,
    year: t.year ?? null,
    monthName: t.monthName ?? null,
    days: t.number_days ?? null,
    coverImage: t.travel_image_url || t.travel_image_thumb_url || null,
    description: t.description ?? null,
    recommendation: t.recommendation ?? null,
    pros: t.plus ?? null,
    cons: t.minus ?? null,
    youtubeLink: t.youtube_link ?? null,
    url: t.url,
    slug: t.slug,
    userName: t.userName ?? null,
    gallery: t.gallery?.map((g) => ({
      url: g.url,
      id: g.id,
      updatedAt: g.updated_at,
    })),
    mapPoints: t.travelAddress?.map((p) => ({
      id: p.id,
      title: p.categoryName,
      address: p.address,
      coord: p.coord,
      thumbnailUrl: p.travelImageThumbUrl,
      categoryName: p.categoryName,
    })),
  }));

  const years = travelItems
    .map((t) => (t.year != null ? Number(t.year) : NaN))
    .filter((y) => !Number.isNaN(y));

  const minYear = years.length ? Math.min(...years) : undefined;
  const maxYear = years.length ? Math.max(...years) : undefined;

  const yearRange =
    minYear && maxYear
      ? minYear === maxYear
        ? String(minYear)
        : `${minYear}${maxYear}`
      : undefined;

  const userName = travelItems[0]?.userName || 'Путешественник';

  return {
    meta: {
      title: settings.title,
      subtitle: settings.subtitle,
      author: userName || undefined,
      period: yearRange,
      travelCount: travelItems.length,
      generatedAt: new Date().toISOString(),
    },
    travels: travelItems,
    settings,
    qr: undefined,
  };
}

export function buildBookModelFromArticle(
  model: ArticlePdfModel,
  settings: BookSettings
): BookModel {
  const coverImage = model.coverImage?.url ?? null;

  const travel: BookTravel = {
    id: model.title,
    title: model.title,
    country: model.meta.country ?? null,
    city: model.meta.region ?? null,
    year: null,
    monthName: null,
    days: model.meta.days ?? null,
    coverImage,
    description: null,
    recommendation: null,
    pros: null,
    cons: null,
    gallery: model.gallery?.map((img) => ({
      url: img.url,
      caption: img.caption,
    })),
    mapPoints: model.map?.points?.map((p, index) => ({
      id: index,
      title: p.name,
      address: undefined,
      coord: `${p.lat},${p.lng}`,
      thumbnailUrl: model.map?.image.url,
      categoryName: undefined,
    })),
    youtubeLink: null,
    url: undefined,
    slug: undefined,
    userName: model.author ?? null,
  };

  const bookModel: BookModel = {
    meta: {
      title: settings.title || model.title,
      subtitle: settings.subtitle || model.subtitle,
      author: model.author,
      period: undefined,
      travelCount: 1,
      generatedAt: new Date().toISOString(),
    },
    travels: [travel],
    settings,
    qr: undefined,
  };

  return bookModel;
}
