import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { getSafeExternalUrl } from '@/utils/safeExternalUrl';
import type { CacheShareOptions, CacheWriteOptions } from './fileTransfer.types';

export function cacheDirectory(): string | null {
  return FileSystem.cacheDirectory ?? null;
}

export function pathsCacheUri(): string {
  const paths = (FileSystem as { Paths?: { cache?: { uri?: string } } }).Paths;
  return String(paths?.cache?.uri ?? '');
}

export function resolveCacheDirectory(pathsFallback = false): string {
  const primary = cacheDirectory();
  if (primary != null) return primary;
  return pathsFallback ? pathsCacheUri() : '';
}

export async function writeAsStringAsync(
  uri: string,
  contents: string,
  options?: CacheWriteOptions,
): Promise<void> {
  if (options?.encoding === 'base64') {
    await FileSystem.writeAsStringAsync(uri, contents, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return;
  }
  await FileSystem.writeAsStringAsync(uri, contents);
}

export async function readAsStringAsync(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
}

export async function isShareAvailable(): Promise<boolean> {
  return Sharing.isAvailableAsync();
}

export async function shareAsync(uri: string, options: CacheShareOptions = {}): Promise<void> {
  await Sharing.shareAsync(uri, options);
}

export async function deleteAsync(
  uri: string,
  options?: { idempotent?: boolean },
): Promise<void> {
  await FileSystem.deleteAsync(uri, options);
}

export async function downloadAsync(url: string, fileUri: string): Promise<{ uri: string }> {
  return FileSystem.downloadAsync(url, fileUri);
}

export async function readUriAsText(uri: string): Promise<string> {
  const safeUri = String(uri ?? '');
  if (!safeUri) return '';
  return readAsStringAsync(safeUri);
}

export async function shareRemoteImageOnNative(
  rawUrl: string,
  fileName: string,
  dialogTitle: string,
): Promise<boolean> {
  const imageUrl = getSafeExternalUrl(rawUrl, { allowRelative: false });
  if (!imageUrl) return false;

  const directory = cacheDirectory();
  if (!directory || !(await isShareAvailable())) return false;

  const fileUri = `${directory}${fileName}`;
  await deleteAsync(fileUri, { idempotent: true }).catch(() => undefined);
  const downloaded = await downloadAsync(imageUrl, fileUri);
  await shareAsync(downloaded.uri, {
    mimeType: 'image/png',
    dialogTitle,
  });
  return true;
}
