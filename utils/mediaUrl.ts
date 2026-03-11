const normalizeBrokenAbsoluteMediaUrl = (url: string): string => {
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

  return result;
};

export const normalizeMediaUrl = (url?: string | null): string => {
  if (!url || !String(url).trim()) return '';
  const safeUrl = normalizeBrokenAbsoluteMediaUrl(String(url).trim());

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
