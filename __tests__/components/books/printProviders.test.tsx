import React from 'react';
import {act,fireEvent,render,screen,within,waitFor} from '@testing-library/react';
import PrintProviders,{PrintProvidersView} from '@/components/books/printProviders/PrintProviders.web';
import providerData from '@/data/travelBooks/providers.json';
import {publishedFixture} from '../../services/book/readyBooks/publicationFixtures';
import {fetchVerifiedBookAsset} from '@/services/book/readyBooks/download';
import {loadCurrentPrintDirectory} from '@/services/book/readyBooks/printResources';
import {listPrintCities,listPrintLocations} from '@/services/book/readyBooks/providers';
import {printDirectorySchema} from '@/data/travelBooks/schema/providers';
import {openExternalUrlInNewTab} from '@/utils/externalLinks';

jest.mock('@/components/ui/Button',()=>({__esModule:true,default:({label,onPress}:{label:string;onPress:()=>void})=><button onClick={onPress}>{label}</button>}));
jest.mock('@/components/ui/Chip',()=>({__esModule:true,default:({label,selected,onPress}:{label:string;selected:boolean;onPress:()=>void})=><button aria-pressed={selected} onClick={onPress}>{label}</button>}));
jest.mock('@/utils/externalLinks',()=>({openExternalUrlInNewTab:jest.fn().mockResolvedValue(true)}));
jest.mock('@/services/book/readyBooks/download',()=>({fetchVerifiedBookAsset:jest.fn()}));
jest.mock('@/services/book/readyBooks/printResources',()=>({...jest.requireActual('@/services/book/readyBooks/printResources'),loadCurrentPrintDirectory:jest.fn()}));
const directory=printDirectorySchema.parse(providerData);
const citySelect=()=>screen.getByLabelText('Город') as HTMLSelectElement;
const selectedCountry=()=>within(screen.getByRole('group',{name:'Страна печати'})).getByRole('button',{pressed:true}).textContent;
const chooseCountry=(name:'Беларусь'|'Польша')=>fireEvent.click(screen.getByRole('button',{name}));
const row=(name:string)=>screen.getByText(name).closest('li')!;
beforeEach(()=>{
  jest.mocked(loadCurrentPrintDirectory).mockReset().mockResolvedValue(directory);
  jest.mocked(openExternalUrlInNewTab).mockReset().mockResolvedValue(true);
  jest.mocked(fetchVerifiedBookAsset).mockClear();
});

it('lists cities in directory order with the capital first and points per city',()=>{
  expect(listPrintCities('BY',directory)).toEqual(['minsk','brest','vitebsk','gomel','grodno','mogilev']);
  expect(listPrintCities('PL',directory)[0]).toBe('warszawa');
  expect(listPrintLocations('minsk',directory).map(provider=>provider.id)).toEqual(['kopirych-minsk','reut-print-minsk','sprinter-nemiga-minsk']);
});

it('shows only capabilities stated by the point and asks to confirm embedded fonts otherwise',()=>{
  render(<PrintProvidersView directory={directory} profileId="album-a5" bodyPageCount={108}/>);
  expect(citySelect().value).toBe('minsk');
  const kopirych=within(row('Копирыч'));
  expect(kopirych.getByText('г. Минск, пр-т Независимости, 58')).toBeTruthy();
  expect(kopirych.getByText(/^Печать: цветная.*A4$/)).toBeTruthy();
  expect(kopirych.getByText('Печатают с вашего файла PDF.')).toBeTruthy();
  expect(kopirych.getByText(/^Переплёт: пружина.*твёрдая обложка$/)).toBeTruthy();
  expect(kopirych.getByText(/PDF со встроенными шрифтами принимают/)).toBeTruthy();
  expect(within(row('Реут Принт')).queryByText('Печатают с вашего файла PDF.')).toBeNull();
  expect(within(row('Реут Принт')).getByText('Уточните у точки, примут ли PDF со встроенными шрифтами.')).toBeTruthy();
  expect(within(row('Печатный центр СПРИНТЕР (метро Немига)')).getByText(/текст должен быть в кривых/)).toBeTruthy();
  // The verification date stays in the data, not on the page.
  expect(screen.queryByText(/проверены/)).toBeNull();
  fireEvent.change(citySelect(),{target:{value:'vitebsk'}});
  expect(screen.queryByText('Копирыч')).toBeNull();
  expect(within(row('Копицентр РУП «Витебский ЦСМС»')).queryByText(/^Переплёт/)).toBeNull();
  expect(within(row('ОАО «Витебский картонажно-полиграфический комбинат «Покровский»')).queryByText(/^Печать:/)).toBeNull();
});

it('resets the city to the capital when the country changes',()=>{
  render(<PrintProvidersView directory={directory} profileId="album-a5" bodyPageCount={108}/>);
  fireEvent.change(citySelect(),{target:{value:'brest'}});
  expect(screen.getByText('CopyStar')).toBeTruthy();
  chooseCountry('Польша');
  expect(citySelect().value).toBe('warszawa');
  expect(screen.getByText('Copy General')).toBeTruthy();
  expect(Array.from(citySelect().options).map(option=>option.textContent)).toEqual(['Варшава','Краков','Вроцлав','Гданьск','Познань','Лодзь','Катовице','Люблин','Щецин','Белосток']);
});

it('opens only a user-selected website/source with the central helper and retains selection on failure',async()=>{
  const opened=jest.fn();
  render(<PrintProvidersView directory={directory} profileId="album-a5" bodyPageCount={108} onProviderOpened={opened}/>);
  expect(openExternalUrlInNewTab).not.toHaveBeenCalled();
  const kopirych=row('Копирыч');
  jest.mocked(openExternalUrlInNewTab).mockResolvedValueOnce(false);
  await act(async()=>fireEvent.click(within(kopirych).getByRole('button',{name:'Сайт пункта печати'})));
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(opened).not.toHaveBeenCalled();
  await act(async()=>fireEvent.click(within(kopirych).getByRole('button',{name:'Источник 2'})));
  expect(openExternalUrlInNewTab).toHaveBeenLastCalledWith('https://kopirych.by/kontakty.html');
  expect(opened).toHaveBeenCalledWith('kopirych-minsk');
});

it('shows current information for legacy editions and never requests their immutable provider snapshot',async()=>{
  const book=publishedFixture();
  const view=render(<PrintProviders book={book} profileId="album-a5" bodyPageCount={108}/>);
  await waitFor(()=>expect(screen.getByText('Копирыч')).toBeTruthy());
  chooseCountry('Польша');
  view.rerender(<PrintProviders book={{...book,printDirectory:{uri:'https://example.com/old.json',sha256:'a'.repeat(64),bytes:1,mime:'application/json'}}} profileId="pocket-150x100" bodyPageCount={108}/>);
  expect(selectedCountry()).toBe('Польша');
  expect(loadCurrentPrintDirectory).toHaveBeenCalledTimes(1);
  expect(fetchVerifiedBookAsset).not.toHaveBeenCalled();
});

it('starts with the book country, preserves a manual choice across profiles, and resets only for a different country',async()=>{
  const book={...publishedFixture(),country:'PL' as const};
  const view=render(<PrintProviders book={book} profileId="album-a5" bodyPageCount={108}/>);
  await waitFor(()=>expect(screen.getByText('Copy General')).toBeTruthy());
  expect(selectedCountry()).toBe('Польша');
  expect(screen.queryByText('Копирыч')).toBeNull();
  chooseCountry('Беларусь');
  fireEvent.change(citySelect(),{target:{value:'gomel'}});
  view.rerender(<PrintProviders book={book} profileId="pocket-150x100" bodyPageCount={108}/>);
  expect(selectedCountry()).toBe('Беларусь');
  expect(citySelect().value).toBe('gomel');
  view.rerender(<PrintProviders book={{...book,country:'BY'}} profileId="pocket-150x100" bodyPageCount={108}/>);
  view.rerender(<PrintProviders book={book} profileId="pocket-150x100" bodyPageCount={108}/>);
  expect(selectedCountry()).toBe('Польша');
  expect(citySelect().value).toBe('warszawa');
  expect(loadCurrentPrintDirectory).toHaveBeenCalledTimes(1);
});

it('retries a failed current-directory chunk with a directory-specific message',async()=>{
  jest.mocked(loadCurrentPrintDirectory).mockRejectedValueOnce(new Error('CHUNK_LOAD'));
  render(<PrintProviders book={publishedFixture()} profileId="pocket-150x100" bodyPageCount={108}/>);
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toBe('Не удалось загрузить список точек печати.'));
  fireEvent.click(screen.getByRole('button',{name:'Повторить'}));
  await waitFor(()=>expect(screen.getByText('Копирыч')).toBeTruthy());
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
