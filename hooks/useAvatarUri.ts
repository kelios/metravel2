import { useMemo, useState, useEffect } from 'react';
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

  const avatarUri = useMemo(() => {
    if (avatarLoadError) return null;

    const raw = String(userAvatar ?? '').trim();
    if (!raw) return null;

    const lower = raw.toLowerCase();
    if (lower === 'null' || lower === 'undefined') return null;

    let normalized = raw;

    if (raw.startsWith('/')) {
      const base = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/?api\/?$/, '');
      if (base) {
        normalized = `${base}${raw}`;
      } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
        normalized = `${window.location.origin}${raw}`;
      }
    }

    // Skip cache busting for signed URLs (AWS S3) and third-party hosts.
    if (
      normalized.includes('X-Amz-') ||
      normalized.includes('x-amz-') ||
      !isFirstPartyAvatarUrl(normalized)
    ) {
      return normalized;
    }

    const separator = normalized.includes('?') ? '&' : '?';
    return `${normalized}${separator}v=${profileRefreshToken}`;
  }, [avatarLoadError, userAvatar, profileRefreshToken]);

  return { avatarUri, avatarLoadError, setAvatarLoadError };
}

export default useAvatarUri;
