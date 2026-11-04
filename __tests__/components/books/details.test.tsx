import React from 'react';
import {act,render,fireEvent,screen,within} from '@testing-library/react';
import {renderToStaticMarkup} from 'react-dom/server';
import {formatNumber,translate} from '@/i18n';
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
jest.mock('@/services/book/readyBooks/catalog',()=>({findReadyBook:jest.fn(),findMiniDiary:jest.fn(),readyBooks:[],miniDiaries:[]}));
jest.mock('@/components/books/bookCopy',()=>({...jest.requireActual('@/components/books/bookCopy'),useBookCopy:()=>((key:string,params?:Record<string,unknown>)=>params?key+':'+JSON.stringify(params):key)}));
jest.mock('@/i18n/LocaleProvider',()=>({useTranslation:()=>({t:jest.requireActual('@/i18n').translate,ready:true})}));
jest.mock('@/components/books/BooksFrame',()=>({BooksFrame:({children,title,headingLang,heading=true}:any)=><main>{heading&&<h1 lang={headingLang}>{title}</h1>}{children}</main>}));
// Real streaming/contents identity is covered by contents.test.tsx; these fixtures use synthetic revisions.
jest.mock('@/components/books/ReadyBookContents.web',()=>({__esModule:true,default:()=>null}));
// The production resolver selects .web; Jest's native preset needs an explicit
// virtual module for this extensionless relative import.
jest.mock('../../../components/books/preview/ReadyBookPreview',()=>({__esModule:true,default:({onClose}:any)=><button onClick={onClose}>close</button>}),{virtual:true});
jest.mock('@/components/ui/Button',()=>({__esModule:true,default:({label,onPress,disabled}:any)=><button disabled={disabled} onClick={onPress}>{label}</button>}));
const mockPush=jest.fn();
jest.mock('expo-router',()=>({Link:({children,href}:any)=><a href={href}>{children}</a>,useRouter:()=>({push:mockPush}),useLocalSearchParams:()=>({slug:'belarus'}),useFocusEffect:(callback:()=>void|(()=>void))=>require('react').useEffect(callback,[callback])}));
jest.mock('@/utils/growthFunnelAnalytics',()=>({trackReadyBookEvent:jest.fn()}));
jest.mock('@/services/book/readyBooks/bookMetadata',()=>({loadReadyBookMetadata:jest.fn()}));
jest.mock('@/services/book/readyBooks/printResources',()=>({...jest.requireActual('@/services/book/readyBooks/printResources'),loadCurrentPrintDirectory:jest.fn(()=>new Promise(()=>{}))}));

const keyT=(key:string,params?:Record<string,unknown>)=>params?key+':'+JSON.stringify(params):key;
function givenBook(book:PublishedBook){
  jest.mocked(findReadyBook).mockReturnValue({...book,metadata:{kind:'book-metadata',bookId:book.id,revision:book.revision,uri:`https://metravel.by/travel-books/${book.id}/${book.revision}/book.json`,mime:'application/json',bytes:100,sha256:'a'.repeat(64)}});
  jest.mocked(loadReadyBookMetadata).mockResolvedValue(book);
}
async function renderDetails(){await act(async()=>{render(<BookRoute/>);});}
// jsdom cannot navigate; the browser's own download is out of scope here, only the link and the event are.
const stayOnPage=(event:Event)=>{if((event.target as Element).closest('a[download]'))event.preventDefault();};
beforeAll(()=>document.addEventListener('click',stayOnPage));
afterAll(()=>document.removeEventListener('click',stayOnPage));
const sizeRadio=(name:'sizePocketTitle'|'sizeAlbumTitle')=>screen.getByRole('radio',{name}) as HTMLInputElement;
beforeEach(()=>{
  jest.mocked(loadReadyBookMetadata).mockReset();
  jest.mocked(trackReadyBookEvent).mockClear();
  mockPush.mockClear();
  givenBook(publishedFixture());
});

it('renders the catalogue facts of the edition in server markup and gives the route its own canonical',()=>{
  const book=publishedFixture();
  const html=renderToStaticMarkup(<BookRoute/>);
  const host=document.createElement('div');host.innerHTML=html;
  // One h1, owned by the hero, in the book language (#2950 facts stay in the first HTML).
  expect(host.querySelectorAll('h1')).toHaveLength(1);
  expect(host.querySelector('h1')?.textContent).toBe(book.title);
  expect(host.querySelector('h1')?.getAttribute('lang')).toBe('ru');
  expect(html).toContain('metadataLoading');
  expect(html).toContain('chipPlaces:'+JSON.stringify({count:book.stopCount,value:formatNumber(book.stopCount)}).replace(/"/g,'&quot;'));
  expect(html).toContain('chipPages:'+JSON.stringify({count:book.bodyPageCount,value:formatNumber(book.bodyPageCount)}).replace(/"/g,'&quot;'));
  expect(html).toContain('promiseByCountry');
  expect(html).toContain('styleWatercolor · sizePocketShort');
  expect(html).toContain('sizeAlbumShort');
  expect(html).toContain('application/ld+json');
  expect(html).toContain('"@type":"Book"');
  expect(html).toContain('"numberOfPages":'+book.bodyPageCount);
  expect(html).not.toContain(book.stops[book.stops.length-1].title);
  // The buttons are shown but inactive until book.json is verified; no file link exists yet.
  expect(Array.from(host.querySelectorAll('.rbe-cta button')).every(button=>(button as HTMLButtonElement).disabled)).toBe(true);
  expect(host.querySelector('a[download]')).toBeNull();
  expect(host.querySelector('a[href="/books"]')?.textContent).toContain('back');
  const backIcon=host.querySelector('.rbe-foot > a > .rbe-i > [data-icon-font="feather"]');
  expect(backIcon?.tagName).toBe('SPAN');
  expect(backIcon?.textContent).toBe(String.fromCodePoint(0xf110));
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

it('orders the approved sections, collapses the optional ones and names every section by its heading',async()=>{
  const catalog=require('@/services/book/readyBooks/catalog');
  const book=publishedFixture();
  catalog.readyBooks.push(book,publishedFixture(30,{country:'PL',id:'poland-memory',slug:'poland',title:'Польша. Книга воспоминаний'}));
  givenBook(book);
  try{
    await renderDetails();
    expect(screen.getAllByRole('heading',{level:1})).toHaveLength(1);
    const headings=screen.getAllByRole('heading',{level:2}).map(heading=>heading.textContent);
    // The cover editor keeps its own heading inside the closed disclosure; print copy is the real catalogue.
    expect(headings).toEqual(['howTitle','chooseTitle','routeTitle',translate('books:coverEditorTitle'),'downloads',translate('books:guideTitle'),'faqTitle','moreTitle']);
    // Hero → how → choose → route → cover → downloads → print → FAQ → more books.
    const order=['heroEyebrow','howTitle','chooseTitle','routeTitle','coverSectionTitle','downloads','printFiles',translate('books:guideTitle'),translate('books:providerTitle'),'faqTitle','moreTitle'];
    const text=document.body.textContent??'';
    const positions=order.map(key=>key==='printFiles'?text.lastIndexOf(key):text.indexOf(key));
    expect(positions.every(position=>position>=0)).toBe(true);
    expect([...positions].sort((a,b)=>a-b)).toEqual(positions);
    // Cover editor, print files, print points and every answer start closed (native <details>).
    const disclosures=Array.from(document.querySelectorAll('details'));
    expect(disclosures.length).toBeGreaterThanOrEqual(3+3+5);
    expect(disclosures.every(details=>!details.open)).toBe(true);
    expect(screen.getByText('coverSectionTitle').closest('details')).toBeTruthy();
    expect(screen.getByText('groupShop').closest('details')).toBeTruthy();
    expect(screen.getByText('printNotCertified')).toBeTruthy();
    expect(screen.getByText(translate('books:providerTitle')).closest('details')).toBeTruthy();
    expect(screen.getByText('faqFreeQ').closest('details')).toBeTruthy();
    // Owner decision 02.11.2026: five questions, no gifting/selling answer.
    expect(document.querySelectorAll('.rbe-faq details')).toHaveLength(5);
    // The style row is absent without another style; «Ещё книги» links the other edition.
    expect(screen.getByRole('link',{name:/^cardTitle/}).getAttribute('href')).toBe('/books/poland');
    fireEvent.click(screen.getByRole('link',{name:/^cardTitle/}));
    expect(mockPush).toHaveBeenCalledWith('/books/poland');
    for(const section of Array.from(document.querySelectorAll('section[aria-labelledby]'))){
      expect(document.getElementById(section.getAttribute('aria-labelledby')!)?.textContent).toBeTruthy();
    }
  }finally{catalog.readyBooks.splice(0);}
});

it('shows the first eight places and expands the full route in place',async()=>{
  const book=publishedFixture(31);
  givenBook(book);
  await renderDetails();
  const list=document.querySelector('.rbe-route')!;
  const rows=Array.from(list.querySelectorAll('li'));
  expect(rows).toHaveLength(31);
  expect(rows.filter(row=>!row.hidden)).toHaveLength(8);
  expect(list.getAttribute('lang')).toBeNull();
  expect(rows[0].querySelector('.rbe-route-t')?.getAttribute('lang')).toBe('ru');
  const toggle=screen.getByRole('button',{name:'routeShowAll:'+JSON.stringify({count:31,value:formatNumber(31)})});
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(toggle.getAttribute('aria-controls')).toBe(list.id);
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(toggle.textContent).toBe('routeCollapse');
  expect(rows.every(row=>!row.hidden)).toBe(true);
});

it('shows no release-audit notes and returns focus to the hero after preview closes',async()=>{
  const book=publishedFixture();
  const pocket=book.quality.find(item=>item.profileId==='pocket-150x100')!;
  pocket.minIllustrationPpi=318;
  pocket.physicalChecks=['provider-acceptance','paper-check'];
  givenBook(book);
  await renderDetails();
  // Quality, physical checks and the revision stay in book.json; the public page is a final edition (#2944).
  const visible=document.body.cloneNode(true) as HTMLElement;visible.querySelectorAll('script').forEach(node=>node.remove());
  const text=visible.textContent??'';
  for(const fragment of ['quality','proofOnly','illustrationPpi','physicalChecks','providerPending','digitalKit','partial','318',book.revision])expect(text).not.toContain(fragment);
  // A dated revision shows its day, never the revision string itself.
  expect(text).toContain('versionDate:');
  const opener=screen.getByRole('button',{name:'ctaRead'});
  fireEvent.click(opener);
  expect(trackReadyBookEvent).toHaveBeenLastCalledWith('ReadyBookPreviewOpened',book,expect.any(String),{profileId:'pocket-150x100'});
  fireEvent.click(screen.getByRole('button',{name:'close'}));
  expect(document.activeElement).toBe(opener);
  expect(trackReadyBookEvent).toHaveBeenCalledWith('ReadyBookViewed',book,expect.any(String));
});

it('lists every file of the size once as a plain download link with a unique name and reports the click with the size source',async()=>{
  const book=publishedFixture();
  givenBook(book);
  await renderDetails();
  const track=jest.mocked(trackReadyBookEvent);
  {
    const files=visibleArtifacts(book,'pocket-150x100');
    const named=screen.getAllByRole('link',{name:/^download: /});
    expect(named).toHaveLength(files.length);
    expect(new Set(named.map(link=>link.getAttribute('aria-label'))).size).toBe(files.length);
    for(const file of files){
      const link=screen.getByRole('link',{name:'download: '+describeArtifact(file,keyT as never)});
      // A real link keeps the browser's own progress and the iOS user gesture; nothing is fetched by the page (#2951).
      expect(link.getAttribute('href')).toBe(file.uri);
      expect(link.getAttribute('download')).toBe(bookArtifactFilename(book,file));
    }
    // The hero names the actual reading PDF and exposes a distinct cover download.
    const whole=files.find(file=>file.purpose==='read'&&file.component==='body')!;
    const hero=screen.getByRole('link',{name:'ctaDownload'});
    expect(hero.getAttribute('href')).toBe(whole.uri);
    expect(hero.getAttribute('download')).toBe(bookArtifactFilename(book,whole));
    expect(hero.getAttribute('download')).toContain('страницы.pdf');
    expect(screen.getByRole('link',{name:'downloadCover'}).getAttribute('href')).toBe(files.find(file=>file.purpose==='read'&&file.component==='cover')?.uri);
    fireEvent.click(hero);
    expect(track).toHaveBeenLastCalledWith('ReadyBookDownloadRequested',book,expect.any(String),{profileId:'pocket-150x100',artifactPurpose:'read',artifactComponent:'body',profileSource:'default'});
    fireEvent.click(screen.getByRole('link',{name:'downloadCover'}));
    expect(track).toHaveBeenLastCalledWith('ReadyBookDownloadRequested',book,expect.any(String),expect.objectContaining({artifactComponent:'cover'}));
    expect(sizeRadio('sizePocketTitle').checked).toBe(true);
    fireEvent.click(sizeRadio('sizeAlbumTitle'));
    expect(track).toHaveBeenLastCalledWith('ReadyBookProfileSelected',book,expect.any(String),{profileId:'album-a5'});
    expect(sizeRadio('sizeAlbumTitle').checked).toBe(true);
    expect(sizeRadio('sizeAlbumTitle').getAttribute('aria-describedby')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('link',{name:/^download: /})[0]);
    expect(track).toHaveBeenLastCalledWith('ReadyBookDownloadRequested',book,expect.any(String),expect.objectContaining({profileId:'album-a5',profileSource:'selected'}));
    expect(screen.getByRole('link',{name:'ctaDownload'}).getAttribute('href')).toBe(visibleArtifacts(book,'album-a5').find(file=>file.purpose==='read'&&file.component==='body')!.uri);
    // Every link of the page has a distinct accessible name or a distinct target.
    const pairs=screen.getAllByRole('link').map(link=>`${link.getAttribute('aria-label')??link.textContent}→${link.getAttribute('href')}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  }
});

it('groups the A5 print packages and distinguishes ring-body, ring-cover and sewn-body controls with unique filenames',async()=>{
  const book=publishedFixture();
  givenBook(book);
  await renderDetails();fireEvent.click(sizeRadio('sizeAlbumTitle'));
  const print=screen.getByRole('heading',{level:3,name:'printFiles'}).parentElement!;
  expect(screen.getByRole('link',{name:'printFiles'}).getAttribute('href')).toBe(`#${print.id}`);
  expect(print.tabIndex).toBe(-1);
  expect(Array.from(print.querySelectorAll('details summary .rbe-acc-title')).map(title=>title.textContent)).toEqual(['groupShop','groupRings','groupSewn','groupControl']);
  const controls=book.artifacts.filter(file=>file.profileId==='album-a5'&&file.purpose==='control');
  expect(controls).toHaveLength(3);
  const names=controls.map(file=>{
    const link=within(print).getByRole('link',{name:'download: '+describeArtifact(file,keyT as never)});
    expect(link.getAttribute('href')).toBe(file.uri);
    // Both assemblies exist on A5, so the visible label names which one the check belongs to.
    expect(link.closest('li')!.textContent).toContain(file.controlFor==='home-sewn'?' · sewn':' · rings');
    return link.getAttribute('download');
  });
  expect(new Set(names).size).toBe(3);
  expect(names).toEqual(['Беларусь — акварель — A5 — проверочный лист, на кольцах, страницы.pdf','Беларусь — акварель — A5 — проверочный лист, на кольцах, обложка.pdf','Беларусь — акварель — A5 — проверочный лист, прошивка, страницы.pdf']);
});
it('shows one file when the copy-shop PDF is byte-identical to the reading PDF and sizes small files in kilobytes',async()=>{
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
  // The page says where the de-duplicated copy-shop file went instead of dropping it silently.
  givenBook(book);
  await renderDetails();
  expect(screen.getByText('groupShopSameBody')).toBeTruthy();
  expect(screen.queryByRole('link',{name:'download: '+describeArtifact(shop,keyT as never)})).toBeNull();
});

it('links the other visual edition of the same country and keeps the selected size through the profile query',async()=>{
  const catalog=require('@/services/book/readyBooks/catalog');
  const watercolor=publishedFixture(31);
  const photo=publishedFixture(31,{id:'belarus-photo-memory',slug:'belarus-photo',title:'Беларусь. Фотокнига воспоминаний',visualStyle:'photo'});
  catalog.readyBooks.push(watercolor,photo);
  givenBook(watercolor);
  try{
    await renderDetails();
    const styles=screen.getByRole('navigation',{name:'style'});
    // The current style is marked, not linked; the other style is a link that keeps the size.
    expect(within(styles).getByText('styleWatercolor').closest('[aria-current="true"]')).toBeTruthy();
    const link=within(styles).getByRole('link',{name:/^stylePhoto/});
    expect(link.getAttribute('href')).toBe('/books/belarus-photo?profile=pocket-150x100');
    fireEvent.click(sizeRadio('sizeAlbumTitle'));
    expect(within(styles).getByRole('link',{name:/^stylePhoto/}).getAttribute('href')).toBe('/books/belarus-photo?profile=album-a5');
    expect(screen.getByRole('heading',{level:2,name:'chooseTitle'}).nextElementSibling?.textContent).toContain('chooseLead');
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
  const first=render(<Details slug={book.slug} initialProfileId="album-a5"/>);
  await act(async()=>{});
  expect(sizeRadio('sizeAlbumTitle').checked).toBe(true);
  expect(document.querySelector('.rbe-stage')?.getAttribute('data-size')).toBe('a5');
  first.unmount();
  render(<Details slug={book.slug} initialProfileId="unknown"/>);
  await act(async()=>{});
  expect(sizeRadio('sizePocketTitle').checked).toBe(true);
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
    const styleLinks=screen.getByRole('navigation',{name:'style'}).querySelectorAll('a');
    expect(Array.from(styleLinks).map(link=>link.getAttribute('href'))).toEqual(['/books/poland-photo?profile=pocket-150x100']);
  }finally{catalog.readyBooks.splice(0);}
});

it('keeps the summary hero during metadata errors and retries without showing stale edition controls',async()=>{
  jest.mocked(loadReadyBookMetadata).mockRejectedValueOnce(new Error('offline'));
  await renderDetails();
  expect(screen.getByRole('alert').textContent).toContain('metadataError');
  expect((screen.getByRole('button',{name:'ctaRead'}) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole('radio')).toBeNull();
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'retry'}));});
  expect((screen.getByRole('button',{name:'ctaRead'}) as HTMLButtonElement).disabled).toBe(false);
  expect(loadReadyBookMetadata).toHaveBeenCalledTimes(2);
});

it('keeps the mobile quick actions after the hero without a scroll observer and hides them during preview (#2948)',async()=>{
  const book=publishedFixture();
  givenBook(book);
  await renderDetails();
  const bar=screen.getByRole('region',{name:'stickyLabel'});
  // CSS `position: sticky` as the last child of the after-hero block — no IntersectionObserver.
  expect(bar.parentElement?.classList.contains('rbe-after')).toBe(true);
  expect(bar.parentElement?.lastElementChild).toBe(bar);
  expect(bar.closest('.rbe')?.querySelector('.rbe-hero')?.compareDocumentPosition(bar)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  // Short visible names, distinct from the hero's link names; the bar never takes focus.
  expect(screen.getAllByRole('link',{name:'ctaDownload'})).toHaveLength(1);
  expect(within(bar).getByRole('link',{name:'stickyDownload'})).toBeTruthy();
  expect(bar.contains(document.activeElement)).toBe(false);
  fireEvent.click(within(bar).getByRole('link',{name:'stickyDownload'}));
  expect(trackReadyBookEvent).toHaveBeenLastCalledWith('ReadyBookDownloadRequested',book,expect.any(String),expect.objectContaining({artifactPurpose:'read'}));
  fireEvent.click(within(bar).getByRole('button',{name:'stickyRead'}));
  expect(trackReadyBookEvent).toHaveBeenLastCalledWith('ReadyBookPreviewOpened',book,expect.any(String),{profileId:'pocket-150x100'});
  expect(screen.queryByRole('region',{name:'stickyLabel'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'close'}));
  expect(document.activeElement).toBe(document.querySelector('.rbe-cta button'));
  expect(screen.getByRole('region',{name:'stickyLabel'})).toBeTruthy();
});
