export function validateYoutubeId(id: string): boolean {
  if (!id || id.length !== 11) {
    return false;
  }

  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return false;
  }

  return !/[_-]{2,}/.test(id);
}

export function safeGetYoutubeId(url?: string | null): string | null {
  if (!url) return null;

  if (url.length > 2000) {
    return null;
  }

  try {
    const controlCharRegex = /[\x00-\x1f\x7f]/g; // eslint-disable-line no-control-regex
    const sanitizedUrl = url.replace(controlCharRegex, '');

    const patterns = [
      /(?:youtu\.be\/|shorts\/|embed\/|watch\?v=|watch\?.*?v%3D)([^?&/#]+)/,
      /youtube\.com\/.*?[?&]v=([^?&#]+)/,
    ];

    for (const pattern of patterns) {
      const match = sanitizedUrl.match(pattern);
      const id = match?.[1] ?? null;

      if (id && validateYoutubeId(id)) {
        return id;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function createSafeImageUrl(
  baseUrl?: string,
  updatedAt?: string | null,
  id?: any
): string {
  if (!baseUrl) {
    return "";
  }

  if (baseUrl.includes('..') || baseUrl.includes('//..')) {
    return "";
  }

  try {
    const url = new URL(baseUrl);
    try {
      const isLocalhost =
        typeof window !== 'undefined' &&
        /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
      const isPrivateIp = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(url.hostname);
      if (isLocalhost && isPrivateIp) {
        if (url.protocol === 'https:') url.protocol = 'http:';
      } else if (url.protocol === 'http:') {
        url.protocol = 'https:';
      }
    } catch {
      // ignore hostname normalization failures
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      return "";
    }

    const ver = updatedAt
      ? Date.parse(updatedAt)
      : id && Number.isFinite(Number(id))
        ? Number(id)
        : 0;

    if (ver && Number.isFinite(ver) && ver > 0) {
      url.searchParams.append("v", String(ver));
    }

    return url.toString();
  } catch {
    return "";
  }
}
