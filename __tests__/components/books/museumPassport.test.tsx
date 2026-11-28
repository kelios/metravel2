import React from 'react';
import {render,screen} from '@testing-library/react';
import MuseumPassportDetails from '@/components/books/MuseumPassportDetails.web';
import {museumPassportFixture} from '../../services/book/readyBooks/museumPassportFixture';
import {translate} from '@/i18n';

jest.mock('@/components/books/BooksFrame',()=>({BooksFrame:({children}:React.PropsWithChildren)=><main>{children}</main>}));
jest.mock('expo-router',()=>({useRouter:()=>({push:jest.fn()})}));
jest.mock('@/utils/growthFunnelAnalytics',()=>({trackReadyBookEvent:jest.fn()}));

it('downloads four distinct exact files and exposes print geometry without embedding PDFs',()=>{
  const passport=museumPassportFixture(),{container}=render(<MuseumPassportDetails passport={passport}/>);
  const downloads=Array.from(container.querySelectorAll('a[download]'));
  expect(downloads.map(anchor=>anchor.getAttribute('href'))).toEqual([passport.read.uri,passport.booklet.uri,passport.wrapCover.uri,passport.stickers.uri]);
  expect(container.querySelector('iframe,object,embed')).toBeNull();
  expect(screen.getByText(translate('books:museumBookletHint'))).toBeTruthy();
  expect(screen.getByText(translate('books:museumWrapHint'))).toBeTruthy();
  expect(screen.getByText(translate('books:museumStickersHint'))).toBeTruthy();
  expect(screen.getByText(/90 ppi/).textContent).toContain(translate('books:printNotCertified'));
});

it('keeps all numbered PDF destinations in the document with a native pre-hydration disclosure',()=>{
  const passport=museumPassportFixture(),{container}=render(<MuseumPassportDetails passport={passport}/>);
  const disclosure=screen.getByText(translate('books:museumShowAll',{count:'13'})).closest('details');
  expect(disclosure).not.toBeNull();
  expect(disclosure?.open).toBe(false);
  expect(disclosure?.querySelector('summary')).toBeTruthy();
  for(const museum of passport.museums){
    const destination=Array.from(container.querySelectorAll('a')).find(anchor=>anchor.textContent===museum.title);
    expect(destination?.getAttribute('href')).toBe(`${passport.read.uri}#page=${museum.page}`);
  }
  expect(disclosure?.querySelector('a')?.textContent).toBe('Muzeum 13');
});
