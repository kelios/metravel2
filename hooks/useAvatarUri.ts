import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

type UseAvatarUriOptions = {
  userAvatar: string | null | undefined;
  profileRefreshToken?: string | number;
};

type UseAvatarUriResult = {
  avatarUri: string | null;
  avatarLoadError: boolean;
  setAvatarLoadError: (error: boolean) => void;
};

const FIRST_PARTY_AVATAR_HOSTS = new Set([
  'metravel.by',
  'www.metravel.by',
  'api.metravel.by',
  'cdn.metravel.by',
]);

// Session cache of avatar URLs that already returned an error (typically a 404
// from a missing file on the backend). Keyed by the URL *without* the cache-bust
// `?v=` param, so once a base URL fails we stop re-requesting it on every
// profileRefreshToken bump and from every avatar component — the fallback icon
// is shown immediately instead of spamming the network/console with retries.
const failedAvatarUrls = new Set<string>();

const stripCacheBust = (url: string): string => {
  const idx = url.indexOf('?');
  return idx === -1 ? url : url.slice(0, idx);
};

export const markAvatarUrlFailed = (url: string | null | undefined): void => {
  const base = stripCacheBust(String(url ?? '').trim());
  if (base) failedAvatarUrls.add(base);
};

export const isAvatarUrlFailed = (url: string | null | undefined): boolean => {
  const base = stripCacheBust(String(url ?? '').trim());
  return base ? failedAvatarUrls.has(base) : false;
};

// Test-only: reset the session cache between cases.
export const __resetFailedAvatarUrls = (): void => {
  failedAvatarUrls.clear();
};

const isFirstPartyAvatarUrl = (value: string): boolean => {
  if (!value) return false;
  if (value.startsWith('/')) return true;

  try {
    const parsed = new URL(value);
    const host = String(parsed.hostname || '').trim().toLowerCase();
    if (!host) return false;
    if (FIRST_PARTY_AVATAR_HOSTS.has(host)) return true;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const currentHost = String(window.location.hostname || '').trim().toLowerCase();
      if (host === currentHost) return true;
    }

    const apiBase = String(process.env.EXPO_PUBLIC_API_URL || '').trim();
    if (apiBase) {
      const apiHost = new URL(apiBase).hostname.trim().toLowerCase();
      if (host === apiHost) return true;
    }
  } catch {
    return false;
  }

  return false;
};

/**
 * Shared hook for avatar URI normalization and error handling.
 * Used across AccountMenu, DesktopAccountSection, MobileAccountSection.
 */
export function useAvatarUri({
  userAvatar,
  profileRefreshToken,
}: UseAvatarUriOptions): UseAvatarUriResult {
  const [avatarLoadError, setAvatarLoadError] = useState(false);

  useEffect(() => {
    setAvatarLoadError(false);
  }, [profileRefreshToken, userAvatar]);

  // Base URL (without the ?v= cache-bust) used both as the failure-cache key
  // and as the value reported to markAvatarUrlFailed when the image errors.
  const normalizedBase = useMemo(() => {
    const raw = String(userAvatar ?? '').trim();
    if (!raw) return null;

    const lower = raw.toLowerCase();
    if (lower === 'null' || lower === 'undefined') return null;

    if (raw.startsWith('/')) {
      const base = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/?api\/?$/, '');
      if (base) return `${base}${raw}`;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        return `${window.location.origin}${raw}`;
      }
    }

    return raw;
  }, [userAvatar]);

  const normalizedBaseRef = useRef<string | null>(null);
  normalizedBaseRef.current = normalizedBase;

  // Records the failing URL in the session cache so it is not re-requested, then
  // flips local error state to show the fallback.
  const handleAvatarError = useCallback((error: boolean) => {
    if (error && normalizedBaseRef.current) {
      markAvatarUrlFailed(normalizedBaseRef.current);
    }
    setAvatarLoadError(error);
  }, []);

  const avatarUri = useMemo(() => {
    if (avatarLoadError) return null;
    if (!normalizedBase) return null;
    // Known-bad URL from a previous render/component: skip the request entirely.
    if (isAvatarUrlFailed(normalizedBase)) return null;

    // Skip cache busting for signed URLs (AWS S3) and third-party hosts.
    if (
      normalizedBase.includes('X-Amz-') ||
      normalizedBase.includes('x-amz-') ||
      !isFirstPartyAvatarUrl(normalizedBase)
    ) {
      return normalizedBase;
    }

    const separator = normalizedBase.includes('?') ? '&' : '?';
    return `${normalizedBase}${separator}v=${profileRefreshToken}`;
  }, [avatarLoadError, normalizedBase, profileRefreshToken]);

  return { avatarUri, avatarLoadError, setAvatarLoadError: handleAvatarError };
}

export default useAvatarUri;
