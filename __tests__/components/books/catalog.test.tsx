import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import Catalog from '@/components/books/catalog/ReadyBooksCatalogContent.web';
import CatalogPage from '@/components/books/catalog/ReadyBooksCatalog.web';
import type {ReadyBookSummary} from '@/services/book/readyBooks/bookMetadata';
import {publishedFixture} from '../../services/book/readyBooks/publicationFixtures';
import {thematicPublished} from '../../services/book/readyBooks/thematicFixtures';
jest.mock('@/i18n',()=>({...jest.requireActual('@/i18n'),translate:(key:string)=>key.replace(/^books:/,'')}));
jest.mock('@/components/books/bookCopy',()=>({...jest.requireActual('@/components/books/bookCopy'),useBookCopy:()=>((key:string,params?:Record<string,unknown>)=>params?key+':'+JSON.stringify(params):key)}));
jest.mock('@/components/ui/ImageCardMedia',()=>({__esModule:true,default:({src,alt}:any)=><img src={src} alt={alt}/>}));
jest.mock('@/components/books/BooksFrame',()=>({BooksFrame:({children,title}:any)=><main><h1>{title}</h1>{children}</main>}));
jest.mock('expo-router',()=>({Link:({children,href}:any)=><a href={href}>{children}</a>}));
jest.mock('@/services/book/readyBooks/catalog',()=>({readyBooks:[]}));
jest.mock('@/services/book/readyBooks/seriesCatalog',()=>({...jest.requireActual('@/services/book/readyBooks/seriesCatalog'),bookSeries:[]}));
const books=require('@/services/book/readyBooks/catalog').readyBooks;
const series=require('@/services/book/readyBooks/seriesCatalog').bookSeries;
afterEach(()=>{books.splice(0);series.splice(0);});
describe('book catalogue',()=>{
  it('never offers fake downloads while publication is not ready',()=>{
    render(<Catalog/>);expect(screen.getByText('preparing')).toBeTruthy();expect(screen.queryByRole('link')).toBeNull();
  });
  it('shows the editorial language, both physical formats and exact edition URL',()=>{
    books.push(publishedFixture());render(<Catalog/>);
    expect(screen.getByText('language')).toBeTruthy();expect(screen.getByText(/pocket/)).toBeTruthy();expect(screen.getByText(/album/)).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/books/belarus');expect(screen.queryByText('partial')).toBeNull();
    expect(screen.queryByText('order')).toBeNull();
  });
});

it('shows planned series without links and filters them by declared theme',()=>{
  series.push(...require('@/data/travelBooks/series/catalog.json').series.map((item:any)=>({...item,status:'planned'})));
  books.push(publishedFixture());
  render(<Catalog/>);
  expect(screen.getAllByText('seriesPlanned')).toHaveLength(2);
  fireEvent.click(screen.getByRole('radio',{name:'themeMountains'}));
  expect(screen.getByRole('heading',{name:'Горы Польши'})).toBeTruthy();
  expect(screen.queryByRole('heading',{name:'Замки Польши'})).toBeNull();
  expect(screen.queryByRole('link')).toBeNull();
  fireEvent.click(screen.getByRole('radio',{name:'themeMixed'}));
  expect(screen.getByRole('link').getAttribute('href')).toBe('/books/belarus');
  expect(screen.queryByText('seriesPlanned')).toBeNull();
});

it('offers only published editions from a ready series and never substitutes a country book',()=>{
  series.push(...require('@/data/travelBooks/series/catalog.json').series.map((item:any)=>({...item,status:'ready'})));
  const mountain={...thematicPublished(),id:'poland-mountains-memory',slug:'poland-mountains',title:'Горы Польши'};
  books.push(publishedFixture(),mountain);
  render(<Catalog/>);
  fireEvent.click(screen.getByRole('radio',{name:'themeMountains'}));
  expect(screen.getByRole('link').getAttribute('href')).toBe('/books/poland-mountains');
  expect(screen.queryByText('seriesPlanned')).toBeNull();
  fireEvent.click(screen.getByRole('radio',{name:'themeCastles'}));
  expect(screen.getByText('seriesPlanned')).toBeTruthy();
  expect(screen.queryByRole('link')).toBeNull();
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
  books[0].missing=['provider-acceptance','paper-check'];
  render(<Catalog/>);
  // Release-audit notes stay in data, never on the public catalogue (#2944).
  expect(screen.queryByText('digitalKit')).toBeNull();
  expect(screen.queryByText('partial')).toBeNull();
  expect(screen.getAllByRole('link').map(link=>link.getAttribute('href'))).toEqual(['/books/belarus','/books/belarus-photo']);
});

it('loads the catalogue inside the route frame rather than leaving the loading fallback',async()=>{
  books.push(publishedFixture());
  render(<CatalogPage/>);
  expect(screen.getByRole('heading',{level:1,name:'title'})).toBeTruthy();
  expect((await screen.findByRole('link')).getAttribute('href')).toBe('/books/belarus');
  expect(screen.queryByRole('status')).toBeNull();
});
