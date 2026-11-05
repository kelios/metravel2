import React from 'react';
import {fireEvent,render,screen,within} from '@testing-library/react';
import MiniDiaryDetails from '@/components/books/MiniDiaryDetails.web';
import {miniDiaries} from '@/services/book/readyBooks/catalog';
import {translate} from '@/i18n';
import {trackReadyBookEvent} from '@/utils/growthFunnelAnalytics';

jest.mock('@/components/books/BooksFrame',()=>({BooksFrame:({children}:React.PropsWithChildren)=><main>{children}</main>}));
jest.mock('expo-router',()=>({useRouter:()=>({push:jest.fn()})}));
jest.mock('@/utils/growthFunnelAnalytics',()=>({trackReadyBookEvent:jest.fn()}));

it.each(miniDiaries)('makes all six pages and the three independent trips usable for $slug',diary=>{
  render(<MiniDiaryDetails diary={diary}/>);
  const trips=screen.getByRole('region',{name:translate('books:miniChooseTrip')});
  const contents=screen.getByRole('region',{name:translate('books:miniInsideTitle')});
  expect(within(contents).getAllByRole('listitem')).toHaveLength(6);
  const cards=within(trips).getAllByRole('listitem');
  expect(cards).toHaveLength(3);
  diary.stops.forEach((stop,index)=>{
    const card=within(cards[index]);
    expect(card.getByRole('heading',{name:stop.title}).getAttribute('lang')).toBe('ru');
    expect(card.getAllByRole('link').map(anchor=>anchor.getAttribute('href'))).toEqual([
      stop.mapUrl,stop.articleUrl,`${diary.pdf.uri}#page=${index+3}`,
    ]);
    const source=card.getAllByRole('link')[1];
    expect(source.textContent).toContain(translate(stop.articleUrl.includes('/quests/')?'books:miniQuest':'books:miniArticle'));
  });
  expect(screen.getByText(translate('books:miniPrintNote'))).toBeTruthy();
  expect(screen.getByText(translate('books:miniSampleCaption',{page:'3'}))).toBeTruthy();
  expect(screen.getByRole('link',{name:translate('books:miniReadAll')}).getAttribute('href')).toBe(diary.pdf.uri);
});

it('keeps download and reading actions distinct and requests PDF bytes only through real links',()=>{
  const diary=miniDiaries[0];
  const {container}=render(<MiniDiaryDetails diary={diary}/>);
  const download=screen.getByRole('link',{name:translate('books:miniDownload')});
  const read=screen.getByRole('link',{name:translate('books:miniReadAll')});
  expect(download.getAttribute('href')).toBe(diary.pdf.uri);
  expect(download.getAttribute('download')).toBe(`${diary.title} — A5.pdf`);
  expect(read.hasAttribute('download')).toBe(false);
  expect(container.querySelector('iframe,object,embed')).toBeNull();
  // Prevent jsdom navigation; the browser owns navigation and downloading in production.
  download.addEventListener('click',event=>event.preventDefault());
  read.addEventListener('click',event=>event.preventDefault());
  fireEvent.click(download);
  expect(trackReadyBookEvent).toHaveBeenCalledWith('ReadyBookDownloadRequested',diary,expect.any(String),{profileId:'album-a5',artifactPurpose:'read'});
  fireEvent.click(read);
  expect(trackReadyBookEvent).toHaveBeenCalledWith('ReadyBookPreviewOpened',diary,expect.any(String),{profileId:'album-a5'});
});
