import React from 'react';
import {Platform,Text} from 'react-native';
import {Link} from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import {useThemedColors} from '@/hooks/useTheme';
import {DESIGN_TOKENS} from '@/constants/designSystem';
import {webTitleRef} from '@/utils/webProps';
import {relatedBookForSource,type BookSource} from '@/services/book/readyBooks/related';
import {getActiveLocale} from '@/i18n';
import {trackReadyBookRelatedOpened} from '@/utils/growthFunnelAnalytics';
import {useBookCopy} from './bookCopy';
export function ReadyBookRelatedLink({iconOnly=false,...source}:BookSource&{iconOnly?:boolean}){
  const bookT=useBookCopy();
  const colors=useThemedColors();
  if(Platform.OS!=='web')return null;
  const book=relatedBookForSource(source);
  if(!book)return null;
  const label=`${bookT('explore')}: ${book.title}`;
  const entrySource=source.questId!=null?'quest':source.pointId!=null?'place':'travel';
  return (
    <Link
      href={`/books/${book.slug}`}
      ref={iconOnly?webTitleRef(label):undefined}
      accessibilityLabel={iconOnly?label:undefined}
      {...{dataSet:{cardAction:'true'}}}
      onPress={event=>{event.stopPropagation();trackReadyBookRelatedOpened(book,entrySource,getActiveLocale());}}
      style={iconOnly?{
        display:'flex',alignItems:'center',justifyContent:'center',alignSelf:'flex-start',
        width:44,minHeight:44,borderRadius:DESIGN_TOKENS.radii.pill,
        backgroundColor:colors.backgroundSecondary,color:colors.textMuted,
      }:{minHeight:44,paddingVertical:12}}
    >
      {iconOnly?<Feather name="book" size={20} color={colors.textMuted}/>:<Text>{bookT('related')} · {book.title}</Text>}
    </Link>
  );
}
