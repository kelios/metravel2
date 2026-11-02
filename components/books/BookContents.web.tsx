import React from 'react';
import {formatNumber} from '@/i18n';
import type {PublishedBook} from '@/services/book/readyBooks/publication';
import {useBookCopy} from './bookCopy';

export type BookContentsProps = {
  stops: {id:string;title:string;page:number}[];
  contentLocale: PublishedBook['contentLocale'];
};

export default function BookContents({stops,contentLocale}:BookContentsProps){
  const t=useBookCopy();
  return <><h2>{t('inside')}</h2><details><summary>{t('contents')}</summary><ol lang={contentLocale}>
    {stops.map(stop=><li key={stop.id}>{stop.title} · {formatNumber(stop.page)}</li>)}
  </ol></details></>;
}
