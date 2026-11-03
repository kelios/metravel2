import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import PrintingGuide from '@/components/books/printingGuide/PrintingGuide.web';
import {openExternalUrlInNewTab} from '@/utils/externalLinks';
import {trackReadyBookEvent} from '@/utils/growthFunnelAnalytics';
import {publishedFixture} from '../../services/book/readyBooks/publicationFixtures';

jest.mock('@/components/ui/Button',()=>({__esModule:true,default:({label,onPress}:any)=><button onClick={onPress}>{label}</button>}));
jest.mock('@/utils/growthFunnelAnalytics',()=>({trackReadyBookEvent:jest.fn()}));
jest.mock('@/utils/externalLinks',()=>({openExternalUrlInNewTab:jest.fn()}));

beforeEach(()=>{jest.mocked(openExternalUrlInNewTab).mockReset().mockResolvedValue(true);jest.mocked(trackReadyBookEvent).mockClear();});
const htmlBook=()=>{
  const book=publishedFixture();
  book.printGuidePages=book.profiles.map(profile=>({profileId:profile.id,mime:'text/html',uri:`https://metravel.by/travel-books/${book.id}/${book.revision}/${profile.id}/instructions.html`,bytes:100,sha256:'a'.repeat(64)}));
  return book;
};

it('opens the ready HTML document of the selected immutable book profile through the central helper',async()=>{
  const book=htmlBook();
  const view=render(<PrintingGuide book={book} profileId="pocket-150x100"/>);
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Полная инструкция по печати'})));
  expect(openExternalUrlInNewTab).toHaveBeenLastCalledWith(book.printGuidePages![0].uri);
  expect(trackReadyBookEvent).toHaveBeenLastCalledWith('ReadyBookInstructionsViewed',book,'ru',{profileId:'pocket-150x100'});
  view.rerender(<PrintingGuide book={book} profileId="album-a5"/>);
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Полная инструкция по печати'})));
  expect(openExternalUrlInNewTab).toHaveBeenLastCalledWith(book.printGuidePages![1].uri);
});

it('retries a blocked opening without changing the book or profile and does not carry the error to another format',async()=>{
  const book=htmlBook();
  jest.mocked(openExternalUrlInNewTab).mockResolvedValueOnce(false);
  const view=render(<PrintingGuide book={book} profileId="album-a5"/>);
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Полная инструкция по печати'})));
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(trackReadyBookEvent).not.toHaveBeenCalled();
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Повторить'})));
  expect(openExternalUrlInNewTab).toHaveBeenLastCalledWith(book.printGuidePages![1].uri);
  view.rerender(<PrintingGuide book={book} profileId="pocket-150x100"/>);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('button',{name:'Полная инструкция по печати'})).toBeTruthy();
});

it('rejects another revision instead of opening an unrelated instruction',async()=>{
  const book=htmlBook();book.printGuidePages![0].uri=book.printGuidePages![0].uri.replace(book.revision,'other');
  render(<PrintingGuide book={book} profileId="pocket-150x100"/>);
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Полная инструкция по печати'})));
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(openExternalUrlInNewTab).not.toHaveBeenCalled();
});

it('keeps a legacy PDF fallback explicit and never invents an absent HTML page',async()=>{
  const book=publishedFixture();
  const file={...book.artifacts[0],id:'legacy.instructions',purpose:'instructions' as const,component:'instructions' as const,pageCount:3,uri:`https://metravel.by/travel-books/${book.id}/${book.revision}/legacy-instructions.pdf`};
  book.artifacts.push(file);
  render(<PrintingGuide book={book} profileId="pocket-150x100"/>);
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Инструкция печати (RU) · PDF'})));
  expect(openExternalUrlInNewTab).toHaveBeenLastCalledWith(file.uri);
});

it('offers three ways to print with steps behind a uniquely named disclosure and keeps the provider block inside',()=>{
  const book=htmlBook();
  render(<PrintingGuide book={book} profileId="pocket-150x100"><p>providers</p></PrintingGuide>);
  expect(screen.getByRole('heading',{level:2,name:'Как напечатать'})).toBeTruthy();
  expect(screen.getAllByRole('heading',{level:3}).map(heading=>heading.textContent)).toEqual(['Дома на A4','В копицентре','В типографии']);
  const summaries=Array.from(document.querySelectorAll('summary')).map(summary=>summary.textContent);
  expect(summaries).toHaveLength(3);
  expect(new Set(summaries).size).toBe(3);
  expect(Array.from(document.querySelectorAll('details')).every(details=>!details.open)).toBe(true);
  // Paper weights match the editorial print guide (data/travelBooks/instructions/ru.json).
  expect(screen.getByText(/120–160 г\/м².*250–300 г\/м²/)).toBeTruthy();
  expect(screen.getByText('providers')).toBeTruthy();
});
