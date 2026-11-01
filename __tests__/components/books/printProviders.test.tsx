import React from 'react';
import {act,fireEvent,render,screen,within,waitFor} from '@testing-library/react';
import PrintProviders,{PrintProvidersView} from '@/components/books/printProviders/PrintProviders.web';
import providerData from '@/data/travelBooks/providers.json';
import {publishedFixture} from '../../services/book/readyBooks/publicationFixtures';
import {fetchVerifiedBookAsset} from '@/services/book/readyBooks/download';
import {loadCurrentPrintDirectory} from '@/services/book/readyBooks/printResources';
import {listPrintLocations} from '@/services/book/readyBooks/providers';
import {printDirectorySchema} from '@/data/travelBooks/schema/providers';
import {openExternalUrlInNewTab} from '@/utils/externalLinks';

jest.mock('@/components/ui/Button',()=>({__esModule:true,default:({label,onPress}:{label:string;onPress:()=>void})=><button onClick={onPress}>{label}</button>}));
jest.mock('@/utils/externalLinks',()=>({openExternalUrlInNewTab:jest.fn().mockResolvedValue(true)}));
jest.mock('@/services/book/readyBooks/download',()=>({fetchVerifiedBookAsset:jest.fn()}));
jest.mock('@/services/book/readyBooks/printResources',()=>({...jest.requireActual('@/services/book/readyBooks/printResources'),loadCurrentPrintDirectory:jest.fn()}));
jest.mock('@/components/books/printProviders/providerCopy',()=>({useProviderCopy:()=>{
  const {translate}=jest.requireActual('@/i18n');
  return (key:string,params?:Record<string,unknown>)=>translate(`books:${key}`,params);
}}));
const directory=printDirectorySchema.parse(providerData);
beforeEach(()=>{
  jest.mocked(loadCurrentPrintDirectory).mockReset().mockResolvedValue(directory);
  jest.mocked(openExternalUrlInNewTab).mockReset().mockResolvedValue(true);
  jest.mocked(fetchVerifiedBookAsset).mockClear();
});

it('keeps one source of dated walk-in locations and technical evidence without claiming exact PDF acceptance',()=>{
  expect(listPrintLocations('BY',directory).map(p=>p.id)).toEqual(['karandash-documents']);
  expect(listPrintLocations('PL',directory).map(p=>p.id)).toEqual(['copy-general-documents','cyfrus-spiral']);
  for(const provider of [...listPrintLocations('BY',directory),...listPrintLocations('PL',directory)]){
    expect(provider.checkedAt).toBe('2026-11-01');
    expect(provider.printHelp.address).toBeTruthy();
    expect(provider.acceptsRuPdf).toBe('unknown');
    expect(provider.supportedProfiles).toEqual([]);
    expect(provider.acceptedFiles).toEqual([]);
  }
  const invalid={...providerData,providers:providerData.providers.map(provider=>({...provider,sourceUrls:[...provider.sourceUrls]}))};
  invalid.providers[0].sourceUrls=[];
  expect(printDirectorySchema.safeParse(invalid).success).toBe(false);
});

it('shows addresses and honest Cyrillic inference without quantity, city or exact-file gates',()=>{
  const view=render(<PrintProvidersView directory={directory} profileId="album-a5" bodyPageCount={108} artifactSha256="unknown"/>);
  expect(screen.getByText('Карандаш')).toBeTruthy();
  expect(screen.getByText(/ул. Гикало, 3/)).toBeTruthy();
  expect(screen.getByText(/общие правила просят текст в кривых/)).toBeTruthy();
  expect(screen.queryByLabelText('Город')).toBeNull();
  expect(screen.queryByRole('spinbutton')).toBeNull();
  fireEvent.change(screen.getByLabelText('Страна печати'),{target:{value:'PL'}});
  expect(screen.getByText('Copy General')).toBeTruthy();
  expect(screen.getByText(/Jerozolimskie 93/)).toBeTruthy();
  expect(screen.getAllByText(/Возможность печати кириллицы — технический вывод/)).toHaveLength(2);
  view.rerender(<PrintProvidersView directory={directory} profileId="pocket-150x100" bodyPageCount={104}/>);
  expect((screen.getByLabelText('Страна печати') as HTMLSelectElement).value).toBe('PL');
  expect(screen.getByText('CYFRUS.PL')).toBeTruthy();
});

it('opens only a user-selected website/source with the central helper and retains selection on failure',async()=>{
  const opened=jest.fn();
  render(<PrintProvidersView directory={directory} profileId="album-a5" bodyPageCount={108} onProviderOpened={opened}/>);
  expect(openExternalUrlInNewTab).not.toHaveBeenCalled();
  const row=screen.getByText('Карандаш').closest('li')!;
  jest.mocked(openExternalUrlInNewTab).mockResolvedValueOnce(false);
  await act(async()=>fireEvent.click(within(row).getByRole('button',{name:'Сайт пункта печати'})));
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(opened).not.toHaveBeenCalled();
  await act(async()=>fireEvent.click(within(row).getByRole('button',{name:'Источник 2'})));
  expect(openExternalUrlInNewTab).toHaveBeenLastCalledWith('https://www.karandash.by/files/rules_karandash.pdf');
  expect(opened).toHaveBeenCalledWith('karandash-documents');
});

it('shows current information for legacy editions and never requests their immutable provider snapshot',async()=>{
  const book=publishedFixture();
  const view=render(<PrintProviders book={book} profileId="album-a5" bodyPageCount={108}/>);
  await waitFor(()=>expect(screen.getByText('Карандаш')).toBeTruthy());
  fireEvent.change(screen.getByLabelText('Страна печати'),{target:{value:'PL'}});
  view.rerender(<PrintProviders book={{...book,printDirectory:{uri:'https://example.com/old.json',sha256:'a'.repeat(64),bytes:1,mime:'application/json'}}} profileId="pocket-150x100" bodyPageCount={108}/>);
  expect((screen.getByLabelText('Страна печати') as HTMLSelectElement).value).toBe('PL');
  expect(loadCurrentPrintDirectory).toHaveBeenCalledTimes(1);
  expect(fetchVerifiedBookAsset).not.toHaveBeenCalled();
});

it('starts with the book country, preserves a manual choice across profiles, and resets only for a different country',async()=>{
  const book={...publishedFixture(),country:'PL' as const};
  const view=render(<PrintProviders book={book} profileId="album-a5" bodyPageCount={108}/>);
  await waitFor(()=>expect(screen.getByText('Copy General')).toBeTruthy());
  expect((screen.getByLabelText('Страна печати') as HTMLSelectElement).value).toBe('PL');
  expect(screen.queryByText('Карандаш')).toBeNull();
  fireEvent.change(screen.getByLabelText('Страна печати'),{target:{value:'BY'}});
  view.rerender(<PrintProviders book={book} profileId="pocket-150x100" bodyPageCount={108}/>);
  expect((screen.getByLabelText('Страна печати') as HTMLSelectElement).value).toBe('BY');
  expect(screen.getByText('Карандаш')).toBeTruthy();
  view.rerender(<PrintProviders book={{...book,country:'BY'}} profileId="pocket-150x100" bodyPageCount={108}/>);
  view.rerender(<PrintProviders book={book} profileId="pocket-150x100" bodyPageCount={108}/>);
  expect((screen.getByLabelText('Страна печати') as HTMLSelectElement).value).toBe('PL');
  expect(loadCurrentPrintDirectory).toHaveBeenCalledTimes(1);
});

it('retries a failed current-directory chunk without changing the selected book profile',async()=>{
  jest.mocked(loadCurrentPrintDirectory).mockRejectedValueOnce(new Error('CHUNK_LOAD'));
  render(<PrintProviders book={publishedFixture()} profileId="pocket-150x100" bodyPageCount={108}/>);
  await waitFor(()=>expect(screen.getByRole('alert')).toBeTruthy());
  fireEvent.click(screen.getByRole('button',{name:'Повторить'}));
  await waitFor(()=>expect(screen.getByText('Карандаш')).toBeTruthy());
  expect(screen.getAllByText(/150 × 100 мм/).length).toBeGreaterThan(0);
  expect(loadCurrentPrintDirectory).toHaveBeenCalledTimes(2);
  expect(fetchVerifiedBookAsset).not.toHaveBeenCalled();
});

it('does not apply a directory result after unmount',async()=>{
  let done!:(value:typeof directory)=>void;
  jest.mocked(loadCurrentPrintDirectory).mockImplementationOnce(()=>new Promise(resolve=>{done=resolve;}));
  const view=render(<PrintProviders book={publishedFixture()} profileId="album-a5" bodyPageCount={108}/>);
  view.unmount();
  await act(async()=>{done(directory);});
  expect(view.container.textContent).toBe('');
});
