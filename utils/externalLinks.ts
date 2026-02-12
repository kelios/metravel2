import { Linking } from 'react-native';
import { getSafeExternalUrl } from '@/utils/safeExternalUrl';

type OpenExternalUrlOptions = {
  allowRelative?: boolean;
  allowProtocolRelative?: boolean;
  baseUrl?: string;
  allowedProtocols?: string[];
  onError?: (error: unknown) => void;
};

export function normalizeExternalUrl(rawUrl: string): string {
  return getSafeExternalUrl(rawUrl, {
    allowRelative: false,
    allowProtocolRelative: false,
  });
}

export async function openExternalUrl(rawUrl: string, options: OpenExternalUrlOptions = {}): Promise<boolean> {
  const normalized = getSafeExternalUrl(rawUrl, {
    allowRelative: options.allowRelative ?? false,
    allowProtocolRelative: options.allowProtocolRelative ?? false,
    baseUrl: options.baseUrl ?? '',
    allowedProtocols: options.allowedProtocols,
  });
  if (!normalized) return false;
  try {
    await Linking.openURL(normalized);
    return true;
  } catch (error) {
    options.onError?.(error);
    return false;
  }
}
