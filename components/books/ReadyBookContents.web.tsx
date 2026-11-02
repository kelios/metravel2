import React from 'react';
import contents from '@/data/travelBooks/contents.json';
import type {ReadyBookSummary} from '@/services/book/readyBooks/bookMetadata';
import BookContents from './BookContents.web';

/** Selected-edition text only, loaded outside the eager catalogue graph. */
export default function ReadyBookContents({book}:{book:ReadyBookSummary}){
  const edition=contents.books.find(item=>item.id===book.id&&item.revision===book.revision&&item.metadataSha256===book.metadata.sha256);
  if(!edition)throw new Error('BOOK_CONTENTS_IDENTITY');
  return <BookContents stops={edition.stops} contentLocale={book.contentLocale}/>;
}
