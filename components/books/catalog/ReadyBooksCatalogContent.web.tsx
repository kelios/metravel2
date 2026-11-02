import React, {useState} from 'react';
import {Link} from 'expo-router';
import {bookStyleKey} from '@/services/book/readyBooks/publicationState';
import {readyBooks} from '@/services/book/readyBooks/catalog';
import {bookSeries,selectCatalogue,type CatalogueTheme} from '@/services/book/readyBooks/seriesCatalog';
import {formatNumber} from '@/i18n';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import {formatReadyBookCounts,useBookCopy} from '../bookCopy';
type CatalogBook=(typeof readyBooks)[number];
const STYLE_BENEFIT={styleWatercolor:'styleBenefitWatercolor',stylePhoto:'styleBenefitPhoto',stylePhotoSources:'styleBenefitPhotoSources',styleGraphic:'styleBenefitGraphic',styleFantasy:'styleBenefitFantasy'} as const;

/**
 * Editions of one country share a title; the card names country and style so three
 * «Беларусь. Книга воспоминаний» cards stay distinct for people and screen readers (#2953).
 * Quest and thematic titles are already unique and stay in the book language.
 */
export function catalogCard(book:CatalogBook,t:ReturnType<typeof useBookCopy>){
  if(book.kind==='quests')return {title:book.title,titleLang:book.contentLocale,benefit:undefined};
  const styleKey=bookStyleKey(book.visualStyle,book.sourceContract);
  const benefit=STYLE_BENEFIT[styleKey];
  if(book.sourceContract==='thematic-v1')return {title:book.title,titleLang:book.contentLocale,benefit};
  return {title:t('cardTitle',{country:t(book.country==='BY'?'countryBY':'countryPL'),style:t(styleKey)}),titleLang:undefined,benefit};
}

export default function ReadyBooksCatalogContent(){
  const bookT=useBookCopy();
  const [theme,setTheme]=useState<CatalogueTheme>('all');
  const {available,planned}=selectCatalogue(readyBooks,bookSeries,theme);
  const themes={all:'themeAll',mixed:'themeMixed',castles:'themeCastles',mountains:'themeMountains',quests:'themeQuests'} as const;
  return <>
    <fieldset className="ready-books-controls"><legend>{bookT('theme')}</legend>{(Object.keys(themes) as CatalogueTheme[]).map(value=><label key={value}><input type="radio" name="book-theme" value={value} checked={theme===value} onChange={()=>setTheme(value)}/>{bookT(themes[value])}</label>)}</fieldset>
    {available.length===0&&planned.length===0?<section><h2>{bookT(readyBooks.length===0?'preparing':'noBooks')}</h2></section>:<div className="ready-books-grid">{available.map(book=>{
      const card=catalogCard(book,bookT);
      return <article className="ready-books-card" key={book.id}>
        <ImageCardMedia src={book.coverUri} alt={bookT('coverAlt',{title:card.title})} height={280} fit="contain" webResponsiveSource={{src:book.coverUri}}/><div><h2 lang={card.titleLang}>{card.title}</h2>{card.benefit&&<p>{bookT(card.benefit)}</p>}<p>{bookT('language')}</p><p>{formatReadyBookCounts(book,bookT)}</p>{book.kind==='quests'&&book.volume===1&&<p>{bookT('questNextPart')}</p>}<p>{book.profiles.map(profile=><React.Fragment key={profile.id}>{bookT(profile.id==='album-a5'?'album':'pocket')}<br/></React.Fragment>)}</p><Link href={`/books/${book.slug}`}>{bookT('explore')}</Link></div>
      </article>;})}{planned.map(series=><article className="ready-books-card" key={series.id}><div><h2 lang="ru">{series.title}</h2><p className="ready-books-note">{bookT('seriesPlanned')}</p><p>{bookT('seriesPlaces',{count:formatNumber(series.targetPlaces)})}</p><p>{bookT('language')}</p></div></article>)}</div>}
  </>;
}
