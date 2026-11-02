import {formatNumber} from '@/i18n';
import type {PublishedBook,PublishedArtifact} from '@/services/book/readyBooks/publication';
import {bookStyleKey} from '@/services/book/readyBooks/publicationState';
import type {ReadyBookSummary} from '@/services/book/readyBooks/bookMetadata';
import {formatReadyBookCounts,type bookT} from './bookCopy';

const purposeKey={read:'read','home-rings':'rings','home-sewn':'sewn','print-shop':'shop',control:'control',stickers:'stickers',instructions:'instructions','print-passport':'passport'} as const;
const MEBIBYTE=1024*1024;

/** Style name of a places edition; thematic photo-source editions name their sources (#2854). */
export const bookStyleLabel=(book:Pick<ReadyBookSummary,'visualStyle'>&{sourceContract?:'thematic-v1'},t:typeof bookT)=>t(bookStyleKey(book.visualStyle,book.sourceContract));

/** Service PDFs weigh tens of kilobytes; a megabyte-only label rounded them to «0 МБ» (#2944). */
export function formatArtifactSize(bytes:number,t:typeof bookT){
  return bytes<MEBIBYTE
    ? `${formatNumber(Math.max(1,Math.round(bytes/1024)))} ${t('kilobytes')}`
    : `${formatNumber(bytes/MEBIBYTE,{maximumFractionDigits:1})} ${t('megabytes')}`;
}

/** One string serves both the visible file line and the download link's accessible name (#2951). */
export function describeArtifact(file:PublishedArtifact,t:typeof bookT){
  return [
    t(purposeKey[file.purpose]),
    file.controlFor&&t(purposeKey[file.controlFor]),
    (file.component==='body'||file.component==='cover')&&t(file.component),
    file.variant&&t(file.variant==='color'?'color':'noBackground'),
    'PDF',
    t('pageCount',{count:formatNumber(file.pageCount)}),
    formatArtifactSize(file.bytes,t),
  ].filter(Boolean).join(' · ');
}

/** A print-shop file byte-identical to the reading file of the same component is one download, not two (#2944). */
export function visibleArtifacts(book:Pick<PublishedBook,'artifacts'>,profileId:PublishedArtifact['profileId']){
  const files=book.artifacts.filter(file=>file.profileId===profileId);
  return files.filter(file=>file.purpose!=='print-shop'||!files.some(other=>other.purpose==='read'&&other.component===file.component&&other.sha256===file.sha256));
}

/**
 * Search description built from already published copy (title, style, counts, language),
 * so every edition gets its own snippet without new editorial prose (#2950).
 */
export function readyBookDescription(book:ReadyBookSummary,t:typeof bookT){
  const style=book.kind==='quests'?t('themeQuests'):bookStyleLabel(book,t);
  return `${book.title} · ${style} · ${formatReadyBookCounts(book,t)} · ${t('language')}. ${t('intro')}`;
}
