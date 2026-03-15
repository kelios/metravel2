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

    // Skip cache busting for signed URLs (AWS S3)
    if (normalized.includes('X-Amz-') || normalized.includes('x-amz-')) {
      return normalized;
    }

    const separator = normalized.includes('?') ? '&' : '?';
    return `${normalized}${separator}v=${profileRefreshToken}`;
  }, [avatarLoadError, userAvatar, profileRefreshToken]);

  return { avatarUri, avatarLoadError, setAvatarLoadError };
}

export default useAvatarUri;
