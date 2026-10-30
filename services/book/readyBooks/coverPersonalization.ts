import type {PublishedBook} from './publication';
import {fetchVerifiedBookAsset, type VerifiedBookAsset} from './download';
import {createPersonalizedCoverPdf, normalizeCoverText} from './coverText';

export type CoverOutputMode = 'read' | 'print-shop' | 'home-rings';
type CoverBook = Pick<PublishedBook,'id'|'slug'|'revision'|'coverPersonalization'>;
const assets = new Map<string, ArrayBuffer>();

export class CoverPersonalizationError extends Error {
  constructor(readonly code: 'COVER_MODE_UNAVAILABLE'|'COVER_ASSET_INVALID') {
    super(code);
    this.name = 'CoverPersonalizationError';
  }
}

function assertAsset(asset: VerifiedBookAsset, book: CoverBook) {
  const url = new URL(asset.uri, window.location.origin);
  if (url.origin !== window.location.origin || url.search || url.hash || url.username || url.password ||
      !url.pathname.startsWith(`/travel-books/${book.id}/${book.revision}/`) ||
      !Number.isSafeInteger(asset.bytes) || asset.bytes < 1 || !/^[a-f\d]{64}$/.test(asset.sha256)) {
    throw new CoverPersonalizationError('COVER_ASSET_INVALID');
  }
}

async function verifiedBytes(asset: VerifiedBookAsset, book: CoverBook, signal?: AbortSignal) {
  assertAsset(asset, book);
  if (signal?.aborted) throw new DOMException('Aborted','AbortError');
  let bytes = assets.get(asset.sha256);
  if (!bytes) {
    bytes = await fetchVerifiedBookAsset(asset, signal);
    assets.set(asset.sha256, bytes);
  }
  if (signal?.aborted) throw new DOMException('Aborted','AbortError');
  if (bytes.byteLength !== asset.bytes) throw new CoverPersonalizationError('COVER_ASSET_INVALID');
  return new Uint8Array(bytes.slice(0));
}

export async function createPersonalizedCoverBlob({book,profileId,mode,text,signal}:{book:CoverBook;profileId:string;mode:CoverOutputMode;text:string;signal?:AbortSignal}):Promise<Blob> {
  const descriptor = book.coverPersonalization;
  const template = descriptor?.templates.find(item => item.profileId === profileId && item.mode === mode);
  if (!descriptor || !template) throw new CoverPersonalizationError('COVER_MODE_UNAVAILABLE');
  const normalized = normalizeCoverText(text, descriptor.maxCharacters);
  const [templateBytes, fontBytes] = await Promise.all([verifiedBytes(template, book, signal), verifiedBytes(descriptor.font, book, signal)]);
  if (signal?.aborted) throw new DOMException('Aborted','AbortError');
  const result = await createPersonalizedCoverPdf({templateBytes,fontBytes,text:normalized,maxCharacters:descriptor.maxCharacters,textRegion:template.textRegion,expectedPageCount:template.pageCount,widthMm:template.widthMm,heightMm:template.heightMm});
  if (signal?.aborted) throw new DOMException('Aborted','AbortError');
  return new Blob([result.slice().buffer],{type:'application/pdf'});
}
