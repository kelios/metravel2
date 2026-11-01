import {fetchVerifiedBookAsset} from './download';
import {assertBookPrintResource} from './printResources';
import type {BookMetadataDescriptor, PublishedBook} from './publication';

type ReadyBookSummaryCommon = Pick<PublishedBook,
  'id'|'slug'|'title'|'country'|'revision'|'contentLocale'|'status'|
  'coverUri'|'stopCount'|'bodyPageCount'|'profiles'|'missing'|'visualStyle'> & {
    metadata: BookMetadataDescriptor;
  };
export type ReadyBookSummary = ReadyBookSummaryCommon & (
  {kind: 'places'} |
  Pick<Extract<PublishedBook, {kind: 'quests'}>, 'kind'|'seriesId'|'volume'>
);

const loadedBooks = new Map<string, PublishedBook>();
const abortIfNeeded = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
};

/** Only the pinned, build-validated metadata for this exact edition may enter the viewer. */
export async function loadReadyBookMetadata(summary: ReadyBookSummary, signal?: AbortSignal): Promise<PublishedBook> {
  abortIfNeeded(signal);
  const asset = summary.metadata;
  assertBookPrintResource(summary, asset);
  if (asset.kind !== 'book-metadata' || asset.bookId !== summary.id || asset.revision !== summary.revision ||
      asset.mime !== 'application/json' || asset.uri !== `https://metravel.by/travel-books/${summary.id}/${summary.revision}/book.json`) {
    throw new Error('BOOK_METADATA_IDENTITY');
  }
  const key = `${summary.id}:${summary.revision}:${asset.sha256}`;
  const cached = loadedBooks.get(key);
  if (cached) return cached;
  const bytes = await fetchVerifiedBookAsset(asset, signal);
  const value = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)) as PublishedBook;
  // Full schemas run in the publisher, not the initial browser bundle. The byte hash
  // authenticates that validation; these checks prevent a swapped summary/revision.
  if (!value || typeof value !== 'object' || value.id !== summary.id || value.slug !== summary.slug ||
      value.revision !== summary.revision || (value.kind ?? 'places') !== summary.kind ||
      (value.visualStyle ?? 'watercolor') !== (summary.visualStyle ?? 'watercolor') ||
      value.country !== summary.country || value.title !== summary.title || value.contentLocale !== summary.contentLocale ||
      value.status !== summary.status || value.coverUri !== summary.coverUri || value.stopCount !== summary.stopCount ||
      value.bodyPageCount !== summary.bodyPageCount || value.coverPageCount !== 4 ||
      !Array.isArray(value.stops) || value.stops.length !== summary.stopCount ||
      !Array.isArray(value.artifacts) || !value.artifacts.length ||
      !Array.isArray(value.preview) || value.preview.length !== 4 ||
      !Array.isArray(value.quality) || value.quality.length !== 2 ||
      JSON.stringify(value.profiles) !== JSON.stringify(summary.profiles) ||
      JSON.stringify(value.missing) !== JSON.stringify(summary.missing) ||
      (summary.kind === 'quests' && (value.kind !== 'quests' || value.seriesId !== summary.seriesId || value.volume !== summary.volume))) {
    throw new Error('BOOK_METADATA_IDENTITY');
  }
  abortIfNeeded(signal);
  loadedBooks.set(key, value);
  return value;
}
