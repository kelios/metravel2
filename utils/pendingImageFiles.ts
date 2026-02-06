// Web-only helper for keeping selected image Files until we can upload them.
// Keyed by their `blob:` preview URL.

const pendingByBlobUrl = new Map<string, File>();

export function registerPendingImageFile(blobUrl: string, file: File): void {
  if (!blobUrl || typeof blobUrl !== 'string') return;
  if (!/^(blob:)/i.test(blobUrl)) return;
  if (typeof file === 'undefined' || file == null) return;
  pendingByBlobUrl.set(blobUrl, file);
}

export function getPendingImageFile(blobUrl: string): File | null {
  if (!blobUrl || typeof blobUrl !== 'string') return null;
  return pendingByBlobUrl.get(blobUrl) ?? null;
}

export function removePendingImageFile(blobUrl: string): void {
  if (!blobUrl || typeof blobUrl !== 'string') return;
  pendingByBlobUrl.delete(blobUrl);
}

