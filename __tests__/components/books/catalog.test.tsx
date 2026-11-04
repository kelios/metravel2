import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import Catalog from '@/components/books/catalog/ReadyBooksCatalogContent.web';
import CatalogPage from '@/components/books/catalog/ReadyBooksCatalog.web';
import type {ReadyBookSummary} from '@/services/book/readyBooks/bookMetadata';
import {publishedFixture} from '../../services/book/readyBooks/publicationFixtures';
import {thematicPublished} from '../../services/book/readyBooks/thematicFixtures';
jest.mock('@/i18n',()=>({...jest.requireActual('@/i18n'),translate:(key:string)=>key.replace(/^books:/,'')}));
jest.mock('@/components/books/bookCopy',()=>({...jest.requireActual('@/components/books/bookCopy'),useBookCopy:()=>((key:string,params?:Record<string,unknown>)=>params?key+':'+JSON.stringify(params):key)}));
jest.mock('@/components/books/BooksFrame',()=>({BooksFrame:({children,title,description,heading=true}:any)=><main data-description={description}>{heading&&<h1>{title}</h1>}{children}</main>}));
jest.mock('expo-router',()=>({useRouter:()=>({push:jest.fn()})}));
jest.mock('@/services/book/readyBooks/catalog',()=>({readyBooks:[],miniDiaries:[]}));
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
    expect(screen.getByText('language')).toBeTruthy();expect(screen.getByText(/catalogSizes.*sizePocketShort · sizeAlbumShort/)).toBeTruthy();
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
  const mountain={...thematicPublished(),id:'poland-mountains-memory',slug:'poland-mountains',title:'Горы Польши',visualStyle:'photo' as const};
  books.push(publishedFixture(),mountain);
  render(<Catalog/>);
  fireEvent.click(screen.getByRole('radio',{name:'themeMountains'}));
  expect(screen.getByRole('link').getAttribute('href')).toBe('/books/poland-mountains');
  expect(screen.queryByText('seriesPlanned')).toBeNull();
  expect(screen.getByRole('heading',{name:'Горы Польши'}).getAttribute('lang')).toBe('ru');
  expect(screen.getByText(/^promisePlMountains:/)).toBeTruthy();
  fireEvent.click(screen.getByRole('radio',{name:'themeCastles'}));
  expect(screen.getByText('seriesPlanned')).toBeTruthy();
  expect(screen.queryByRole('link')).toBeNull();
});

it.each([31,37])('shows data-driven counts for a valid %i-place edition',count=>{
  const book=publishedFixture(count);
  books.push(book);
  render(<Catalog/>);
  expect(screen.getByText('chipPlaces:'+JSON.stringify({count:book.stopCount,value:String(book.stopCount)}))).toBeTruthy();
  expect(screen.getByText('chipPages:'+JSON.stringify({count:book.bodyPageCount,value:String(book.bodyPageCount)}))).toBeTruthy();
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
  expect(screen.getByText('chipQuests:'+JSON.stringify({count:37,value:'37'}))).toBeTruthy();
  expect(screen.queryByText(/^chipPlaces:/)).toBeNull();
  expect(screen.queryByText(/^style:/)).toBeNull();
  expect(screen.getByRole('heading',{name:'Польша. Квесты, часть 2'})).toBeTruthy();
  expect(screen.queryByText(/^styleBenefit/)).toBeNull();
  // Only the first part announces the reserved second part.
  expect(screen.queryByText('questNextPart')).toBeNull();
});

it('names the visual style of every edition and keeps the watercolor default for legacy metadata',()=>{
  books.push(publishedFixture(31),publishedFixture(31,{id:'belarus-photo-memory',slug:'belarus-photo',title:'Беларусь. Фотокнига воспоминаний',visualStyle:'photo'}));
  const first=render(<Catalog/>);
  expect(screen.getByRole('heading',{name:'countryBY'})).toBeTruthy();
  expect(screen.getByRole('link',{name:/styleWatercolor/})).toBeTruthy();
  expect(screen.getByRole('link',{name:/stylePhoto/})).toBeTruthy();
  first.unmount();
  books[0].missing=['provider-acceptance','paper-check'];
  render(<Catalog/>);
  // Release-audit notes stay in data, never on the public catalogue (#2944).
  expect(screen.queryByText('digitalKit')).toBeNull();
  expect(screen.queryByText('partial')).toBeNull();
  expect(screen.getAllByRole('link').map(link=>link.getAttribute('href'))).toEqual(['/books/belarus','/books/belarus-photo']);
});

it('loads the landing inside the route frame: one hero h1, steps, edition choice and questions (#2970)',async()=>{
  books.push(publishedFixture());
  render(<CatalogPage/>);
  // The landing is a lazy chunk; a cold transform under a loaded machine exceeds the 1 s default.
  expect(await screen.findByRole('heading',{level:1,name:'catalogTitle'},{timeout:10000})).toBeTruthy();
  expect(screen.getAllByRole('heading',{level:1})).toHaveLength(1);
  // `/books` has its own snippet; the shared `intro` stays the short tail of every edition description.
  expect(document.querySelector('main')?.getAttribute('data-description')).toBe('catalogDescription');
  expect(screen.queryByRole('status')).toBeNull();
  const hrefs=screen.getAllByRole('link').map(link=>link.getAttribute('href'));
  expect(hrefs).toEqual(expect.arrayContaining(['#books-choose','#books-steps','/books/belarus']));
  for(const id of ['books-choose','books-steps'])expect(document.getElementById(id)?.getAttribute('tabindex')).toBe('-1');
  expect(screen.getByRole('heading',{level:2,name:'catalogStepsTitle'})).toBeTruthy();
  expect(screen.getByRole('heading',{level:2,name:'catalogChooseTitle'}).compareDocumentPosition(screen.getByRole('heading',{level:2,name:'catalogStepsTitle'}))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(screen.getByRole('heading',{level:2,name:'faqTitle'})).toBeTruthy();
});

it('keeps all style links in one country card and combines the country and topic filters',()=>{
  for(const visualStyle of [undefined,'fantasy','graphic'] as const){
    const book=publishedFixture();
    books.push({...book,id:book.id+(visualStyle??''),slug:book.slug+(visualStyle??''),...(visualStyle?{visualStyle}:{})});
  }
  render(<Catalog/>);
  expect(screen.getAllByRole('heading',{level:3}).map(heading=>heading.textContent)).toEqual(['countryBY']);
  expect(screen.getAllByRole('link').map(link=>link.getAttribute('href'))).toEqual(['/books/belarus','/books/belarusfantasy','/books/belarusgraphic']);
  expect(screen.getByText('styleBenefitGraphic')).toBeTruthy();
  fireEvent.click(screen.getByRole('radio',{name:'countryPL'}));
  expect(screen.getByRole('status').textContent).toBe('noBooks');
  expect(screen.queryByRole('link')).toBeNull();
});
