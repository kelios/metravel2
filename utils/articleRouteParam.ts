// Route identity stays independent of the article transport and offline cache.
export const normalizeArticleRouteParam = (value: string): string => {
  const trimmed = String(value || '').trim().split('#')[0].split('?')[0];
  if (!/%[0-9A-Fa-f]{2}/.test(trimmed)) return trimmed;
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
};

export const extractArticleIdFromParam = (value: string | null | undefined): number | null => {
  const normalized = normalizeArticleRouteParam(String(value || ''));
  if (!normalized) return null;

  const direct = Number(normalized);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const startMatch = normalized.match(/^(\d+)(?:-|$)/);
  if (startMatch?.[1]) {
    const parsed = Number(startMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const endMatch = normalized.match(/(?:^|[-_])(\d+)$/);
  if (endMatch?.[1]) {
    const parsed = Number(endMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
};

