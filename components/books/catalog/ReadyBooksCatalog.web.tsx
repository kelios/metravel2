import React from 'react';
import {Link} from 'expo-router';
import {hasPrintSupplements} from '@/services/book/readyBooks/publicationState';
import {readyBooks} from '@/services/book/readyBooks/catalog';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import {formatNumber} from '@/i18n';
import {BooksFrame} from '../BooksFrame';
import {useBookCopy} from '../bookCopy';
export default function ReadyBooksCatalog(){
  const bookT=useBookCopy();
  return <BooksFrame title={bookT('title')} path="/books"><p>{bookT('intro')}</p>
    <p className="ready-books-note">{bookT(readyBooks.length>0&&readyBooks.every(hasPrintSupplements)?'digitalKit':'partial')}</p>
    {readyBooks.length===0?<section><h2>{bookT('preparing')}</h2><p>{bookT('pending')}</p></section>:<div className="ready-books-grid">{readyBooks.map(book=><article className="ready-books-card" key={book.id}>
      <ImageCardMedia src={book.coverUri} alt={book.title} height={280} fit="contain" optimizeWeb={false} blurBackground={false}/><div><h2 lang={book.contentLocale}>{book.title}</h2><p>{bookT('language')}</p><p>{bookT('counts',{places:formatNumber(book.stopCount),pages:formatNumber(book.bodyPageCount)})}</p><p>{book.profiles.map(profile=><React.Fragment key={profile.id}>{bookT(profile.id==='album-a5'?'album':'pocket')}<br/></React.Fragment>)}</p><Link href={`/books/${book.slug}`}>{bookT('explore')}</Link></div>
    </article>)}</div>}
  </BooksFrame>;
}
