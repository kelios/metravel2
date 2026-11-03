import {bodyPageUri,selectShowcase,showcaseData,type ShowcaseRef} from '@/services/book/readyBooks/showcase';
import {readyBooks} from '@/services/book/readyBooks/catalog';
import type {ReadyBookSummary} from '@/services/book/readyBooks/bookMetadata';
import {bookStyleKey} from '@/services/book/readyBooks/publicationState';
import contents from '@/data/travelBooks/contents.json';

const refs:ShowcaseRef[]=[...showcaseData.hero,showcaseData.how,...showcaseData.places];

// A republished book with shifted pages or renamed stops must fail here, not show the wrong page (#2970).
it.each(refs.map(ref=>[ref.title,ref] as const))('pins %s to its exact published stop and page',(_title,ref)=>{
  const book=readyBooks.find(item=>item.id===ref.bookId);
  expect(book?.kind).toBe('places');
  expect(bodyPageUri(book as ReadyBookSummary,ref.page)).toMatch(/\/pocket-150x100\/preview-body-\d+\.webp$/);
  const stop=contents.books.find(item=>item.id===ref.bookId)?.stops.find(item=>item.id===ref.stopId);
  expect(stop).toEqual({id:ref.stopId,title:ref.title,page:ref.page});
  expect(book!.bodyPageCount).toBeGreaterThanOrEqual(ref.page+2);
});

it('shows every published showcase page and keeps hero, how and places distinct in size',()=>{
  const showcase=selectShowcase(readyBooks);
  expect(showcase.hero).toHaveLength(4);
  expect(showcase.how.map(page=>page.uri.match(/preview-body-(\d+)/)?.[1])).toEqual([0,1,2].map(offset=>String(showcaseData.how.page+offset)));
  expect(showcase.places).toHaveLength(6);
  expect(new Set(showcase.places.map(place=>place.uri)).size).toBe(6);
  // The hero caption names the Watercolor style (`catalogStageCaption`).
  expect(showcase.hero.map(page=>bookStyleKey(page.book.visualStyle,page.book.sourceContract))).toEqual(Array(4).fill('styleWatercolor'));
});

it('drops entries of an unpublished book or a cover outside the preview layout instead of a broken image',()=>{
  const book=readyBooks.find(item=>item.id===showcaseData.how.bookId)!;
  expect(selectShowcase([]).places).toEqual([]);
  const moved={...book,coverUri:'/elsewhere/cover.webp'};
  expect(selectShowcase([moved]).how).toEqual([]);
  expect(bodyPageUri(book,7)).toBe(book.coverUri.replace('preview-cover-1.webp','preview-body-7.webp'));
});
