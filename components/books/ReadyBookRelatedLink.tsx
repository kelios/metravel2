import React from 'react';
import {Platform,Text} from 'react-native';
import {Link,useRouter,type Href} from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import {useThemedColors} from '@/hooks/useTheme';
import {DESIGN_TOKENS} from '@/constants/designSystem';
import {webTitleRef} from '@/utils/webProps';
import {relatedBookForSource,type BookSource} from '@/services/book/readyBooks/related';
import {getActiveLocale} from '@/i18n';
import {trackReadyBookRelatedOpened} from '@/utils/growthFunnelAnalytics';
import {useBookCopy} from './bookCopy';
const entrySourceOf=(source:BookSource)=>source.questId!=null?'quest':source.pointId!=null?'place':'travel';
export function ReadyBookRelatedLink({iconOnly=false,...source}:BookSource&{iconOnly?:boolean}){
  const bookT=useBookCopy();
  const colors=useThemedColors();
  if(Platform.OS!=='web')return null;
  const book=relatedBookForSource(source);
  if(!book)return null;
  const label=`${bookT('explore')}: ${book.title}`;
  return (
    <Link
      href={`/books/${book.slug}`}
      ref={iconOnly?webTitleRef(label):undefined}
      accessibilityLabel={iconOnly?label:undefined}
      {...{dataSet:{cardAction:'true'}}}
      onPress={event=>{event.stopPropagation();trackReadyBookRelatedOpened(book,entrySourceOf(source),getActiveLocale());}}
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
// Та же связь «источник → книга» как действие карточки: карточка ставит его в свой
// ряд или лист по общему бюджету плиток, а не отдельной строкой (web-only, как ссылка).
export function useReadyBookAction(source:BookSource):{label:string;title:string;onPress:()=>void}|null{
  // useBookCopy перерисовывает по смене локали, поэтому подписи строятся на рендере.
  const bookT=useBookCopy();
  const router=useRouter();
  const {pointId,questId,sourceTravelId}=source;
  const book=React.useMemo(
    ()=>Platform.OS==='web'?relatedBookForSource({pointId,questId,sourceTravelId}):null,
    [pointId,questId,sourceTravelId],
  );
  const onPress=React.useCallback(()=>{
    if(!book)return;
    trackReadyBookRelatedOpened(book,entrySourceOf({pointId,questId,sourceTravelId}),getActiveLocale());
    router.push(`/books/${book.slug}` as Href);
  },[book,router,pointId,questId,sourceTravelId]);
  if(!book)return null;
  return {label:bookT('relatedShort'),title:`${bookT('explore')}: ${book.title}`,onPress};
}
