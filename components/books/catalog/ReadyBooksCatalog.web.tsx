import React, {Suspense} from 'react';
import {lazyWithRetry} from '@/utils/chunkReload';
import {BooksFrame} from '../BooksFrame';
import {translate} from '@/i18n';
import {useLocaleRevision} from '@/i18n/useLocaleRevision';

const CatalogContent=lazyWithRetry(()=>import('./ReadyBooksCatalogContent.web'),{name:'ReadyBooksCatalogContent'});

export default function ReadyBooksCatalog(){
  useLocaleRevision();
  return <BooksFrame title={translate('books:title')} path="/books"><p>{translate('books:intro')}</p>
    <Suspense fallback={<p role="status">{translate('books:loadingPage')}</p>}><CatalogContent/></Suspense>
  </BooksFrame>;
}
