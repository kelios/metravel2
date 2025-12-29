type SafeExternalUrlOptions = {
  allowRelative?: boolean;
  allowProtocolRelative?: boolean;
  baseUrl?: string;
  allowedProtocols?: string[];
};

const DEFAULT_PROTOCOLS = ['http:', 'https:'];
const BLOCKED_PREFIXES = ['javascript:', 'data:', 'vbscript:'];

const isBlockedScheme = (value: string) => {
  const lowered = value.toLowerCase();
  return BLOCKED_PREFIXES.some((prefix) => lowered.startsWith(prefix));
};

const isAllowedProtocol = (candidate: string, allowedProtocols: string[]) => {
  try {
    const url = new URL(candidate);
    return allowedProtocols.includes(url.protocol);
  } catch {
    return false;
  }
};

export const getSafeExternalUrl = (
  rawUrl?: string | null,
  {
    allowRelative = true,
    allowProtocolRelative = false,
    baseUrl = '',
    allowedProtocols = DEFAULT_PROTOCOLS,
  }: SafeExternalUrlOptions = {},
): string => {
  const trimmed = String(rawUrl ?? '').trim();
  if (!trimmed) return '';
  if (isBlockedScheme(trimmed)) return '';

  if (trimmed.startsWith('//')) {
    if (!allowProtocolRelative) return '';
    const normalized = `https:${trimmed}`;
    return isAllowedProtocol(normalized, allowedProtocols) ? normalized : '';
  }

  if (allowRelative && (/^\.\.?\//.test(trimmed) || trimmed.startsWith('/'))) {
    if (baseUrl) {
      try {
        return new URL(trimmed, baseUrl).toString();
      } catch {
        return '';
      }
    }
    return trimmed;
  }

  if (isAllowedProtocol(trimmed, allowedProtocols)) {
    return new URL(trimmed).toString();
  }

  const withHttps = `https://${trimmed}`;
  return isAllowedProtocol(withHttps, allowedProtocols) ? new URL(withHttps).toString() : '';
};

export const isSafeExternalUrl = (rawUrl?: string | null, options?: SafeExternalUrlOptions): boolean =>
  Boolean(getSafeExternalUrl(rawUrl, options));
