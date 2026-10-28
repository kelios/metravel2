export interface CompressOptions {
  /** Max dimension for the largest side. Default: 1920 */
  maxDimension?: number;
  /** JPEG compression quality (0–1). Default: 0.8 */
  quality?: number;
  /** Force square crop (for avatars) */
  squareCrop?: boolean;
}

export interface CompressResult {
  uri: string;
  width: number;
  height: number;
}
