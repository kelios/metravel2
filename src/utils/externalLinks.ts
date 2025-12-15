import { Linking } from 'react-native';

export function normalizeExternalUrl(rawUrl: string): string {
  const url = String(rawUrl ?? '').trim();
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export async function openExternalUrl(rawUrl: string): Promise<void> {
  const normalized = normalizeExternalUrl(rawUrl);
  if (!normalized) return;
  try {
    await Linking.openURL(normalized);
  } catch {
    // noop
  }
}
