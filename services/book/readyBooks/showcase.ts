import showcase from '@/data/travelBooks/showcase.json';
import type {ReadyBookSummary} from './bookMetadata';

/**
 * Places the catalogue landing shows as real book pages (#2970). Entries name an exact
 * stop and its body page; `showcase.test.ts` keeps them equal to `contents.json`, so the
 * catalogue never has to import that index.
 */
export type ShowcaseRef = {bookId:string;stopId:string;title:string;page:number};
export type ShowcasePage = {book:ReadyBookSummary;title:string;uri:string};

const COVER_PREVIEW=/\/pocket-150x100\/preview-cover-1\.webp$/;
export const showcaseData=showcase as {schemaVersion:1;hero:ShowcaseRef[];how:ShowcaseRef;places:ShowcaseRef[]};

/** The publisher stores every body page next to the cover preview of the same revision and profile. */
export function bodyPageUri(book:ReadyBookSummary,page:number){
  return COVER_PREVIEW.test(book.coverUri)?book.coverUri.replace(COVER_PREVIEW,`/pocket-150x100/preview-body-${page}.webp`):undefined;
}

function resolve(books:readonly ReadyBookSummary[],ref:ShowcaseRef,page=ref.page):ShowcasePage|undefined{
  const book=books.find(item=>item.id===ref.bookId);
  const uri=book&&bodyPageUri(book,page);
  return book&&uri?{book,title:ref.title,uri}:undefined;
}
const present=(page:ShowcasePage|undefined):page is ShowcasePage=>Boolean(page);

/** An unpublished or re-profiled book drops its entries instead of showing a broken image. */
export function selectShowcase(books:readonly ReadyBookSummary[],data=showcaseData){
  return {
    hero:data.hero.map(ref=>resolve(books,ref)).filter(present),
    // A place takes three consecutive pages: the story, a free photo page and a notes page.
    how:[0,1,2].map(offset=>resolve(books,data.how,data.how.page+offset)).filter(present),
    places:data.places.map(ref=>resolve(books,ref)).filter(present),
  };
}
