import React, {Suspense} from 'react';
import {lazyWithRetry} from '@/utils/chunkReload';
import {BooksFrame} from '../BooksFrame';
import {useBookCopy} from '../bookCopy';

const CatalogContent=lazyWithRetry(()=>import('./ReadyBooksCatalogContent.web'),{name:'ReadyBooksCatalogContent'});

export default function ReadyBooksCatalog(){
  const bookT=useBookCopy();
  return <BooksFrame title={bookT('title')} path="/books"><p>{bookT('intro')}</p>
    <Suspense fallback={<p role="status">{bookT('loadingPage')}</p>}><CatalogContent/></Suspense>
  </BooksFrame>;
}
