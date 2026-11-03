import React, {Suspense} from 'react';
import {lazyWithRetry} from '@/utils/chunkReload';
import {BooksFrame} from '../BooksFrame';
import {catalogCss,editionCss} from '../booksStyles.web';
import {translate} from '@/i18n';
import {useLocaleRevision} from '@/i18n/useLocaleRevision';

const CatalogLanding=lazyWithRetry(()=>import('./ReadyBooksLanding.web'),{name:'ReadyBooksLanding'});

/** The landing renders its own `h1` in the hero (#2970); the frame keeps title and SEO. */
export default function ReadyBooksCatalog(){
  useLocaleRevision();
  return <BooksFrame title={translate('books:title')} path="/books" description={translate('books:catalogDescription')} heading={false}>
    <div className="rbe rbc"><style>{editionCss+catalogCss}</style>
      <Suspense fallback={<p role="status">{translate('books:loadingPage')}</p>}><CatalogLanding/></Suspense>
    </div>
  </BooksFrame>;
}
