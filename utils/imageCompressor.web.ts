import type { CompressOptions, CompressResult } from './imageCompressor.types';
export type { CompressOptions, CompressResult } from './imageCompressor.types';

/** Web uploads retain the original URI; native image manipulation stays out of the web graph. */
export async function compressImage(
  uri: string,
  _options: CompressOptions = {},
): Promise<CompressResult> {
  return { uri, width: 0, height: 0 };
}

export async function compressAvatar(uri: string): Promise<CompressResult> {
  return compressImage(uri);
}

export async function compressTravelPhoto(uri: string): Promise<CompressResult> {
  return compressImage(uri);
}
