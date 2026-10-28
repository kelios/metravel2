import type { CacheShareOptions, CacheWriteOptions } from './fileTransfer.types';

/**
 * Web-резолв file-transfer. Нативный SDK сюда не импортируется: Metro и
 * web-граф берут этот файл вместо `fileTransfer.native.ts`.
 */
const unsupportedOnWeb = (): never => {
  throw new Error('');
};

export function cacheDirectory(): string | null {
  return null;
}

export function pathsCacheUri(): string {
  return '';
}

export function resolveCacheDirectory(pathsFallback = false): string {
  const primary = cacheDirectory();
  if (primary != null) return primary;
  return pathsFallback ? pathsCacheUri() : '';
}

export async function writeAsStringAsync(
  _uri: string,
  _contents: string,
  _options?: CacheWriteOptions,
): Promise<void> {
  unsupportedOnWeb();
}

export async function readAsStringAsync(_uri: string): Promise<string> {
  return unsupportedOnWeb();
}

export async function isShareAvailable(): Promise<boolean> {
  return false;
}

export async function shareAsync(_uri: string, _options: CacheShareOptions = {}): Promise<void> {
  unsupportedOnWeb();
}

export async function deleteAsync(
  _uri: string,
  _options?: { idempotent?: boolean },
): Promise<void> {
  unsupportedOnWeb();
}

export async function downloadAsync(_url: string, _fileUri: string): Promise<{ uri: string }> {
  return unsupportedOnWeb();
}

export async function readUriAsText(uri: string): Promise<string> {
  const safeUri = String(uri ?? '');
  if (!safeUri) return '';
  if (/^(blob:|data:|https?:)/i.test(safeUri)) {
    const response = await fetch(safeUri);
    return await response.text();
  }
  return unsupportedOnWeb();
}

export async function shareRemoteImageOnNative(
  _rawUrl: string,
  _fileName: string,
  _dialogTitle: string,
): Promise<boolean> {
  return false;
}
