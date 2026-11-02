import React from 'react';
import {act,render,fireEvent,screen} from '@testing-library/react';
import {renderToStaticMarkup} from 'react-dom/server';
import {formatNumber} from '@/i18n';
import BookRoute,{generateMetadata} from '@/app/(tabs)/books/[slug]';
import {findReadyBook} from '@/services/book/readyBooks/catalog';
import {loadReadyBookMetadata} from '@/services/book/readyBooks/bookMetadata';
import type {PublishedBook} from '@/services/book/readyBooks/publication';
import {trackReadyBookEvent} from '@/utils/growthFunnelAnalytics';
import {bookArtifactFilename} from '@/services/book/readyBooks/artifactFilename';
import {describeArtifact,formatArtifactSize,visibleArtifacts} from '@/components/books/bookArtifacts';
import {publishedFixture} from '../../services/book/readyBooks/publicationFixtures';
import {thematicPublished} from '../../services/book/readyBooks/thematicFixtures';

jest.mock('@/components/books/ReadyBookDetails',()=>jest.requireActual('@/components/books/ReadyBookDetails.web'));
jest.mock('@/services/book/readyBooks/catalog',()=>({findReadyBook:jest.fn(),readyBooks:[]}));
jest.mock('@/components/books/bookCopy',()=>({...jest.requireActual('@/components/books/bookCopy'),useBookCopy:()=>((key:string,params?:Record<string,unknown>)=>params?key+':'+JSON.stringify(params):key)}));
jest.mock('@/i18n/LocaleProvider',()=>({useTranslation:()=>({t:jest.requireActual('@/i18n').translate,ready:true})}));
jest.mock('@/components/books/BooksFrame',()=>({BooksFrame:({children,title,headingLang}:any)=><main><h1 lang={headingLang}>{title}</h1>{children}</main>}));
// Real streaming/contents identity is covered by contents.test.tsx; these fixtures use synthetic revisions.
jest.mock('@/components/books/ReadyBookContents.web',()=>({__esModule:true,default:()=>null}));
// The production resolver selects .web; Jest's native preset needs an explicit
// virtual module for this extensionless relative import.
jest.mock('../../../components/books/preview/ReadyBookPreview',()=>({__esModule:true,default:({onClose}:any)=><button onClick={onClose}>close</button>}),{virtual:true});
jest.mock('@/components/ui/Button',()=>({__esModule:true,default:({label,onPress,disabled}:any)=><button disabled={disabled} onClick={onPress}>{label}</button>}));
jest.mock('expo-router',()=>({Link:({children,href}:any)=><a href={href}>{children}</a>,useLocalSearchParams:()=>({slug:'belarus'}),useFocusEffect:(callback:()=>void|(()=>void))=>require('react').useEffect(callback,[callback])}));
jest.mock('@/utils/growthFunnelAnalytics',()=>({trackReadyBookEvent:jest.fn()}));
jest.mock('@/services/book/readyBooks/bookMetadata',()=>({loadReadyBookMetadata:jest.fn()}));

function givenBook(book:PublishedBook){
  jest.mocked(findReadyBook).mockReturnValue({...book,metadata:{kind:'book-metadata',bookId:book.id,revision:book.revision,uri:`https://metravel.by/travel-books/${book.id}/${book.revision}/book.json`,mime:'application/json',bytes:100,sha256:'a'.repeat(64)}});
  jest.mocked(loadReadyBookMetadata).mockResolvedValue(book);
}
async function renderDetails(){await act(async()=>{render(<BookRoute/>);});}
beforeEach(()=>{
  jest.mocked(loadReadyBookMetadata).mockReset();
  givenBook(publishedFixture());
});
it('renders actual published book details in server markup and gives the route its own canonical',()=>{
  const book=publishedFixture();
  const html=renderToStaticMarkup(<BookRoute/>);
  expect(html).toContain(book.title);
  expect(html).toContain('metadataLoading');
  // The first HTML already names the edition facts and carries Book JSON-LD (#2950).
  expect(html).toContain('counts:'+JSON.stringify({places:formatNumber(book.stopCount),pages:formatNumber(book.bodyPageCount)}).replace(/"/g,'&quot;'));
  expect(html).toContain('style: styleWatercolor');
  expect(html).toContain('size: pocket; album');
  expect(html).toContain('application/ld+json');
  expect(html).toContain('"@type":"Book"');
  expect(html).toContain('"numberOfPages":'+book.bodyPageCount);
  expect(html).not.toContain(book.stops[book.stops.length-1].title);
  expect(html).toContain('lang="ru"');
  expect(loadReadyBookMetadata).not.toHaveBeenCalled();
  const metadata=generateMetadata(undefined,{slug:book.slug});
  expect(metadata.alternates?.canonical).toBe('https://metravel.by/books/'+book.slug);
  expect(metadata.title).toBe(book.title);
  expect(metadata.robots).toBeUndefined();
  // Every edition gets its own search snippet from its title, style and counts.
  expect(metadata.description).toContain(book.title);
  expect(metadata.description).toContain(formatNumber(book.stopCount));
  givenBook(publishedFixture(30,{country:'PL',id:'poland-memory',slug:'poland',title:'Польша. Книга воспоминаний'}));
  expect(generateMetadata(undefined,{slug:'poland'}).description).not.toBe(metadata.description);
});
it('keeps an absolute published cover URI as the Book JSON-LD image',()=>{
  const coverUri='https://metravel.by/travel-books/belarus-photo-memory/r1/pocket-150x100/preview-cover-1.webp';
  givenBook({...publishedFixture(),coverUri});
  const html=renderToStaticMarkup(<BookRoute/>);
  expect(html).toContain(`"image":"${coverUri}"`);
  expect(html).not.toContain('metravel.by/https');
});
it('keeps unknown editions out of the search index',()=>{
  jest.mocked(findReadyBook).mockReturnValue(undefined);
  expect(generateMetadata(undefined,{slug:'missing'}).robots).toBe('noindex, nofollow');
});
it('shows no release-audit notes and returns focus after preview closes',async()=>{
  const book=publishedFixture();
  const pocket=book.quality.find(item=>item.profileId==='pocket-150x100')!;
  pocket.minIllustrationPpi=318;
  pocket.physicalChecks=['provider-acceptance','paper-check'];
  givenBook(book);
  await renderDetails();
  // Quality, physical checks and the revision stay in book.json; the public page is a final edition (#2944).
  const visible=document.body.cloneNode(true) as HTMLElement;visible.querySelectorAll('script').forEach(node=>node.remove());
  const text=visible.textContent??'';
  for(const fragment of ['quality','proofOnly','illustrationPpi','physicalChecks','providerPending','revision','digitalKit','partial','318',book.revision])expect(text).not.toContain(fragment);
  const opener=screen.getByRole('button',{name:'preview'});
  fireEvent.click(opener);
  fireEvent.click(screen.getByRole('button',{name:'close'}));
  expect(document.activeElement).toBe(opener);
});
it('downloads through plain file links and reports the click with the size source',async()=>{
  const book=publishedFixture();
  givenBook(book);
  await renderDetails();
  const track=jest.mocked(trackReadyBookEvent);
  track.mockClear();
  // jsdom cannot navigate; the browser's own download is out of scope here, only the link and the event are.
  const stayOnPage=(event:Event)=>{if((event.target as Element).closest('a[download]'))event.preventDefault();};document.addEventListener('click',stayOnPage);
  const [first]=visibleArtifacts(book,book.profiles[0].id);
  const link=screen.getAllByRole('link',{name:/^download: /})[0];
  // A real link keeps the browser's own progress and the iOS user gesture; nothing is fetched by the page (#2951).
  expect(link.getAttribute('href')).toBe(first.uri);
  expect(link.getAttribute('download')).toBe(bookArtifactFilename(book,first));
  expect(link.getAttribute('aria-label')).toBe('download: '+describeArtifact(first,(key:string,params?:Record<string,unknown>)=>params?key+':'+JSON.stringify(params):key));
  fireEvent.click(link);
  expect(track).toHaveBeenLastCalledWith('ReadyBookDownloadRequested',book,expect.any(String),{profileId:first.profileId,artifactPurpose:first.purpose,profileSource:'default'});
  fireEvent.click(screen.getByRole('radio',{name:'album'}));
  fireEvent.click(screen.getAllByRole('link',{name:/^download: /})[0]);
  expect(track).toHaveBeenLastCalledWith('ReadyBookDownloadRequested',book,expect.any(String),expect.objectContaining({profileId:'album-a5',profileSource:'selected'}));
  expect((screen.getByRole('radio',{name:'album'}) as HTMLInputElement).checked).toBe(true);
  document.removeEventListener('click',stayOnPage);
});
it('distinguishes ring-body, ring-cover and sewn-body controls with unique filenames',async()=>{
  const book=publishedFixture();
  givenBook(book);
  await renderDetails();fireEvent.click(screen.getByRole('radio',{name:'album'}));
  const controls=book.artifacts.filter(file=>file.profileId==='album-a5'&&file.purpose==='control');
  expect(controls).toHaveLength(3);
  const names=controls.map(file=>{
    const assembly=file.controlFor==='home-sewn'?'sewn':'rings';
    const caption=screen.getByText(new RegExp('^control · '+assembly+' · '+file.component+' · PDF'));
    const link=caption.closest('li')!.querySelector('a')!;
    expect(link.getAttribute('href')).toBe(file.uri);
    return link.getAttribute('download');
  });
  expect(new Set(names).size).toBe(3);
  expect(names).toEqual(controls.map(file=>`${book.slug}-${book.revision}-${file.id}.pdf`));
});
it('shows one file when the copy-shop PDF is byte-identical to the reading PDF and sizes small files in kilobytes',()=>{
  const book=publishedFixture();
  const read=book.artifacts.find(file=>file.profileId==='pocket-150x100'&&file.purpose==='read'&&file.component==='body')!;
  const shop=book.artifacts.find(file=>file.profileId==='pocket-150x100'&&file.purpose==='print-shop'&&file.component==='body')!;
  shop.sha256='b'.repeat(64);
  expect(visibleArtifacts(book,'pocket-150x100')).toContain(shop);
  shop.sha256=read.sha256;
  expect(visibleArtifacts(book,'pocket-150x100')).not.toContain(shop);
  expect(visibleArtifacts(book,'pocket-150x100')).toContain(read);
  const t=(key:string)=>key;
  expect(formatArtifactSize(24682,t as never)).toBe(formatNumber(24)+' kilobytes');
  expect(formatArtifactSize(1572864,t as never)).toBe(formatNumber(1.5,{maximumFractionDigits:1})+' megabytes');
});

it('links the other visual edition of the same country and keeps the selected size through the profile query',async()=>{
  const catalog=require('@/services/book/readyBooks/catalog');
  const watercolor=publishedFixture(31);
  const photo=publishedFixture(31,{id:'belarus-photo-memory',slug:'belarus-photo',title:'Беларусь. Фотокнига воспоминаний',visualStyle:'photo'});
  catalog.readyBooks.push(watercolor,photo);
  givenBook(watercolor);
  try{
    await renderDetails();
    expect(screen.getByText('styleWatercolor')).toBeTruthy();
    const link=screen.getByRole('link',{name:'stylePhoto'});
    expect(link.getAttribute('href')).toBe('/books/belarus-photo?profile=pocket-150x100');
    fireEvent.click(screen.getByLabelText(/album/));
    expect(screen.getByRole('link',{name:'stylePhoto'}).getAttribute('href')).toBe('/books/belarus-photo?profile=album-a5');
  }finally{catalog.readyBooks.splice(0);}
});
it('opens the edition on the physical size named by the profile query',async()=>{
  const Details=require('@/components/books/ReadyBookDetails.web').default;
  const catalog=require('@/services/book/readyBooks/catalog');
  const book=publishedFixture(31);
  catalog.readyBooks.push(book,publishedFixture(31,{id:'belarus-photo-memory',slug:'belarus-photo',title:'Беларусь. Фотокнига воспоминаний',visualStyle:'photo'}));
  givenBook(book);
  // The static shell never sees the query: server markup keeps the first profile, the client applies it after hydration.
  expect(renderToStaticMarkup(<Details slug={book.slug} initialProfileId="album-a5"/>)).toContain('metadataLoading');
  await act(async()=>{render(<Details slug={book.slug} initialProfileId="album-a5"/>);});
  expect((screen.getByLabelText(/album/) as HTMLInputElement).checked).toBe(true);
  await act(async()=>{render(<Details slug={book.slug} initialProfileId="unknown"/>);});
  expect(screen.getAllByLabelText(/pocket/).some(input=>(input as HTMLInputElement).checked)).toBe(true);
  catalog.readyBooks.splice(0);
});

it('keeps thematic photo series out of the country style alternatives',async()=>{
  const catalog=require('@/services/book/readyBooks/catalog');
  const country=publishedFixture(30,{country:'PL',id:'poland-memory',slug:'poland'});
  const photo=publishedFixture(30,{country:'PL',id:'poland-photo-memory',slug:'poland-photo',visualStyle:'photo'});
  catalog.readyBooks.push(country,photo,{...thematicPublished(),id:'poland-mountains-memory',slug:'poland-mountains',visualStyle:'photo'},
    {...thematicPublished('castles-pl'),id:'poland-castles-memory',slug:'poland-castles',visualStyle:'photo'});
  givenBook(country);
  try{
    await renderDetails();
    const styleLinks=screen.getByRole('navigation',{name:'styleOthers'}).querySelectorAll('a');
    expect(Array.from(styleLinks).map(link=>link.getAttribute('href'))).toEqual(['/books/poland-photo?profile=pocket-150x100']);
  }finally{catalog.readyBooks.splice(0);}
});

it('keeps the summary title during metadata errors and retries without showing stale edition controls',async()=>{
  jest.mocked(loadReadyBookMetadata).mockRejectedValueOnce(new Error('offline'));
  await renderDetails();
  expect(screen.getByRole('alert').textContent).toContain('metadataError');
  expect(screen.queryByRole('button',{name:'preview'})).toBeNull();
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'retry'}));});
  expect(screen.getByRole('button',{name:'preview'})).toBeTruthy();
  expect(loadReadyBookMetadata).toHaveBeenCalledTimes(2);
});
