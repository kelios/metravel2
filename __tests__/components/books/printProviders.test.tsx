import React from 'react';
import {act, fireEvent, render, screen, within} from '@testing-library/react';
import PrintProviders from '@/components/books/printProviders/PrintProviders.web';
import {printDirectory, resolvePrintProviders, type PrintProviderQuery} from '@/services/book/readyBooks/providers';
import {printDirectorySchema} from '@/data/travelBooks/schema/providers';
import {openExternalUrlInNewTab} from '@/utils/externalLinks';

jest.mock('@/components/ui/Button', () => ({__esModule: true, default: ({label, onPress}: any) => <button onClick={onPress}>{label}</button>}));
jest.mock('@/utils/externalLinks', () => ({openExternalUrlInNewTab: jest.fn().mockResolvedValue(true)}));
jest.mock('@/components/books/printProviders/providerCopy', () => ({useProviderCopy: () => {
  const {translate} = jest.requireActual('@/i18n');
  return (key: string, params?: Record<string, unknown>) => translate(`books:${key}`, params);
}}));

const query: PrintProviderQuery = {country: 'BY', city: 'Минск', profileId: 'album-a5', copies: 1, bodyPageCount: 108, binding: 'spiral'};
const match = (id: string, overrides: Partial<PrintProviderQuery> = {}) => resolvePrintProviders({...query, ...overrides}).find(item => item.provider.id === id)!;

it('covers all 6 Belarusian and 18 Polish administrative centres without inventing local branches', () => {
  expect(printDirectory.cities.filter(city => city.country === 'BY')).toHaveLength(6);
  expect(printDirectory.cities.filter(city => city.country === 'PL')).toHaveLength(18);
  expect(new Set(printDirectory.cities.map(city => `${city.country}:${city.name}`)).size).toBe(24);
  for (const city of printDirectory.cities) {
    expect(resolvePrintProviders({...query, country: city.country, city: city.name, copies: 50}).length).toBeGreaterThan(0);
  }
  expect(match('beleksprint-spiral', {copies: 50}).fulfillment).toBe('local');
  expect(match('beleksprint-spiral', {city: 'Витебск', copies: 50}).fulfillment).toBe('delivery');
  expect(match('cyfrus-spiral', {country: 'PL', city: 'Wrocław'}).fulfillment).toBe('local');
  expect(match('cyfrus-spiral', {country: 'PL', city: 'Toruń'}).fulfillment).toBe('delivery');
  expect(resolvePrintProviders({...query, city: 'Warszawa'})).toEqual([]);
});

it('keeps product minimum orders separate from a different one-copy offer', () => {
  expect(match('beleksprint-spiral').exclusions).toContain('copies');
  expect(match('beleksprint-spiral', {copies: 50}).exclusions).toEqual([]);
  expect(match('openprint-spiral', {country: 'PL', city: 'Warszawa'}).exclusions).toContain('copies');
  expect(match('cyfrus-spiral', {country: 'PL', city: 'Warszawa'}).provider.minimumCopies).toBeNull();
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
  expect(resolvePrintProviders({...query, copies: 50}, [provider])[0].confirmedFile).toBe(false);
  expect(resolvePrintProviders({...query, copies: 50, artifactSha256: 'b'.repeat(64)}, [provider])[0].confirmedFile).toBe(false);
  expect(resolvePrintProviders({...query, copies: 50, artifactSha256: 'a'.repeat(64)}, [provider])[0].confirmedFile).toBe(true);
  expect(printDirectorySchema.safeParse({...printDirectory, providers: [provider, provider]}).success).toBe(false);
});

it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid copy count %s', copies => {
  expect(resolvePrintProviders({...query, copies})).toEqual([]);
});

it('shows unknowns, preserves the selected print city and opens only the explicit source through the helper', async () => {
  render(<PrintProviders profileId="album-a5" bodyPageCount={108}/>);
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
  render(<PrintProviders profileId="album-a5" bodyPageCount={104}/>);
  const provider = screen.getByText('Печатная компания').closest('li')!;
  await act(async () => fireEvent.click(within(provider).getByRole('button', {name: 'Открыть сайт типографии'})));
  expect(screen.getByRole('alert').textContent).toBe('Не удалось открыть сайт. Повторите переход.');
  fireEvent.change(screen.getByLabelText('Экземпляров'), {target: {value: ''}});
  expect(screen.getByRole('status').textContent).toBe('Укажите целое число экземпляров от 1.');
  expect(screen.queryByText('Печатная компания')).toBeNull();
});

it('does not offer an unsupported compact sewn package after switching the book format', () => {
  expect(resolvePrintProviders({...query, profileId: 'pocket-150x100', binding: 'sewn'})).toEqual([]);
  const view = render(<PrintProviders profileId="album-a5" bodyPageCount={108}/>);
  fireEvent.change(screen.getByLabelText('Переплёт'), {target: {value: 'sewn'}});
  view.rerender(<PrintProviders profileId="pocket-150x100" bodyPageCount={108}/>);
  expect((screen.getByLabelText('Переплёт') as HTMLSelectElement).value).toBe('spiral');
  expect(screen.queryByRole('option', {name: 'Прошивка'})).toBeNull();
});
