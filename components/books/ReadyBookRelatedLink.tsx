import React from 'react';
import {Platform,Text} from 'react-native';
import {Link} from 'expo-router';
import {relatedBookForSource,type BookSource} from '@/services/book/readyBooks/related';
import {useBookCopy} from './bookCopy';
export function ReadyBookRelatedLink(source:BookSource){
  const bookT=useBookCopy();
  if(Platform.OS!=='web')return null;
  const book=relatedBookForSource(source);
  if(!book)return null;
  return <Link href={`/books/${book.slug}`} {...{dataSet:{cardAction:'true'}}} onPress={event=>event.stopPropagation()} style={{minHeight:44,paddingVertical:12}}><Text>{bookT('related')} · {book.title}</Text></Link>;
}
