import type {PublishedBook,PublishedArtifact} from './publication';
import type {PrintDirectory,PublishedPrintDirectory} from '../../../data/travelBooks/schema/providers';
import {fetchVerifiedBookAsset, type VerifiedBookAsset} from './download';

/** Published print documents belong to one immutable book revision. */
export function assertBookPrintResource(book:Pick<PublishedBook,'id'|'revision'>,asset:VerifiedBookAsset){
  const url=new URL(asset.uri);
  const extensions:Record<string,string>={'text/html':'.html','application/json':'.json','application/pdf':'.pdf'};
  const extension=extensions[asset.mime];
  const cap=asset.mime==='application/pdf'?100*1024*1024:1024*1024;
  if(/[%\\?#\s]/.test(asset.uri)||url.origin!=='https://metravel.by'||url.username||url.password||url.search||url.hash||
    !url.pathname.startsWith(`/travel-books/${book.id}/${book.revision}/`)||!extension||!url.pathname.endsWith(extension)||
    !Number.isSafeInteger(asset.bytes)||asset.bytes<1||asset.bytes>cap||!/^[a-f0-9]{64}$/.test(asset.sha256)){
    throw new Error('BOOK_PRINT_RESOURCE_INVALID');
  }
}
export function bookPrintGuidePage(book:PublishedBook,profileId:PublishedArtifact['profileId']){
  return book.printGuidePages?.find(page=>page.profileId===profileId);
}

/** Addresses and public requirements change independently of a book revision. */
export async function loadCurrentPrintDirectory():Promise<PrintDirectory>{
  const {default:directory}=await import('../../../data/travelBooks/providers.json');
  // Code-level checks validate the source; keep authoring Zod out of the browser.
  return directory as PrintDirectory;
}

export async function loadPrintDirectory(book:Pick<PublishedBook,'id'|'revision'|'printDirectory'>,signal?:AbortSignal):Promise<PublishedPrintDirectory>{
  const asset=book.printDirectory;
  if(!asset)throw new Error('BOOK_PRINT_DIRECTORY_UNAVAILABLE');
  assertBookPrintResource(book,asset);
  const bytes=await fetchVerifiedBookAsset(asset,signal);
  const directory=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as PublishedPrintDirectory;
  // The publisher validates the full schema; the browser authenticates the exact
  // published bytes and rejects an incompatible document rather than substituting data.
  if(![1,2].includes(directory.schemaVersion)||!Array.isArray(directory.cities)||!directory.cities.length||
    !Array.isArray(directory.providers)||!directory.providers.length||
    !directory.cities.some(city=>city.country==='BY')||!directory.cities.some(city=>city.country==='PL')){
    throw new Error('BOOK_PRINT_DIRECTORY_INVALID');
  }
  return directory;
}
