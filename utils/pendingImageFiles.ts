// Web-only helper for keeping selected image Files until we can upload them.
// Keyed by their `blob:` preview URL.

type PendingImageEntry = { file: File; owner?: Set<string> };
const pendingByBlobUrl = new Map<string, PendingImageEntry>();

export function registerPendingImageFile(blobUrl: string, file: File, owner?: Set<string>): void {
  if (!blobUrl || typeof blobUrl !== 'string') return;
  if (!/^(blob:)/i.test(blobUrl)) return;
  if (typeof file === 'undefined' || file == null) return;
  pendingByBlobUrl.get(blobUrl)?.owner?.delete(blobUrl);
  pendingByBlobUrl.set(blobUrl, { file, owner });
  owner?.add(blobUrl);
}

export function getPendingImageFile(blobUrl: string): File | null {
  if (!blobUrl || typeof blobUrl !== 'string') return null;
  return pendingByBlobUrl.get(blobUrl)?.file ?? null;
}

export function removePendingImageFile(blobUrl: string): void {
  if (!blobUrl || typeof blobUrl !== 'string') return;
  pendingByBlobUrl.get(blobUrl)?.owner?.delete(blobUrl);
  pendingByBlobUrl.delete(blobUrl);
}

export function releasePendingImageFile(blobUrl: string): void {
  removePendingImageFile(blobUrl);
  globalThis.URL?.revokeObjectURL?.(blobUrl);
}

export function hasPendingPointPhotos(markers: unknown): boolean {
  return Array.isArray(markers) && markers.some(
    (marker) => typeof marker?.image === 'string' && getPendingImageFile(marker.image.trim()) !== null,
  );
}

export function createPendingImageSession() {
  const urls = new Set<string>();
  let work: AbortController | undefined;
  return {
    urls,
    startWork() {
      if (!work || work.signal.aborted) work = new AbortController();
      return work.signal;
    },
    dispose() {
      work?.abort();
      for (const url of urls) releasePendingImageFile(url);
    },
  };
}
