import React,{useState} from 'react';
import {bookStyleKey} from '@/services/book/readyBooks/publicationState';
import {miniDiaries,readyBooks} from '@/services/book/readyBooks/catalog';
import {bookSeries,catalogueTheme,groupCatalogue,selectCatalogue,type CatalogueCountry,type CatalogueTheme} from '@/services/book/readyBooks/seriesCatalog';
import {formatNumber} from '@/i18n';
import {useBookCopy} from '../bookCopy';
import {EditionIcon,useEditionLink} from '../edition/EditionParts.web';
import {pageCountPhrase,promiseText,stopCountPhrase} from '../edition/editionModel';
type CatalogBook=(typeof readyBooks)[number];
const STYLE_BENEFIT={styleWatercolor:'styleBenefitWatercolor',stylePhoto:'styleBenefitPhoto',stylePhotoSources:'styleBenefitPhotoSources',styleGraphic:'styleBenefitGraphic',styleFantasy:'styleBenefitFantasy'} as const;
const THEMES={all:'themeAll',mixed:'themeMixed',castles:'themeCastles',mountains:'themeMountains',quests:'themeQuests'} as const;
const COUNTRIES={all:'countryAll',BY:'countryBY',PL:'countryPL'} as const;

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
  const link=useEditionLink();
  const [theme,setTheme]=useState<CatalogueTheme>('all');
  const [country,setCountry]=useState<CatalogueCountry>('all');
  const {available,planned}=selectCatalogue(readyBooks,bookSeries,theme,country);
  const compact=(theme==='all'||theme==='mixed')?miniDiaries.filter(diary=>country==='all'||country===diary.country):[];
  return <>
    <fieldset className="rbc-themes"><legend className="rbe-small">{bookT('theme')}</legend>
      {(Object.keys(THEMES) as CatalogueTheme[]).map(value=><label key={value} className="rbc-theme"><input type="radio" name="book-theme" value={value} checked={theme===value} onChange={()=>setTheme(value)}/><span>{bookT(THEMES[value])}</span></label>)}
    </fieldset>
    <fieldset className="rbc-themes"><legend className="rbe-small">{bookT('catalogCountry')}</legend>
      {(Object.keys(COUNTRIES) as CatalogueCountry[]).map(value=><label key={value} className="rbc-theme"><input type="radio" name="book-country" value={value} checked={country===value} onChange={()=>setCountry(value)}/><span>{bookT(COUNTRIES[value])}</span></label>)}
    </fieldset>
    {available.length===0&&planned.length===0&&compact.length===0?<p className="rbe-h3" role="status">{bookT(readyBooks.length===0?'preparing':'noBooks')}</p>:<ul className="rbc-grid">
      {compact.map(diary=>{
        const href=`/books/${diary.slug}`;
        return <li key={diary.id}><article className="rbc-card rbc-card-mini">
          <div className="rbc-card-thumb"><img src={diary.cover.uri} alt="" loading="lazy" decoding="async"/></div>
          <div className="rbc-card-body">
            <p className="rbe-eyebrow">{bookT('miniDiary')}</p>
            <h3 lang={diary.contentLocale}>{diary.title}</h3>
            <p className="rbe-small" lang={diary.contentLocale}>{diary.summary}</p>
            <p className="rbe-small">{pageCountPhrase(diary.pageCount,bookT)} · A5 · {bookT('language')}</p>
            <a className="rbc-card-link" href={href} onClick={link(href)} aria-label={`${bookT('explore')}: ${diary.title}`}>{bookT('explore')}<EditionIcon name="arrow-right" size={16}/></a>
          </div>
        </article></li>;
      })}
      {groupCatalogue(available).map(([book,...variants])=>{
      const card=catalogCard(book,bookT);
      const href=`/books/${book.slug}`;
      const grouped=variants.length>0;
      const sizes=book.profiles.map(profile=>bookT(profile.id==='album-a5'?'sizeAlbumShort':'sizePocketShort')).join(' · ');
      return <li key={book.id}><article className="rbc-card">
        <div className="rbc-card-thumb"><img src={book.coverUri} alt={bookT('coverAlt',{title:card.title})} loading="lazy" decoding="async"/></div>
        <div className="rbc-card-body">
          <h3 lang={card.titleLang}>{grouped?bookT(COUNTRIES[book.country]):card.title}</h3>
          {catalogueTheme(book)==='mountains'?<p className="rbe-small">{promiseText(book,bookT)}</p>:!grouped&&card.benefit&&<p className="rbe-small">{bookT(card.benefit)}</p>}
          <ul className="rbe-chips">
            <li><EditionIcon name="map-pin" size={16}/>{stopCountPhrase(book,bookT)}</li>
            <li><EditionIcon name="file-text" size={16}/>{pageCountPhrase(book.bodyPageCount,bookT)}</li>
            <li className="is-accent"><EditionIcon name="gift" size={16}/>{bookT('language')}</li>
          </ul>
          {book.kind==='quests'&&book.volume===1&&<p className="rbe-small">{bookT('questNextPart')}</p>}
          <p className="rbe-small">{bookT('catalogSizes',{sizes})}</p>
          {grouped?<ul className="rbc-style-list" aria-label={bookT('catalogStyles')}>
            {[book,...variants].map(edition=>{
              const editionHref=`/books/${edition.slug}`;
              const key=bookStyleKey(edition.visualStyle);
              return <li key={edition.id}><a className="rbe-link" href={editionHref} onClick={link(editionHref)} aria-label={catalogCard(edition,bookT).title}>
                {bookT(key)}<EditionIcon name="arrow-right" size={16}/>
              </a><p className="rbe-small">{bookT(STYLE_BENEFIT[key])}</p></li>;
            })}
          </ul>:<a className="rbc-card-link" href={href} onClick={link(href)}>{bookT('explore')}<EditionIcon name="arrow-right" size={16}/></a>}
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
