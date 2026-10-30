import React from 'react';
import {act,render,fireEvent,screen} from '@testing-library/react';
import {renderToStaticMarkup} from 'react-dom/server';
import {formatNumber} from '@/i18n';
import BookRoute,{generateMetadata} from '@/app/(tabs)/books/[slug]';
import {findReadyBook} from '@/services/book/readyBooks/catalog';
import {fetchBookArtifact} from '@/services/book/readyBooks/download';
import {publishedFixture} from '../../services/book/readyBooks/publicationFixtures';

jest.mock('@/components/books/ReadyBookDetails',()=>jest.requireActual('@/components/books/ReadyBookDetails.web'));
jest.mock('@/services/book/readyBooks/catalog',()=>({findReadyBook:jest.fn(),readyBooks:[]}));
jest.mock('@/components/books/bookCopy',()=>({useBookCopy:()=>((key:string,params?:Record<string,unknown>)=>params?key+':'+JSON.stringify(params):key)}));
jest.mock('@/i18n/LocaleProvider',()=>({useTranslation:()=>({t:jest.requireActual('@/i18n').translate,ready:true})}));
jest.mock('@/components/books/BooksFrame',()=>({BooksFrame:({children,title,headingLang}:any)=><main><h1 lang={headingLang}>{title}</h1>{children}</main>}));
// The production resolver selects .web; Jest's native preset needs an explicit
// virtual module for this extensionless relative import.
jest.mock('../../../components/books/preview/ReadyBookPreview',()=>({__esModule:true,default:({onClose}:any)=><button onClick={onClose}>close</button>}),{virtual:true});
jest.mock('@/components/ui/Button',()=>({__esModule:true,default:({label,onPress,disabled}:any)=><button disabled={disabled} onClick={onPress}>{label}</button>}));
jest.mock('expo-router',()=>({Link:({children,href}:any)=><a href={href}>{children}</a>,useLocalSearchParams:()=>({slug:'belarus'}),useFocusEffect:(callback:()=>void|(()=>void))=>require('react').useEffect(callback,[callback])}));
jest.mock('@/utils/growthFunnelAnalytics',()=>({trackReadyBookEvent:jest.fn()}));
jest.mock('@/services/book/readyBooks/download',()=>({fetchBookArtifact:jest.fn()}));

beforeEach(()=>{
  jest.mocked(findReadyBook).mockReturnValue(publishedFixture());
  jest.mocked(fetchBookArtifact).mockReset().mockRejectedValue(new Error('offline'));
});
it('renders actual published book details in server markup and gives the route its own canonical',()=>{
  const book=publishedFixture();
  const html=renderToStaticMarkup(<BookRoute/>);
  expect(html).toContain(book.title);
  expect(html).toContain(book.stops[book.stops.length-1].title);
  expect(html).toContain('lang="ru"');
  expect(html).toContain('counts:');
  expect(html).toContain(String(book.stopCount));
  const metadata=generateMetadata(undefined,{slug:book.slug});
  expect(metadata.alternates?.canonical).toBe('https://metravel.by/books/'+book.slug);
  expect(metadata.title).toBe(book.title);
  expect(metadata.robots).toBeUndefined();
});
it('keeps unknown editions out of the search index',()=>{
  jest.mocked(findReadyBook).mockReturnValue(undefined);
  expect(generateMetadata(undefined,{slug:'missing'}).robots).toBe('noindex, nofollow');
});
it('shows measured print quality for the selected profile and returns focus after preview closes',()=>{
  const book=publishedFixture();
  const pocket=book.quality.find(item=>item.profileId==='pocket-150x100')!;
  pocket.minIllustrationPpi=318;
  pocket.physicalChecks=['provider-acceptance','paper-check'];
  jest.mocked(findReadyBook).mockReturnValue(book);
  render(<BookRoute/>);
  const quality=book.quality.find(item=>item.profileId===book.profiles[0].id)!;
  expect(screen.getByText('illustrationPpi:'+JSON.stringify({ppi:formatNumber(quality.minIllustrationPpi,{maximumFractionDigits:1})}))).toBeTruthy();
  expect(screen.getByText('proofOnly')).toBeTruthy();
  expect(screen.queryByText('resolutionPending')).toBeNull();
  const opener=screen.getByRole('button',{name:'preview'});
  fireEvent.click(opener);
  fireEvent.click(screen.getByRole('button',{name:'close'}));
  expect(document.activeElement).toBe(opener);
  fireEvent.click(screen.getByRole('radio',{name:'album'}));
  expect((screen.getByRole('radio',{name:'album'}) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByText('proofOnly')).toBeTruthy();
  const album=book.quality.find(item=>item.profileId==='album-a5')!;
  expect(screen.getByText('illustrationPpi:'+JSON.stringify({ppi:formatNumber(album.minIllustrationPpi,{maximumFractionDigits:1})}))).toBeTruthy();
  expect(screen.getByText('resolutionPending')).toBeTruthy();
});
it('preserves the selected format and retries the same file after a failed guest download',async()=>{
  const book=publishedFixture();
  jest.mocked(findReadyBook).mockReturnValue(book);
  render(<BookRoute/>);
  fireEvent.click(screen.getByRole('radio',{name:'album'}));
  const file=book.artifacts.find(item=>item.profileId==='album-a5')!;
  await act(async()=>{fireEvent.click(screen.getAllByRole('button',{name:'download'})[0]);});
  expect(screen.getByRole('alert').textContent).toBe('downloadError');
  expect((screen.getByRole('radio',{name:'album'}) as HTMLInputElement).checked).toBe(true);
  expect(fetchBookArtifact).toHaveBeenNthCalledWith(1,file,expect.any(AbortSignal));
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'retry'}));});
  expect(fetchBookArtifact).toHaveBeenNthCalledWith(2,file,expect.any(AbortSignal));
  expect((screen.getByRole('radio',{name:'album'}) as HTMLInputElement).checked).toBe(true);
});
it('distinguishes ring-body, ring-cover and sewn-body controls and downloads unique filenames',async()=>{
  const book=publishedFixture(),names:string[]=[];
  jest.mocked(findReadyBook).mockReturnValue(book);
  jest.mocked(fetchBookArtifact).mockResolvedValue(new Blob(['verified-control'],{type:'application/pdf'}));
  const create=URL.createObjectURL,revoke=URL.revokeObjectURL;
  Object.defineProperty(URL,'createObjectURL',{configurable:true,writable:true,value:jest.fn(()=>'blob:verified-control')});
  Object.defineProperty(URL,'revokeObjectURL',{configurable:true,writable:true,value:jest.fn()});
  const click=jest.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){names.push(this.download);});
  jest.useFakeTimers();
  try{
    render(<BookRoute/>);fireEvent.click(screen.getByRole('radio',{name:'album'}));
    const controls=book.artifacts.filter(file=>file.profileId==='album-a5'&&file.purpose==='control');
    expect(controls).toHaveLength(3);
    for(const file of controls){
      const assembly=file.controlFor==='home-sewn'?'sewn':'rings';
      const caption=screen.getByText(new RegExp('^control · '+assembly+' · '+file.component+' · PDF'));
      const button=caption.closest('li')!.querySelector('button')!;
      await act(async()=>{fireEvent.click(button);});
      expect(fetchBookArtifact).toHaveBeenLastCalledWith(file,expect.any(AbortSignal));
    }
    expect(new Set(names).size).toBe(3);
    expect(names).toEqual(controls.map(file=>`${book.slug}-${book.revision}-${file.id}.pdf`));
  }finally{
    jest.clearAllTimers();jest.useRealTimers();click.mockRestore();
    Object.defineProperty(URL,'createObjectURL',{configurable:true,writable:true,value:create});
    Object.defineProperty(URL,'revokeObjectURL',{configurable:true,writable:true,value:revoke});
  }
});
