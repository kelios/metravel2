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
  suggestedLabels: string[];
};

const DEFAULT_DESCRIPTION_FALLBACK = 'Новое путешествие на Metravel.';
export const INSTAGRAM_CAPTION_MAX_LENGTH = 2200;
export const INSTAGRAM_HASHTAG_MAX_COUNT = 30;

const STOP_WORDS = new Set([
  'и', 'в', 'во', 'на', 'по', 'из', 'от', 'до', 'для', 'под', 'над', 'при', 'к', 'ко', 'с', 'со',
  'у', 'о', 'об', 'обо', 'а', 'но', 'или', 'не', 'за', 'the', 'a', 'an', 'of', 'in', 'on', 'at',
  'to', 'from', 'by', 'for', 'with', 'and', 'or',
]);

const ADMINISTRATIVE_WORDS = new Set([
  'польша', 'польске', 'polska', 'poland',
  'малопольское', 'малопольскоевоеводство', 'малопольша',
  'małopolskie', 'malopolskie', 'województwo', 'wojewodztwo',
  'область', 'район', 'powiat', 'gmina', 'voivodeship',
]);

const SERVICE_WORDS = new Set([
  'inpost', 'paczkomat', 'parking', 'парковка', 'lotnisko', 'аэропорт',
  'airport', 'stacja', 'station', 'остановка', 'przystanek', 'hotel',
  'restauracja', 'restaurant', 'sklep', 'магазин',
]);

const POI_HINT_WORDS = new Set([
  'jaskinia', 'пещера', 'dolina', 'долина', 'zamek', 'замок',
  'skałki', 'skalki', 'скалки', 'kaplica', 'каплица', 'most', 'мост',
  'rezerwat', 'заповедник', 'rodnik', 'родник',
]);

const PRIORITY_TEXT_PATTERNS: RegExp[] = [
  /\bjaskinia\s+na\s+łopiankach\b/iu,
  /\bdolina\s+mnikowska\b/iu,
  /\bmników\b/iu,
  /\bmnikiw\b/iu,
  /\bskałki\b/iu,
  /krak[oó]w[a]?/iu,
  /краков[а]?/iu,
];

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

const tokenizeHashtagSource = (value: string): string[] =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((word) => word.trim())
    .filter(Boolean);

const buildHashtagToken = (value: string): string => {
  const words = tokenizeHashtagSource(value)
    .filter((word) => !/\d/.test(word))
    .filter((word) => word.length >= 2)
    .filter((word) => !STOP_WORDS.has(word) && !ADMINISTRATIVE_WORDS.has(word) && !SERVICE_WORDS.has(word));

  if (words.length === 0) return '';
  return words.slice(0, 3).join('');
};

const buildCountryHashtagToken = (value: string): string => {
  const words = tokenizeHashtagSource(value)
    .filter((word) => !/\d/.test(word))
    .filter((word) => word.length >= 2)
    .filter((word) => !STOP_WORDS.has(word) && !SERVICE_WORDS.has(word));

  if (words.length === 0) return '';
  return words.slice(0, 2).join('');
};

const unique = <T,>(values: T[]): T[] => Array.from(new Set(values));

const normalizeLabelSpacing = (value: string): string => value.replace(/\s{2,}/g, ' ').trim();

const getCountryLabel = (countryId: string, countries: CountryOption[]): string => {
  const match = countries.find((country) => String(country.country_id) === String(countryId));
  if (!match) return '';
  return String(match.title_ru || match.title_en || match.title || match.name || '').trim();
};

const getPointLabel = (point: unknown): string => {
  if (!point || typeof point !== 'object') return '';
  const record = point as Record<string, unknown>;
  const raw = String(
    record.address ??
      record.title ??
      record.name ??
      record.description ??
      ''
  ).trim();
  if (!raw) return '';

  const firstSegment = raw.split(/[|,;/()]/)[0]?.trim() || raw;
  const rawTokens = tokenizeHashtagSource(firstSegment);
  if (rawTokens.length === 0) return '';

  const hasPoiHint = rawTokens.some((token) => POI_HINT_WORDS.has(token));
  const hasServiceWord = rawTokens.some((token) => SERVICE_WORDS.has(token));
  if (hasServiceWord && !hasPoiHint) return '';

  const cleanedTokens = rawTokens
    .filter((token) => !/\d/.test(token))
    .filter((token) => token.length >= 3)
    .filter((token) => !STOP_WORDS.has(token))
    .filter((token) => !ADMINISTRATIVE_WORDS.has(token))
    .filter((token) => !SERVICE_WORDS.has(token));

  if (cleanedTokens.length === 0) return '';

  const maxWords = hasPoiHint ? 2 : 1;
  return normalizeLabelSpacing(cleanedTokens.slice(0, maxWords).join(' '));
};

const extractPriorityLabelsFromText = (value: string): string[] => {
  const source = normalizeLabelSpacing(value);
  if (!source) return [];

  return PRIORITY_TEXT_PATTERNS
    .map((pattern) => source.match(pattern)?.[0] ?? '')
    .map((match) => normalizeLabelSpacing(match))
    .filter(Boolean);
};

export const buildFinalInstagramText = (caption: string, hashtags: string[]): string =>
  [caption.trim(), hashtags.join(' ').trim()].filter(Boolean).join('\n\n').trim();

export const clampInstagramCaption = (
  caption: string,
  hashtags: string[],
  maxLength: number = INSTAGRAM_CAPTION_MAX_LENGTH
): string => {
  const normalizedCaption = caption.trim();
  const hashtagsText = hashtags.join(' ').trim();
  const separatorLength = normalizedCaption && hashtagsText ? 2 : 0;
  const availableCaptionLength = maxLength - hashtagsText.length - separatorLength;

  if (availableCaptionLength <= 0) return '';
  if (normalizedCaption.length <= availableCaptionLength) return normalizedCaption;

  const ellipsis = '…';
  const safeLength = Math.max(availableCaptionLength - ellipsis.length, 0);
  let nextCaption = normalizedCaption.slice(0, safeLength).trimEnd();

  const lastWhitespaceIndex = nextCaption.lastIndexOf(' ');
  if (lastWhitespaceIndex >= Math.floor(safeLength * 0.6)) {
    nextCaption = nextCaption.slice(0, lastWhitespaceIndex).trimEnd();
  }

  const withEllipsis = `${nextCaption}${ellipsis}`.trim();
  return withEllipsis.length <= availableCaptionLength
    ? withEllipsis
    : normalizedCaption.slice(0, availableCaptionLength).trimEnd();
};

export const parseInstagramHashtags = (value: string): string[] => {
  const rawTags = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.startsWith('#') ? part : `#${part}`))
    .map((part) => `#${part.slice(1).replace(/[^\p{L}\p{N}_]+/gu, '').toLowerCase()}`)
    .filter((part) => part.length > 1);

  const normalized = unique(['#metravelby', ...rawTags]);
  return normalized.slice(0, INSTAGRAM_HASHTAG_MAX_COUNT);
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
  const galleryUrls = Array.isArray(formData.gallery) ? formData.gallery.map(getGalleryUrl).filter(Boolean) : [];
  const imageUrls = unique(galleryUrls).slice(0, 10);

  const countryLabels = unique(
    (Array.isArray(formData.countries) ? formData.countries : [])
      .map((countryId) => getCountryLabel(String(countryId), countries))
      .filter(Boolean)
  );

  const pointLabels = unique(
    (Array.isArray(formData.coordsMeTravel) ? formData.coordsMeTravel : [])
      .map(getPointLabel)
      .filter(Boolean)
  ).slice(0, 4);

  const priorityLabels = extractPriorityLabelsFromText(
    [formData.name ?? '', stripHtmlToInstagramCaption(formData.description)].filter(Boolean).join(' ')
  );

  const suggestedLabels = unique([
    ...countryLabels,
    ...priorityLabels,
    ...pointLabels,
  ]);

  const hashtagTokens = unique([
    'metravelby',
    ...countryLabels.map(buildCountryHashtagToken),
    ...priorityLabels.map(buildHashtagToken),
    ...pointLabels.map(buildHashtagToken),
  ]).filter(Boolean);

  const hashtags = hashtagTokens.slice(0, INSTAGRAM_HASHTAG_MAX_COUNT).map((token) => `#${token}`);
  const rawCaption = stripHtmlToInstagramCaption(formData.description) || formData.name?.trim() || DEFAULT_DESCRIPTION_FALLBACK;
  const caption = clampInstagramCaption(rawCaption, hashtags);
  const finalText = buildFinalInstagramText(caption, hashtags);

  return {
    caption,
    hashtags,
    finalText,
    imageUrls,
    countryLabels,
    pointLabels,
    suggestedLabels,
  };
};
