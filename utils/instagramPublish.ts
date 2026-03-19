import type { TravelFormData, GalleryItem } from '@/types/types';

type CountryOption = {
  country_id: string;
  title_ru: string;
  title_en?: string;
  title?: string;
  name?: string;
};

export type InstagramAccountOption = {
  key: string;
  label: string;
};

export type InstagramPublicationDraft = {
  caption: string;
  hashtags: string[];
  finalText: string;
  imageUrls: string[];
  countryLabels: string[];
  pointLabels: string[];
};

const DEFAULT_DESCRIPTION_FALLBACK = 'Новое путешествие на Metravel.';

const STOP_WORDS = new Set([
  'и', 'в', 'во', 'на', 'по', 'из', 'от', 'до', 'для', 'под', 'над', 'при', 'к', 'ко', 'с', 'со',
  'у', 'о', 'об', 'обо', 'а', 'но', 'или', 'не', 'за', 'the', 'a', 'an', 'of', 'in', 'on', 'at',
  'to', 'from', 'by', 'for', 'with', 'and', 'or',
]);

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

export const stripHtmlToInstagramCaption = (value?: string | null): string => {
  if (!value || typeof value !== 'string') return '';

  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
};

const normalizeMediaUrl = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  return '';
};

const getGalleryUrl = (item: GalleryItem): string => {
  if (typeof item === 'string') return normalizeMediaUrl(item);
  if (!item || typeof item !== 'object') return '';
  return normalizeMediaUrl(item.url);
};

const buildHashtagToken = (value: string): string => {
  const words = value
    .normalize('NFKC')
    .split(/[^\p{L}\p{N}]+/u)
    .map((word) => word.trim().toLowerCase())
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));

  if (words.length === 0) return '';
  return words.slice(0, 3).join('');
};

const unique = <T,>(values: T[]): T[] => Array.from(new Set(values));

const getCountryLabel = (countryId: string, countries: CountryOption[]): string => {
  const match = countries.find((country) => String(country.country_id) === String(countryId));
  if (!match) return '';
  return String(match.title_ru || match.title_en || match.title || match.name || '').trim();
};

const getPointLabel = (point: unknown): string => {
  if (!point || typeof point !== 'object') return '';
  const record = point as Record<string, unknown>;
  return String(
    record.address ??
      record.title ??
      record.name ??
      record.description ??
      ''
  ).trim();
};

export const getInstagramAccountOptions = (raw: string | undefined): InstagramAccountOption[] => {
  const source = String(raw || '').trim();
  if (!source) return [];

  try {
    const parsed = JSON.parse(source) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const record = item as Record<string, unknown>;
          const key = String(record.key ?? '').trim();
          const label = String(record.label ?? record.username ?? key).trim();
          if (!key || !label) return null;
          return { key, label };
        })
        .filter((item): item is InstagramAccountOption => Boolean(item));
    }
  } catch {
    // Fallback to compact string format: "metravelby:@metravelby,alt:@alt"
  }

  return source
    .split(',')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [rawKey, rawLabel] = chunk.split(':').map((part) => part.trim());
      const key = rawKey || '';
      const label = rawLabel || rawKey || '';
      if (!key || !label) return null;
      return { key, label };
    })
    .filter((item): item is InstagramAccountOption => Boolean(item));
};

export const buildInstagramPublicationDraft = ({
  formData,
  countries = [],
}: {
  formData: TravelFormData;
  countries?: CountryOption[];
}): InstagramPublicationDraft => {
  const coverUrl = normalizeMediaUrl(formData.travel_image_thumb_small_url ?? formData.travel_image_thumb_url ?? '');
  const galleryUrls = Array.isArray(formData.gallery) ? formData.gallery.map(getGalleryUrl).filter(Boolean) : [];
  const imageUrls = unique([coverUrl, ...galleryUrls].filter(Boolean));

  const countryLabels = unique(
    (Array.isArray(formData.countries) ? formData.countries : [])
      .map((countryId) => getCountryLabel(String(countryId), countries))
      .filter(Boolean)
  );

  const pointLabels = unique(
    (Array.isArray(formData.coordsMeTravel) ? formData.coordsMeTravel : [])
      .map(getPointLabel)
      .filter(Boolean)
  );

  const hashtagTokens = unique([
    'metravelby',
    ...countryLabels.map(buildHashtagToken),
    ...pointLabels.map(buildHashtagToken),
  ]).filter(Boolean);

  const hashtags = hashtagTokens.slice(0, 15).map((token) => `#${token}`);
  const caption = stripHtmlToInstagramCaption(formData.description) || formData.name?.trim() || DEFAULT_DESCRIPTION_FALLBACK;
  const finalText = [caption, hashtags.join(' ')].filter(Boolean).join('\n\n').trim();

  return {
    caption,
    hashtags,
    finalText,
    imageUrls,
    countryLabels,
    pointLabels,
  };
};
