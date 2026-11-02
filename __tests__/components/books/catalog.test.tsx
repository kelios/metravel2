import React from 'react';
import {render,screen} from '@testing-library/react';
import Catalog from '@/components/books/catalog/ReadyBooksCatalog.web';
import type {ReadyBookSummary} from '@/services/book/readyBooks/bookMetadata';
import {publishedFixture} from '../../services/book/readyBooks/publicationFixtures';
jest.mock('@/components/books/bookCopy',()=>({...jest.requireActual('@/components/books/bookCopy'),useBookCopy:()=>((key:string,params?:Record<string,unknown>)=>params?key+':'+JSON.stringify(params):key)}));
jest.mock('@/components/ui/ImageCardMedia',()=>({__esModule:true,default:({src,alt}:any)=><img src={src} alt={alt}/>}));
jest.mock('@/components/books/BooksFrame',()=>({BooksFrame:({children,title}:any)=><main><h1>{title}</h1>{children}</main>}));
jest.mock('expo-router',()=>({Link:({children,href}:any)=><a href={href}>{children}</a>}));
jest.mock('@/services/book/readyBooks/catalog',()=>({readyBooks:[]}));
const books=require('@/services/book/readyBooks/catalog').readyBooks;
afterEach(()=>books.splice(0));
describe('book catalogue',()=>{
  it('never offers fake downloads while publication is not ready',()=>{
    render(<Catalog/>);expect(screen.getByText('preparing')).toBeTruthy();expect(screen.queryByRole('link')).toBeNull();
  });
  it('shows the editorial language, both physical formats and exact edition URL',()=>{
    books.push(publishedFixture());render(<Catalog/>);
    expect(screen.getByText('language')).toBeTruthy();expect(screen.getByText(/pocket/)).toBeTruthy();expect(screen.getByText(/album/)).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/books/belarus');expect(screen.getByText('partial')).toBeTruthy();
    expect(screen.queryByText('order')).toBeNull();
  });
});

it.each([31,37])('shows data-driven counts for a valid %i-place edition',count=>{
  const book=publishedFixture(count);
  books.push(book);
  render(<Catalog/>);
  expect(screen.getByText('counts:'+JSON.stringify({places:String(book.stopCount),pages:String(book.bodyPageCount)}))).toBeTruthy();
  expect(book.stopCount).toBe(count);
  expect(book.bodyPageCount).toBeGreaterThan(56);
});

it('shows quest count and volume without presenting quests as places',()=>{
  const base=publishedFixture(37);
  const summary:ReadyBookSummary={
    kind:'quests',seriesId:'poland-quests',volume:2,id:'poland-quests-2',slug:'poland-quests-2',
    title:'Польша. Квесты, часть 2',country:'PL',revision:base.revision,contentLocale:base.contentLocale,
    status:base.status,coverUri:base.coverUri.replace(`/${base.id}/`,'/poland-quests-2/'),stopCount:37,bodyPageCount:156,
    profiles:base.profiles,missing:base.missing,
    metadata:{kind:'book-metadata',bookId:'poland-quests-2',revision:base.revision,
      uri:`https://metravel.by/travel-books/poland-quests-2/${base.revision}/book.json`,mime:'application/json',bytes:123,sha256:'a'.repeat(64)},
  };
  books.push(summary);
  render(<Catalog/>);
  expect(screen.getByText('questCounts:'+JSON.stringify({quests:'37',pages:'156',volume:'2'}))).toBeTruthy();
  expect(screen.queryByText(/^counts:/)).toBeNull();
  expect(screen.queryByText(/^style:/)).toBeNull();
});

it('names the visual style of every edition and keeps the watercolor default for legacy metadata',()=>{
  books.push(publishedFixture(31),publishedFixture(31,{id:'belarus-photo-memory',slug:'belarus-photo',title:'Беларусь. Фотокнига воспоминаний',visualStyle:'photo'}));
  const first=render(<Catalog/>);
  expect(screen.getByText('style: styleWatercolor')).toBeTruthy();
  expect(screen.getByText('style: stylePhoto')).toBeTruthy();
  first.unmount();
  // The readiness note is per edition: the watercolor kit is complete, the photo edition still misses supplements.
  books[0].missing=['provider-acceptance','paper-check'];
  render(<Catalog/>);
  expect(screen.getAllByText('digitalKit')).toHaveLength(1);
  expect(screen.getAllByText('partial')).toHaveLength(1);
  expect(screen.getAllByRole('link').map(link=>link.getAttribute('href'))).toEqual(['/books/belarus','/books/belarus-photo']);
});
