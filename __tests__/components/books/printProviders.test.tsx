import React from 'react';
import {act, fireEvent, render, screen, within, waitFor} from '@testing-library/react';
import PrintProviders,{PrintProvidersView} from '@/components/books/printProviders/PrintProviders.web';
import providerData from '@/data/travelBooks/providers.json';
import {publishedFixture} from '../../services/book/readyBooks/publicationFixtures';
import {fetchVerifiedBookAsset} from '@/services/book/readyBooks/download';
import {resolvePrintProviders, type PrintProviderQuery} from '@/services/book/readyBooks/providers';
import {printDirectorySchema} from '@/data/travelBooks/schema/providers';
import {openExternalUrlInNewTab} from '@/utils/externalLinks';

jest.mock('@/components/ui/Button', () => ({__esModule: true, default: ({label, onPress}: any) => <button onClick={onPress}>{label}</button>}));
jest.mock('@/utils/externalLinks', () => ({openExternalUrlInNewTab: jest.fn().mockResolvedValue(true)}));
jest.mock('@/components/books/printProviders/providerCopy', () => ({useProviderCopy: () => {
  const {translate} = jest.requireActual('@/i18n');
  return (key: string, params?: Record<string, unknown>) => translate(`books:${key}`, params);
}}));

jest.mock('@/services/book/readyBooks/download',()=>({fetchVerifiedBookAsset:jest.fn()}));
const printDirectory=printDirectorySchema.parse(providerData);

const query: PrintProviderQuery = {country: 'BY', city: 'Минск', profileId: 'album-a5', copies: 1, bodyPageCount: 108, binding: 'spiral'};
const match = (id: string, overrides: Partial<PrintProviderQuery> = {}) => resolvePrintProviders({...query, ...overrides},printDirectory).find(item => item.provider.id === id)!;

it('covers all 6 Belarusian and 18 Polish administrative centres without inventing local branches', () => {
  expect(printDirectory.cities.filter(city => city.country === 'BY')).toHaveLength(6);
  expect(printDirectory.cities.filter(city => city.country === 'PL')).toHaveLength(18);
  expect(new Set(printDirectory.cities.map(city => `${city.country}:${city.name}`)).size).toBe(24);
  for (const city of printDirectory.cities) {
    expect(resolvePrintProviders({...query, country: city.country, city: city.name, copies: 50},printDirectory).length).toBeGreaterThan(0);
  }
  expect(match('beleksprint-spiral', {copies: 50}).fulfillment).toBe('local');
  expect(match('beleksprint-spiral', {city: 'Витебск', copies: 50}).fulfillment).toBe('delivery');
  expect(match('cyfrus-spiral', {country: 'PL', city: 'Wrocław'}).fulfillment).toBe('local');
  expect(match('cyfrus-spiral', {country: 'PL', city: 'Toruń'}).fulfillment).toBe('delivery');
  expect(resolvePrintProviders({...query, city: 'Warszawa'},printDirectory)).toEqual([]);
});

it('keeps product minimum orders separate from a different one-copy offer', () => {
  expect(match('beleksprint-spiral').exclusions).toContain('copies');
  expect(match('beleksprint-spiral', {copies: 50}).exclusions).toEqual([]);
  expect(match('openprint-spiral', {country: 'PL', city: 'Warszawa'},printDirectory).exclusions).toContain('copies');
  expect(match('cyfrus-spiral', {country: 'PL', city: 'Warszawa'},printDirectory).provider.minimumCopies).toBeNull();
  expect(match('slavprint-small-run').exclusions).toContain('binding');
});

it('filters trim size, binding and body length independently even at an accepted quantity', () => {
  const pl = {country: 'PL', city: 'Warszawa', copies: 50} as const;
  expect(match('openprint-spiral', pl).exclusions).toEqual(['pages']);
  expect(match('openprint-spiral', {...pl, profileId: 'pocket-150x100'}).exclusions).toEqual(['format', 'pages']);
  expect(match('openprint-hardcover-one', pl).exclusions).toEqual(['format', 'binding', 'pages']);
  expect(match('versoprint-glued', pl).exclusions).toContain('binding');
  expect(match('beleksprint-spiral', {copies: 50, binding: 'rings'}).exclusions).toContain('binding');
  expect(match('openprint-spiral', {...pl, bodyPageCount: 56}).exclusions).toEqual([]);
});

it('never promotes generic PDF support, unknown limits or published A5 to exact-file acceptance', () => {
  for (const provider of printDirectory.providers) {
    expect(provider.sourceUrls.length).toBeGreaterThan(0);
    expect(provider.sourceUrls.every(url => url.startsWith('https://'))).toBe(true);
    expect(provider.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(provider.acceptsRuPdf).toBe('unknown');
    expect(provider.supportedProfiles).toEqual([]);
  }
  expect(match('beleksprint-spiral', {copies: 50}).confirmedFile).toBe(false);
  const provider = {...printDirectory.providers.find(item => item.id === 'beleksprint-spiral')!, acceptsRuPdf: 'yes' as const,
    supportedProfiles: ['album-a5' as const], acceptedFiles: [{profileId: 'album-a5' as const, sha256: 'a'.repeat(64), sourceUrl: 'https://example.org/evidence', checkedAt: '2026-10-30'}]};
  expect(resolvePrintProviders({...query, copies: 50}, {...printDirectory,providers:[provider]})[0].confirmedFile).toBe(false);
  expect(resolvePrintProviders({...query, copies: 50, artifactSha256: 'b'.repeat(64)}, {...printDirectory,providers:[provider]})[0].confirmedFile).toBe(false);
  expect(resolvePrintProviders({...query, copies: 50, artifactSha256: 'a'.repeat(64)}, {...printDirectory,providers:[provider]})[0].confirmedFile).toBe(true);
  expect(printDirectorySchema.safeParse({...printDirectory, providers: [provider, provider]}).success).toBe(false);
});

it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid copy count %s', copies => {
  expect(resolvePrintProviders({...query, copies},printDirectory)).toEqual([]);
});

it('shows unknowns, preserves the selected print city and opens only the explicit source through the helper', async () => {
  render(<PrintProvidersView directory={printDirectory} profileId="album-a5" bodyPageCount={108}/>);
  expect(screen.getByText(/Приём точных файлов этой книги типографиями пока не подтверждён/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Город'), {target: {value: 'Витебск'}});
  expect(screen.getByText('Подходящий вариант для этих параметров пока не подтверждён.')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Экземпляров'), {target: {value: '50'}});
  const provider = screen.getByText('Beleksprint').closest('li')!;
  expect(within(provider).getByText('Доставка · отправка: Минск')).toBeTruthy();
  expect(within(provider).getByText('Приём точного PDF на русском: Нужно уточнить')).toBeTruthy();
  expect(within(provider).getByText('Языки общения: Нужно уточнить')).toBeTruthy();
  await act(async () => fireEvent.click(within(provider).getByRole('button', {name: 'Открыть сайт типографии'})));
  expect(openExternalUrlInNewTab).toHaveBeenLastCalledWith('https://beleksprint.by/broshyury-na-pruzhine/');
  expect((screen.getByLabelText('Город') as HTMLSelectElement).value).toBe('Витебск');
  fireEvent.change(screen.getByLabelText('Страна печати'), {target: {value: 'PL'}});
  expect((screen.getByLabelText('Город') as HTMLSelectElement).value).toBe('Warszawa');
  expect(screen.getByText('Доставка · отправка: Wrocław')).toBeTruthy();
  const spiral = screen.getByText('Openprint — spiral catalogue').closest('li')!;
  expect(within(spiral).getByText(/Страниц внутреннего блока:.*максимум 56/)).toBeTruthy();
});

it('keeps inputs after an external-link failure and does not show candidates for an invalid quantity', async () => {
  jest.mocked(openExternalUrlInNewTab).mockResolvedValueOnce(false);
  render(<PrintProvidersView directory={printDirectory} profileId="album-a5" bodyPageCount={104}/>);
  const provider = screen.getByText('Печатная компания').closest('li')!;
  await act(async () => fireEvent.click(within(provider).getByRole('button', {name: 'Открыть сайт типографии'})));
  expect(screen.getByRole('alert').textContent).toBe('Не удалось открыть сайт. Повторите переход.');
  fireEvent.change(screen.getByLabelText('Экземпляров'), {target: {value: ''}});
  expect(screen.getByRole('status').textContent).toBe('Укажите целое число экземпляров от 1.');
  expect(screen.queryByText('Печатная компания')).toBeNull();
});

it('does not offer an unsupported compact sewn package after switching the book format', () => {
  expect(resolvePrintProviders({...query, profileId: 'pocket-150x100', binding: 'sewn'},printDirectory)).toEqual([]);
  const view = render(<PrintProvidersView directory={printDirectory} profileId="album-a5" bodyPageCount={108}/>);
  fireEvent.change(screen.getByLabelText('Переплёт'), {target: {value: 'sewn'}});
  view.rerender(<PrintProvidersView directory={printDirectory} profileId="pocket-150x100" bodyPageCount={108}/>);
  expect((screen.getByLabelText('Переплёт') as HTMLSelectElement).value).toBe('spiral');
  expect(screen.queryByRole('option', {name: 'Прошивка'})).toBeNull();
});


function publishedDirectoryBook(){
  const book=publishedFixture();
  book.printDirectory={uri:`https://metravel.by/travel-books/${book.id}/${book.revision}/providers.json`,mime:'application/json',bytes:1,sha256:'a'.repeat(64)};
  return book;
}
const directoryBytes=()=>new TextEncoder().encode(JSON.stringify(printDirectory)).buffer;

it('loads verified directory once, then preserves city and quantity across a format change',async()=>{
  const book=publishedDirectoryBook();
  let resolve!:(value:ArrayBuffer)=>void;
  jest.mocked(fetchVerifiedBookAsset).mockReset().mockImplementation(()=>new Promise<ArrayBuffer>(done=>{resolve=done;}));
  const view=render(<PrintProviders book={book} profileId="album-a5" bodyPageCount={108}/>);
  expect(screen.getByRole('status')).toBeTruthy();
  expect(screen.queryByLabelText('Город')).toBeNull();
  await act(async()=>{resolve(directoryBytes());});
  fireEvent.change(screen.getByLabelText('Город'),{target:{value:'Витебск'}});
  fireEvent.change(screen.getByLabelText('Экземпляров'),{target:{value:'50'}});
  view.rerender(<PrintProviders book={{...book,printDirectory:{...book.printDirectory!}}} profileId="pocket-150x100" bodyPageCount={108}/>);
  expect((screen.getByLabelText('Город') as HTMLSelectElement).value).toBe('Витебск');
  expect((screen.getByLabelText('Экземпляров') as HTMLInputElement).value).toBe('50');
  expect(fetchVerifiedBookAsset).toHaveBeenCalledTimes(1);
});

it('exposes a hash failure and retries the same directory without resetting the chosen book format',async()=>{
  const book=publishedDirectoryBook();
  jest.mocked(fetchVerifiedBookAsset).mockReset().mockRejectedValueOnce(new Error('DOWNLOAD_HASH')).mockResolvedValueOnce(directoryBytes());
  render(<PrintProviders book={book} profileId="pocket-150x100" bodyPageCount={108}/>);
  await waitFor(()=>expect(screen.getByRole('alert')).toBeTruthy());
  fireEvent.click(screen.getByRole('button',{name:'Повторить'}));
  await waitFor(()=>expect(screen.getByLabelText('Город')).toBeTruthy());
  expect(fetchVerifiedBookAsset).toHaveBeenCalledTimes(2);
  expect(jest.mocked(fetchVerifiedBookAsset).mock.calls.every(([asset])=>asset===book.printDirectory||asset.uri===book.printDirectory!.uri)).toBe(true);
  expect(screen.queryByRole('option',{name:'Прошивка'})).toBeNull();
});

it('aborts directory loading on unmount and does not substitute a bundled directory for legacy metadata',async()=>{
  const book=publishedDirectoryBook();
  let resolve!:(value:ArrayBuffer)=>void;
  jest.mocked(fetchVerifiedBookAsset).mockReset().mockImplementation(()=>new Promise<ArrayBuffer>(done=>{resolve=done;}));
  const view=render(<PrintProviders book={book} profileId="album-a5" bodyPageCount={108}/>);
  const signal=jest.mocked(fetchVerifiedBookAsset).mock.calls[0][1]!;
  view.unmount();
  expect(signal.aborted).toBe(true);
  await act(async()=>{resolve(directoryBytes());});
  render(<PrintProviders book={publishedFixture()} profileId="album-a5" bodyPageCount={108}/>);
  expect(screen.queryByLabelText('Город')).toBeNull();
  expect(fetchVerifiedBookAsset).toHaveBeenCalledTimes(1);
});


it('reports provider opening only after the central helper succeeds',async()=>{
  const opened=jest.fn();
  render(<PrintProvidersView directory={printDirectory} profileId="album-a5" bodyPageCount={108} onProviderOpened={opened}/>);
  jest.mocked(openExternalUrlInNewTab).mockResolvedValueOnce(false);
  const button=screen.getAllByRole('button',{name:'Открыть сайт типографии'})[0];
  await act(async()=>fireEvent.click(button));
  expect(opened).not.toHaveBeenCalled();
  await act(async()=>fireEvent.click(button));
  expect(opened).toHaveBeenCalledTimes(1);
  const matched=printDirectory.providers.find(provider=>provider.url===jest.mocked(openExternalUrlInNewTab).mock.calls.at(-1)![0]);
  expect(opened).toHaveBeenCalledWith(matched!.id);
});
