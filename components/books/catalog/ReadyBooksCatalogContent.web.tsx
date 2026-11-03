import React,{useState} from 'react';
import {bookStyleKey} from '@/services/book/readyBooks/publicationState';
import {readyBooks} from '@/services/book/readyBooks/catalog';
import {bookSeries,selectCatalogue,type CatalogueTheme} from '@/services/book/readyBooks/seriesCatalog';
import {formatNumber} from '@/i18n';
import {useBookCopy} from '../bookCopy';
import {EditionIcon,useEditionLink} from '../edition/EditionParts.web';
import {pageCountPhrase,stopCountPhrase} from '../edition/editionModel';
type CatalogBook=(typeof readyBooks)[number];
const STYLE_BENEFIT={styleWatercolor:'styleBenefitWatercolor',stylePhoto:'styleBenefitPhoto',stylePhotoSources:'styleBenefitPhotoSources',styleGraphic:'styleBenefitGraphic',styleFantasy:'styleBenefitFantasy'} as const;
const THEMES={all:'themeAll',mixed:'themeMixed',castles:'themeCastles',mountains:'themeMountains',quests:'themeQuests'} as const;

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

/** «Выберите свою книгу»: theme chips and one card per published edition or planned series (#2970). */
export default function ReadyBooksCatalogContent(){
  const bookT=useBookCopy();
  const link=useEditionLink();
  const [theme,setTheme]=useState<CatalogueTheme>('all');
  const {available,planned}=selectCatalogue(readyBooks,bookSeries,theme);
  return <>
    <fieldset className="rbc-themes"><legend className="rbe-small">{bookT('theme')}</legend>
      {(Object.keys(THEMES) as CatalogueTheme[]).map(value=><label key={value} className="rbc-theme"><input type="radio" name="book-theme" value={value} checked={theme===value} onChange={()=>setTheme(value)}/><span>{bookT(THEMES[value])}</span></label>)}
    </fieldset>
    {available.length===0&&planned.length===0?<p className="rbe-h3">{bookT(readyBooks.length===0?'preparing':'noBooks')}</p>:<ul className="rbc-grid">{available.map(book=>{
      const card=catalogCard(book,bookT);
      const href=`/books/${book.slug}`;
      const sizes=book.profiles.map(profile=>bookT(profile.id==='album-a5'?'sizeAlbumShort':'sizePocketShort')).join(' · ');
      return <li key={book.id}><article className="rbc-card">
        <div className="rbc-card-thumb"><img src={book.coverUri} alt={bookT('coverAlt',{title:card.title})} loading="lazy" decoding="async"/></div>
        <div className="rbc-card-body">
          <h3 lang={card.titleLang}>{card.title}</h3>
          {card.benefit&&<p className="rbe-small">{bookT(card.benefit)}</p>}
          <ul className="rbe-chips">
            <li><EditionIcon name="map-pin" size={16}/>{stopCountPhrase(book,bookT)}</li>
            <li><EditionIcon name="file-text" size={16}/>{pageCountPhrase(book.bodyPageCount,bookT)}</li>
            <li className="is-accent"><EditionIcon name="gift" size={16}/>{bookT('language')}</li>
          </ul>
          {book.kind==='quests'&&book.volume===1&&<p className="rbe-small">{bookT('questNextPart')}</p>}
          <p className="rbe-small">{bookT('catalogSizes',{sizes})}</p>
          <a className="rbc-card-link" href={href} onClick={link(href)}>{bookT('explore')}<EditionIcon name="arrow-right" size={16}/></a>
        </div>
      </article></li>;})}
      {planned.map(series=><li key={series.id}><article className="rbc-card rbc-card-planned">
        <div className="rbc-card-body">
          <h3 lang="ru">{series.title}</h3>
          <p className="rbe-small">{bookT('seriesPlanned')}</p>
          <p className="rbe-small">{bookT('seriesPlaces',{count:formatNumber(series.targetPlaces)})}</p>
          <p className="rbe-small">{bookT('language')}</p>
        </div>
      </article></li>)}
    </ul>}
  </>;
}
