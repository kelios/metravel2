const isPrivateOrLocalHost = (host: string): boolean => {
  const normalized = String(host || '').trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === 'localhost' || normalized === '127.0.0.1') return true;
  if (/^10\./.test(normalized)) return true;
  if (/^192\.168\./.test(normalized)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) return true;
  return false;
};

const shouldUpgradeAbsoluteUrlToHttps = (parsed: URL): boolean => {
  const host = String(parsed.hostname || '').trim().toLowerCase();
  if (!host || isPrivateOrLocalHost(host)) return false;
  if (host === 'metravel.by' || host.endsWith('.metravel.by')) return true;

  try {
    if (
      typeof window !== 'undefined' &&
      window.location?.protocol === 'https:' &&
      window.location.hostname &&
      host === String(window.location.hostname).trim().toLowerCase()
    ) {
      return true;
    }
  } catch {
    // noop
  }

  try {
    const apiBase = String(process.env.EXPO_PUBLIC_API_URL || '').trim();
    if (!apiBase) return false;
    const apiUrl = new URL(apiBase);
    return apiUrl.protocol === 'https:' && host === String(apiUrl.hostname || '').trim().toLowerCase();
  } catch {
    return false;
  }
};

export const normalizeAbsoluteMediaUrl = (url: string): string => {
  let result = url.trim();
  const lower = result.toLowerCase();
  let didFixDoubleHost = false;

  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    const secondHttp = lower.indexOf('http://', 1);
    const secondHttps = lower.indexOf('https://', 1);
    const secondProtocolIndex = [secondHttp, secondHttps]
      .filter((index) => index > 0)
      .sort((a, b) => a - b)[0];

    if (typeof secondProtocolIndex === 'number') {
      const protocolEnd = lower.indexOf('://') + 3;
      const firstSlashAfterHost = lower.indexOf('/', protocolEnd);
      if (firstSlashAfterHost === -1 || secondProtocolIndex < firstSlashAfterHost) {
        result = result.slice(secondProtocolIndex);
        didFixDoubleHost = true;
      }
    }
  }

  if (didFixDoubleHost && result.includes('.s3.amazonaws.com/') && result.includes('X-Amz-Signature=')) {
    const urlObj = new URL(result);
    urlObj.searchParams.delete('X-Amz-Algorithm');
    urlObj.searchParams.delete('X-Amz-Credential');
    urlObj.searchParams.delete('X-Amz-Date');
    urlObj.searchParams.delete('X-Amz-Expires');
    urlObj.searchParams.delete('X-Amz-SignedHeaders');
    urlObj.searchParams.delete('X-Amz-Signature');
    result = urlObj.toString();
  }

  if (/^http:\/\//i.test(result)) {
    try {
      const parsed = new URL(result);
      if (shouldUpgradeAbsoluteUrlToHttps(parsed)) {
        parsed.protocol = 'https:';
        result = parsed.toString();
      }
    } catch {
      return result;
    }
  }

  return result;
};

export const normalizeMediaUrl = (url?: string | null): string => {
  if (!url || !String(url).trim()) return '';
  const safeUrl = normalizeAbsoluteMediaUrl(String(url).trim());

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
