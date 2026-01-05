export const normalizeMediaUrl = (url?: string | null): string => {
  if (!url || !String(url).trim()) return '';
  const safeUrl = String(url).trim();

  // Data/blob stay as-is
  if (/^(data:|blob:)/i.test(safeUrl)) return safeUrl;

  // Absolute URLs stay as-is.
  if (/^https?:\/\//i.test(safeUrl)) return safeUrl;

  // Relative URLs: prefix with backend host (without /api)
  const baseRaw =
    process.env.EXPO_PUBLIC_API_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  const hostWithoutApi = baseRaw.replace(/\/+$/, '').replace(/\/api$/i, '');
  const prefix = hostWithoutApi || baseRaw.replace(/\/+$/, '');

  if (prefix) {
    return `${prefix}${safeUrl.startsWith('/') ? '' : '/'}${safeUrl}`;
  }

  return safeUrl;
};
