import {formatNumber,translate, type TranslationParams} from '@/i18n';
import {useLocaleRevision} from '@/i18n/useLocaleRevision';
import type {ReadyBookSummary} from '@/services/book/readyBooks/bookMetadata';

// Literal keys let the web compiler extract the exact locale catalog.
const copy = {
  theme: () => translate('books:theme'),
  themeAll: () => translate('books:themeAll'),
  themeMixed: () => translate('books:themeMixed'),
  themeCastles: () => translate('books:themeCastles'),
  themeMountains: () => translate('books:themeMountains'),
  themeQuests: () => translate('books:themeQuests'),
  seriesPlanned: () => translate('books:seriesPlanned'),
  seriesPlaces: (params?: TranslationParams) => translate('books:seriesPlaces', params),
  noBooks: () => translate('books:noBooks'),
  metadataLoading: () => translate('books:metadataLoading'),
  metadataError: () => translate('books:metadataError'),
  questCounts: (params?: TranslationParams) => translate('books:questCounts', params),
  questPhotoSpace: () => translate('books:questPhotoSpace'),
  digitalKit: () => translate('books:digitalKit'),
  stickers: () => translate('books:stickers'),
  instructions: () => translate('books:instructions'),
  passport: () => translate('books:passport'),
  color: () => translate('books:color'),
  noBackground: () => translate('books:noBackground'),
  title: () => translate('books:title'),
  intro: () => translate('books:intro'),
  partial: () => translate('books:partial'),
  language: () => translate('books:language'),
  counts: (params?: TranslationParams) => translate('books:counts', params),
  pageCount: (params?: TranslationParams) => translate('books:pageCount', params),
  photoSpace: () => translate('books:photoSpace'),
  millimeters: () => translate('books:millimeters'),
  quality: () => translate('books:quality'),
  proofOnly: () => translate('books:proofOnly'),
  illustrationPpi: (params?: TranslationParams) => translate('books:illustrationPpi', params),
  physicalChecks: () => translate('books:physicalChecks'),
  resolutionPending: () => translate('books:resolutionPending'),
  providerAcceptance: () => translate('books:providerAcceptance'),
  paperCheck: () => translate('books:paperCheck'),
  explore: () => translate('books:explore'),
  style: () => translate('books:style'),
  styleWatercolor: () => translate('books:styleWatercolor'),
  stylePhoto: () => translate('books:stylePhoto'),
  stylePhotoSources: () => translate('books:stylePhotoSources'),
  styleGraphic: () => translate('books:styleGraphic'),
  styleFantasy: () => translate('books:styleFantasy'),
  styleOthers: () => translate('books:styleOthers'),
  size: () => translate('books:size'),
  pocket: () => translate('books:pocket'),
  album: () => translate('books:album'),
  inside: () => translate('books:inside'),
  downloads: () => translate('books:downloads'),
  preview: () => translate('books:preview'),
  read: () => translate('books:read'),
  rings: () => translate('books:rings'),
  sewn: () => translate('books:sewn'),
  shop: () => translate('books:shop'),
  control: () => translate('books:control'),
  body: () => translate('books:body'),
  cover: () => translate('books:cover'),
  download: () => translate('books:download'),
  downloadError: () => translate('books:downloadError'),
  retry: () => translate('books:retry'),
  close: () => translate('books:close'),
  previous: () => translate('books:previous'),
  next: () => translate('books:next'),
  page: () => translate('books:page'),
  zoom: () => translate('books:zoom'),
  contents: () => translate('books:contents'),
  pageError: () => translate('books:pageError'),
  coverTab: () => translate('books:coverTab'),
  bodyTab: () => translate('books:bodyTab'),
  back: () => translate('books:back'),
  notFound: () => translate('books:notFound'),
  preparing: () => translate('books:preparing'),
  pending: () => translate('books:pending'),
  related: () => translate('books:related'),
  revision: () => translate('books:revision'),
  megabytes: () => translate('books:megabytes'),
  downloading: () => translate('books:downloading'),
  providerPending: () => translate('books:providerPending'),
  loadingPage: () => translate('books:loadingPage'),
};
export const bookT=(key:keyof typeof copy,params?:TranslationParams)=>copy[key](params);
type BookCountSummary = Pick<ReadyBookSummary,'stopCount'|'bodyPageCount'> & (
  {kind:'places'} |
  Pick<Extract<ReadyBookSummary,{kind:'quests'}>,'kind'|'volume'>
);
export function formatReadyBookCounts(book:BookCountSummary,t:typeof bookT){
  return book.kind==='quests'
    ? t('questCounts',{quests:formatNumber(book.stopCount),pages:formatNumber(book.bodyPageCount),volume:formatNumber(book.volume)})
    : t('counts',{places:formatNumber(book.stopCount),pages:formatNumber(book.bodyPageCount)});
}
export function useBookCopy(){
  useLocaleRevision();
  return bookT;
}
