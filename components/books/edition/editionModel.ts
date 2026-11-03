import editionMeta from '@/data/travelBooks/edition.json';
import {formatDate,formatNumber} from '@/i18n';
import {editionFamily} from '@/services/book/readyBooks/editionFamily';
import {bookPreview} from '@/services/book/readyBooks/preview';
import type {ReadyBookSummary} from '@/services/book/readyBooks/bookMetadata';
import type {PublishedBook} from '@/services/book/readyBooks/publication';
import type {bookT} from '../bookCopy';

type T = typeof bookT;
type CountedEdition = {kind?:'places'|'quests';stopCount:number};
type FamilyEdition = Pick<ReadyBookSummary,'id'|'country'|'visualStyle'> & {
  kind?:'places'|'quests';sourceContract?:'thematic-v1';seriesId?:string;volume?:number;theme?:string;
};

export const isAlbumProfile=(profileId:string)=>profileId==='album-a5';
/** Lower-case physical size for captions and file lines: «карманная 15 × 10 см». */
export const profileShort=(profileId:string,t:T)=>t(isAlbumProfile(profileId)?'sizeAlbumShort':'sizePocketShort');

/** «31 место» / «41 квест»: the number goes through the locale formatter, the noun through the plural family. */
export function stopCountPhrase(book:CountedEdition,t:T){
  const params={count:book.stopCount,value:formatNumber(book.stopCount)};
  return book.kind==='quests'?t('chipQuests',params):t('chipPlaces',params);
}
export const pageCountPhrase=(count:number,t:T)=>t('chipPages',{count,value:formatNumber(count)});
export const sheetCountPhrase=(count:number,t:T)=>t('sheetCount',{count,value:formatNumber(count)});

/** One promise per edition family; the catalogue carries no per-book prose (design doc, data gap 1). */
export function promiseText(book:FamilyEdition&CountedEdition,t:T){
  const phrase=stopCountPhrase(book,t);
  if(book.kind==='quests')return t(book.country==='BY'?'promiseByQuests':'promisePlQuests',{quests:phrase});
  if(book.sourceContract==='thematic-v1'&&book.country==='PL'){
    if(book.theme==='castles')return t('promisePlCastles',{places:phrase});
    if(book.theme==='mountains')return t('promisePlMountains',{places:phrase});
  }
  return t(book.country==='BY'?'promiseByCountry':'promisePlCountry',{places:phrase});
}

const REVISION_DATE=/^(\d{4})-(\d{2})-(\d{2})\./;
const EDITION_MONTH=/^(\d{4})-(\d{2})$/;
/**
 * Dated revisions («2026-11-01.photo.…») show their day; hash revisions fall back to the
 * edition month from `data/travelBooks/edition.json`. A revision hash is never shown.
 */
export function versionLine(revision:string,t:T,editionDate:string=editionMeta.editionDate){
  const day=REVISION_DATE.exec(revision);
  if(day)return t('versionDate',{date:formatDate(Date.UTC(Number(day[1]),Number(day[2])-1,Number(day[3])),{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})});
  const month=EDITION_MONTH.exec(editionDate);
  return month?t('versionMonth',{date:formatDate(Date.UTC(Number(month[1]),Number(month[2])-1,1),{month:'long',year:'numeric',timeZone:'UTC'})}):undefined;
}

const styleOf=(book:FamilyEdition)=>book.visualStyle??'watercolor';
const kindOf=(book:FamilyEdition)=>book.kind??'places';
/**
 * «Ещё книги» (owner decision 02.11.2026): other styles of the same edition family first,
 * then the other country — its counterpart of the same kind and style before the rest —
 * and only then other editions of this country. Within a tier, unseen families go first
 * so four cards do not repeat one book in four styles.
 */
export function moreBooks<B extends FamilyEdition>(current:FamilyEdition,catalog:readonly B[],limit=4):B[]{
  const family=editionFamily(current);
  const tier=(book:B)=>{
    if(book.country===current.country)return editionFamily(book)===family?0:3;
    const counterpart=kindOf(book)===kindOf(current)&&book.sourceContract===current.sourceContract&&styleOf(book)===styleOf(current);
    return counterpart?1:2;
  };
  const ranked=catalog.filter(book=>book.id!==current.id).map((book,index)=>({book,index,tier:tier(book)}))
    .sort((a,b)=>a.tier-b.tier||a.index-b.index);
  const picked:B[]=[];
  const families=new Set<string>();
  for(const pass of [true,false]){
    for(const {book,tier:level} of ranked){
      if(picked.length>=limit)return picked;
      if(picked.includes(book))continue;
      const fresh=!families.has(editionFamily(book));
      // The first pass keeps tier order but skips repeated families of the lower tiers.
      if(pass&&level>1&&!fresh)continue;
      picked.push(book);families.add(editionFamily(book));
    }
  }
  return picked;
}

type PreviewPage = PublishedBook['preview'][number]['pages'][number];
export type EditionPages = {cover?:PreviewPage;spreads:PreviewPage[][];how:PreviewPage[]};
/**
 * Hero spreads and «Как устроена книга» thumbnails come from the published preview of the
 * selected size: contents spread, the first place spread, and that place's own pages.
 */
export function editionPages(book:PublishedBook,profileId:string):EditionPages{
  try{
    const body=bookPreview(book,profileId,'body').pages;
    const cover=bookPreview(book,profileId,'cover').pages[0];
    const page=(number:number)=>body[number-1];
    const first=book.stops[0]?.page??1;
    const quests=book.kind==='quests';
    // Places: title, preparation, usage, then contents from page 4; quests: title, usage, contents.
    const lead=quests?2:4;
    const pair=(left:number)=>[page(left),page(left+1)].filter((item):item is PreviewPage=>Boolean(item));
    const how=(quests?[first,first+2,first+3]:[first,first+1,first+2]).map(page).filter((item):item is PreviewPage=>Boolean(item));
    return {cover,spreads:[pair(lead),pair(first)].filter(spread=>spread.length>0),how};
  }catch{
    return {spreads:[],how:[]};
  }
}
