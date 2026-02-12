import { Linking, Platform } from 'react-native';
import { getSafeExternalUrl } from '@/utils/safeExternalUrl';

type OpenExternalUrlOptions = {
  allowRelative?: boolean;
  allowProtocolRelative?: boolean;
  baseUrl?: string;
  allowedProtocols?: string[];
  onError?: (error: unknown) => void;
};

type OpenExternalUrlInNewTabOptions = OpenExternalUrlOptions & {
  windowFeatures?: string;
};

type OpenWebWindowOptions = {
  target?: string;
  windowFeatures?: string;
  onError?: (error: unknown) => void;
};

const resolveNormalizedUrl = (rawUrl: string, options: OpenExternalUrlOptions): string =>
  getSafeExternalUrl(rawUrl, {
    allowRelative: options.allowRelative ?? false,
    allowProtocolRelative: options.allowProtocolRelative ?? false,
    baseUrl: options.baseUrl ?? '',
    allowedProtocols: options.allowedProtocols,
  });

export function normalizeExternalUrl(rawUrl: string): string {
  return resolveNormalizedUrl(rawUrl, {
    allowRelative: false,
    allowProtocolRelative: false,
  });
}

export async function openExternalUrl(rawUrl: string, options: OpenExternalUrlOptions = {}): Promise<boolean> {
  const normalized = resolveNormalizedUrl(rawUrl, options);
  if (!normalized) return false;
  try {
    await Linking.openURL(normalized);
    return true;
  } catch (error) {
    options.onError?.(error);
    return false;
  }
}

export async function openExternalUrlInNewTab(
  rawUrl: string,
  options: OpenExternalUrlInNewTabOptions = {},
): Promise<boolean> {
  const normalized = resolveNormalizedUrl(rawUrl, options);
  if (!normalized) return false;

  if (Platform.OS === 'web') {
    const openedWindow = openWebWindow(normalized, {
      target: '_blank',
      windowFeatures: options.windowFeatures ?? 'noopener,noreferrer',
      onError: options.onError,
    });
    return Boolean(openedWindow);
  }

  try {
    await Linking.openURL(normalized);
    return true;
  } catch (error) {
    options.onError?.(error);
    return false;
  }
}

export function openWebWindow(rawUrl: string, options: OpenWebWindowOptions = {}): Window | null {
  if (typeof window === 'undefined' || typeof window.open !== 'function') return null;
  try {
    const openedWindow = window.open(rawUrl, options.target ?? '_blank', options.windowFeatures ?? 'noopener,noreferrer');
    if (!openedWindow) return null;
    try {
      openedWindow.opener = null;
    } catch {
      // noop
    }
    return openedWindow;
  } catch (error) {
    options.onError?.(error);
    return null;
  }
}
