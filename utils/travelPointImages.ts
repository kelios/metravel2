import { normalizeMediaUrl } from './mediaUrl';

const EMPTY_IMAGE_VALUES = new Set(['null', 'undefined']);
const SYSTEM_FALLBACK_IMAGE_PATH = '/og-default.png';

const getImagePathname = (url: string) => {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return url.split('?')[0].toLowerCase();
  }
};

export const getTravelPointImageUrl = (image?: string | null) => {
  if (typeof image !== 'string') return '';

  const value = image.trim();
  if (!value || EMPTY_IMAGE_VALUES.has(value.toLowerCase())) return '';

  const normalized = normalizeMediaUrl(value).trim();
  if (!normalized) return '';

  return getImagePathname(normalized).endsWith(SYSTEM_FALLBACK_IMAGE_PATH)
    ? ''
    : normalized;
};
