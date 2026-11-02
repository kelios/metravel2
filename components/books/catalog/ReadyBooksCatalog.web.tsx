import React from 'react';
import {Link} from 'expo-router';
import {bookStyleKey,hasPrintSupplements} from '@/services/book/readyBooks/publicationState';
import {readyBooks} from '@/services/book/readyBooks/catalog';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import {BooksFrame} from '../BooksFrame';
import {formatReadyBookCounts,useBookCopy} from '../bookCopy';
export default function ReadyBooksCatalog(){
  const bookT=useBookCopy();
  return <BooksFrame title={bookT('title')} path="/books"><p>{bookT('intro')}</p>
    {readyBooks.length===0?<section><h2>{bookT('preparing')}</h2><p>{bookT('pending')}</p></section>:<div className="ready-books-grid">{readyBooks.map(book=><article className="ready-books-card" key={book.id}>
      <ImageCardMedia src={book.coverUri} alt={book.title} height={280} fit="contain" optimizeWeb={false} blurBackground={false}/><div><h2 lang={book.contentLocale}>{book.title}</h2>{book.kind!=='quests'&&<p>{bookT('style')}: {bookT(bookStyleKey(book.visualStyle))}</p>}<p className="ready-books-note">{bookT(hasPrintSupplements(book)?'digitalKit':'partial')}</p><p>{bookT('language')}</p><p>{formatReadyBookCounts(book,bookT)}</p><p>{book.profiles.map(profile=><React.Fragment key={profile.id}>{bookT(profile.id==='album-a5'?'album':'pocket')}<br/></React.Fragment>)}</p><Link href={`/books/${book.slug}`}>{bookT('explore')}</Link></div>
    </article>)}</div>}
  </BooksFrame>;
}
