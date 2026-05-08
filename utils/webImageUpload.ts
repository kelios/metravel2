const HEIC_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

const HEIC_EXTENSIONS = ['.heic', '.heif', '.heics', '.heifs'];

function replaceImageExtension(name: string, nextExtension: string): string {
  const trimmed = String(name || '').trim();
  if (!trimmed) return `image${nextExtension}`;
  return trimmed.replace(/\.[^.]+$/u, nextExtension) === trimmed
    ? `${trimmed}${nextExtension}`
    : trimmed.replace(/\.[^.]+$/u, nextExtension);
}

export function isHeicLikeFile(file: File): boolean {
  const normalizedType = String(file?.type || '').trim().toLowerCase();
  if (HEIC_MIME_TYPES.has(normalizedType)) return true;

  const normalizedName = String(file?.name || '').trim().toLowerCase();
  return HEIC_EXTENSIONS.some((extension) => normalizedName.endsWith(extension));
}

export async function prepareWebImageFileForUpload(file: File): Promise<File> {
  if (typeof File === 'undefined' || !(file instanceof File)) return file;
  if (!isHeicLikeFile(file)) return file;

  const heic2anyModule: any = await import('heic2any');
  const heic2any =
    typeof heic2anyModule?.default === 'function'
      ? heic2anyModule.default
      : heic2anyModule;

  if (typeof heic2any !== 'function') {
    throw new Error('HEIC conversion is unavailable');
  }

  const converted = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.92,
  });

  const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
  if (!(convertedBlob instanceof Blob)) {
    throw new Error('HEIC conversion failed');
  }

  return new File([convertedBlob], replaceImageExtension(file.name, '.jpg'), {
    type: 'image/jpeg',
    lastModified: file.lastModified || Date.now(),
  });
}
