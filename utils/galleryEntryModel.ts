// Доменная модель записи галереи путешествия: чтение id/url/подписи из
// «сырой» записи (строка-URL или объект) и слияние сохранённой галереи с
// текущими подписями пользователя. Чистые функции, извлечены из
// useTravelFormPersistence без изменения поведения.

export type GalleryEntry = string | Record<string, unknown>;

export const getGalleryEntryId = (item: GalleryEntry | null | undefined) => {
  if (!item || typeof item !== 'object') return null;
  const rawId = item.id;
  if (rawId == null || String(rawId).trim().length === 0) return null;
  return String(rawId);
};

export const getGalleryEntryUrl = (item: GalleryEntry | null | undefined) => {
  if (typeof item === 'string') return item.trim();
  if (!item || typeof item !== 'object') return '';
  return typeof item.url === 'string' ? item.url.trim() : '';
};

export const getGalleryEntryCaption = (item: GalleryEntry | null | undefined) => {
  if (!item || typeof item !== 'object') return undefined;
  return typeof item.caption === 'string' ? item.caption : undefined;
};

export const buildGalleryEntryMap = (gallery: unknown) => {
  const byId = new Map<string, GalleryEntry>();
  const byUrl = new Map<string, GalleryEntry>();
  if (!Array.isArray(gallery)) return { byId, byUrl };

  gallery.forEach((item) => {
    if (typeof item !== 'string' && (typeof item !== 'object' || item == null)) return;
    const entry = item as GalleryEntry;
    const id = getGalleryEntryId(entry);
    const url = getGalleryEntryUrl(entry);
    if (id) byId.set(id, entry);
    if (url) byUrl.set(url, entry);
  });

  return { byId, byUrl };
};

export const findMatchingGalleryEntry = (
  item: GalleryEntry,
  map: ReturnType<typeof buildGalleryEntryMap>,
) => {
  const id = getGalleryEntryId(item);
  if (id && map.byId.has(id)) return map.byId.get(id);

  const url = getGalleryEntryUrl(item);
  if (url && map.byUrl.has(url)) return map.byUrl.get(url);

  return undefined;
};

export function mergeGalleryPreserveCurrentCaptions(
  savedGallery: unknown,
  currentGallery: unknown,
  sourceGallery?: unknown,
) {
  if (!Array.isArray(savedGallery)) return savedGallery;

  const currentMap = buildGalleryEntryMap(currentGallery);
  const sourceMap = buildGalleryEntryMap(sourceGallery);

  return savedGallery.map((item) => {
    if (!item || typeof item !== 'object') return item;

    const savedEntry = item as Record<string, unknown>;
    const currentEntry = findMatchingGalleryEntry(savedEntry, currentMap);
    const currentCaption = getGalleryEntryCaption(currentEntry);
    if (currentCaption == null) return item;

    const savedCaption = getGalleryEntryCaption(savedEntry);
    if (savedCaption === currentCaption) return item;

    const sourceEntry = findMatchingGalleryEntry(savedEntry, sourceMap);
    const sourceCaption = getGalleryEntryCaption(sourceEntry);
    const savedCaptionMissing = savedCaption == null || savedCaption.trim().length === 0;
    const currentChangedAfterSaveStarted = sourceCaption !== currentCaption;
    const currentWasCleared = currentCaption.trim().length === 0;

    if (!savedCaptionMissing && !currentChangedAfterSaveStarted && !currentWasCleared) {
      return item;
    }

    return {
      ...savedEntry,
      caption: currentCaption.slice(0, 500),
    };
  });
}
