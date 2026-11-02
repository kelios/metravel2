import React from 'react';
import {Platform,type StyleProp,Text,type TextStyle} from 'react-native';
import {Link} from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import {useThemedColors} from '@/hooks/useTheme';
import {DESIGN_TOKENS} from '@/constants/designSystem';
import {webTitleRef} from '@/utils/webProps';
import {relatedBookForSource,type BookSource} from '@/services/book/readyBooks/related';
import {getActiveLocale} from '@/i18n';
import {trackReadyBookRelatedOpened} from '@/utils/growthFunnelAnalytics';
import {useBookCopy} from './bookCopy';
// `renderTile` lets a card draw the link as one of its own action tiles (same
// bubble/label as its siblings), so the link joins the card's action row instead
// of adding a separate row that makes only some cards in a grid row taller.
export function ReadyBookRelatedLink({iconOnly=false,tileStyle,renderTile,...source}:BookSource&{
  iconOnly?:boolean;
  tileStyle?:StyleProp<TextStyle>;
  renderTile?:(label:string)=>React.ReactNode;
}){
  const bookT=useBookCopy();
  const colors=useThemedColors();
  if(Platform.OS!=='web')return null;
  const book=relatedBookForSource(source);
  if(!book)return null;
  const label=`${bookT('explore')}: ${book.title}`;
  const entrySource=source.questId!=null?'quest':source.pointId!=null?'place':'travel';
  const compact=iconOnly||renderTile!=null;
  return (
    <Link
      href={`/books/${book.slug}`}
      ref={compact?webTitleRef(label):undefined}
      accessibilityLabel={compact?label:undefined}
      {...{dataSet:{cardAction:'true'}}}
      onPress={event=>{event.stopPropagation();trackReadyBookRelatedOpened(book,entrySource,getActiveLocale());}}
      style={renderTile?[{display:'flex',flexDirection:'column'},tileStyle]:iconOnly?{
        display:'flex',alignItems:'center',justifyContent:'center',alignSelf:'flex-start',
        width:44,minHeight:44,borderRadius:DESIGN_TOKENS.radii.pill,
        backgroundColor:colors.backgroundSecondary,color:colors.textMuted,
      }:{minHeight:44,paddingVertical:12}}
    >
      {renderTile?renderTile(bookT('relatedShort')):iconOnly?<Feather name="book" size={20} color={colors.textMuted}/>:<Text>{bookT('related')} · {book.title}</Text>}
    </Link>
  );
}
